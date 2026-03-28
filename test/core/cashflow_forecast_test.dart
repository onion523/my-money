import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/cashflow_forecast.dart';

void main() {
  group('CashflowForecast', () {
    final startDate = DateTime(2026, 3, 28);

    group('simulateFrom — 正常路徑', () {
      test('無事件模擬：每天餘額不變', () {
        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('50000'),
          events: [],
          days: 3,
          startDate: startDate,
        );

        expect(results.length, equals(3));
        for (final point in results) {
          expect(point.balance, equals(Decimal.parse('50000')));
          expect(point.delta, equals(Decimal.zero));
          expect(point.isSafe, isTrue);
          expect(point.description, equals('無變動'));
        }
      });

      test('單一收入事件', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 29),
            description: '薪水',
            delta: Decimal.parse('45000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('10000'),
          events: events,
          days: 3,
          startDate: startDate,
        );

        // 第一天(3/28)：無事件 -> 10000
        expect(results[0].balance, equals(Decimal.parse('10000')));
        // 第二天(3/29)：+45000 -> 55000
        expect(results[1].balance, equals(Decimal.parse('55000')));
        expect(results[1].description, equals('薪水'));
        // 第三天(3/30)：無事件 -> 55000
        expect(results[2].balance, equals(Decimal.parse('55000')));
      });

      test('同一天多個事件', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 28),
            description: '薪水',
            delta: Decimal.parse('45000'),
          ),
          CashflowEvent(
            date: DateTime(2026, 3, 28),
            description: '房租',
            delta: Decimal.parse('-12000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('10000'),
          events: events,
          days: 1,
          startDate: startDate,
        );

        // 同一天兩筆事件，產生兩個 CashflowPoint
        expect(results.length, equals(2));
        // 10000 + 45000 = 55000
        expect(results[0].balance, equals(Decimal.parse('55000')));
        // 55000 - 12000 = 43000
        expect(results[1].balance, equals(Decimal.parse('43000')));
      });

      test('收支混合多日模擬', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 29),
            description: '薪水',
            delta: Decimal.parse('50000'),
          ),
          CashflowEvent(
            date: DateTime(2026, 3, 30),
            description: '房租',
            delta: Decimal.parse('-15000'),
          ),
          CashflowEvent(
            date: DateTime(2026, 4, 1),
            description: '信用卡繳款',
            delta: Decimal.parse('-20000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('30000'),
          events: events,
          days: 5,
          startDate: startDate,
        );

        // 第1天(3/28)：30000
        expect(results[0].balance, equals(Decimal.parse('30000')));
        // 第2天(3/29)：30000 + 50000 = 80000
        expect(results[1].balance, equals(Decimal.parse('80000')));
        // 第3天(3/30)：80000 - 15000 = 65000
        expect(results[2].balance, equals(Decimal.parse('65000')));
        // 第4天(3/31)：65000
        expect(results[3].balance, equals(Decimal.parse('65000')));
        // 第5天(4/1)：65000 - 20000 = 45000
        expect(results[4].balance, equals(Decimal.parse('45000')));
      });
    });

    group('simulateFrom — 空輸入', () {
      test('天數為零回傳空清單', () {
        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('50000'),
          events: [],
          days: 0,
          startDate: startDate,
        );

        expect(results, isEmpty);
      });

      test('起始餘額為零', () {
        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.zero,
          events: [],
          days: 2,
          startDate: startDate,
        );

        expect(results.length, equals(2));
        expect(results[0].balance, equals(Decimal.zero));
        expect(results[0].isSafe, isTrue); // 零仍視為安全
      });
    });

    group('simulateFrom — 邊界值', () {
      test('負數天數回傳空清單', () {
        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('50000'),
          events: [],
          days: -1,
          startDate: startDate,
        );

        expect(results, isEmpty);
      });

      test('事件日期在模擬範圍之外被忽略', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 4, 10), // 超出 3 天範圍
            description: '未來事件',
            delta: Decimal.parse('-50000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('10000'),
          events: events,
          days: 3,
          startDate: startDate,
        );

        // 所有天數餘額不變
        for (final point in results) {
          expect(point.balance, equals(Decimal.parse('10000')));
        }
      });

      test('事件日期在起始日期之前被忽略', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 27), // 在起始日之前
            description: '過去事件',
            delta: Decimal.parse('-5000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('10000'),
          events: events,
          days: 2,
          startDate: startDate,
        );

        expect(results[0].balance, equals(Decimal.parse('10000')));
        expect(results[1].balance, equals(Decimal.parse('10000')));
      });

      test('模擬一天', () {
        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('1000'),
          events: [],
          days: 1,
          startDate: startDate,
        );

        expect(results.length, equals(1));
        expect(results[0].date, equals(DateTime(2026, 3, 28)));
      });
    });

    group('simulateFrom — 負數情境', () {
      test('餘額降為負數標記為不安全', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 29),
            description: '大筆支出',
            delta: Decimal.parse('-60000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('50000'),
          events: events,
          days: 3,
          startDate: startDate,
        );

        // 第1天：50000，安全
        expect(results[0].isSafe, isTrue);
        // 第2天：50000 - 60000 = -10000，不安全
        expect(results[1].balance, equals(Decimal.parse('-10000')));
        expect(results[1].isSafe, isFalse);
        // 第3天：-10000，不安全
        expect(results[2].isSafe, isFalse);
      });

      test('起始餘額為負', () {
        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('-5000'),
          events: [],
          days: 2,
          startDate: startDate,
        );

        expect(results[0].balance, equals(Decimal.parse('-5000')));
        expect(results[0].isSafe, isFalse);
      });

      test('從負餘額恢復為正', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 29),
            description: '薪水',
            delta: Decimal.parse('20000'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('-5000'),
          events: events,
          days: 2,
          startDate: startDate,
        );

        expect(results[0].isSafe, isFalse);
        // -5000 + 20000 = 15000
        expect(results[1].balance, equals(Decimal.parse('15000')));
        expect(results[1].isSafe, isTrue);
      });
    });

    group('simulateFrom — Decimal 精度', () {
      test('小數金額精確模擬', () {
        final events = [
          CashflowEvent(
            date: DateTime(2026, 3, 28),
            description: '小額支出',
            delta: Decimal.parse('-0.01'),
          ),
          CashflowEvent(
            date: DateTime(2026, 3, 29),
            description: '小額收入',
            delta: Decimal.parse('0.01'),
          ),
        ];

        final results = CashflowForecast.simulateFrom(
          bankBalance: Decimal.parse('100.50'),
          events: events,
          days: 2,
          startDate: startDate,
        );

        // 100.50 - 0.01 = 100.49
        expect(results[0].balance, equals(Decimal.parse('100.49')));
        // 100.49 + 0.01 = 100.50
        expect(results[1].balance, equals(Decimal.parse('100.50')));
      });
    });

    group('CashflowPoint', () {
      test('Equatable 相等比較', () {
        final a = CashflowPoint(
          date: DateTime(2026, 3, 28),
          description: '測試',
          delta: Decimal.parse('100'),
          balance: Decimal.parse('1000'),
          isSafe: true,
        );
        final b = CashflowPoint(
          date: DateTime(2026, 3, 28),
          description: '測試',
          delta: Decimal.parse('100'),
          balance: Decimal.parse('1000'),
          isSafe: true,
        );

        expect(a, equals(b));
      });
    });
  });
}
