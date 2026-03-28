import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/balance_calculator.dart';
import 'package:my_money/core/cashflow_forecast.dart';
import 'package:my_money/core/purchasing_power.dart';

void main() {
  group('PurchasingPower', () {
    group('check — 正常路徑', () {
      test('餘額充足且現金流安全，可以購買', () {
        final forecast = [
          CashflowPoint(
            date: DateTime(2026, 3, 28),
            description: '起始',
            delta: Decimal.zero,
            balance: Decimal.parse('50000'),
            isSafe: true,
          ),
          CashflowPoint(
            date: DateTime(2026, 3, 29),
            description: '無變動',
            delta: Decimal.zero,
            balance: Decimal.parse('50000'),
            isSafe: true,
          ),
        ];

        final result = PurchasingPower.check(
          amount: Decimal.parse('10000'),
          currentBalance: Decimal.parse('50000'),
          goals: [],
          forecast: forecast,
        );

        expect(result.canAfford, isTrue);
        expect(result.remainingBalance, equals(Decimal.parse('40000')));
        expect(result.forecastSafe, isTrue);
        expect(result.warning, isNull);
      });

      test('購買後餘額低於每月儲蓄預留，有警告', () {
        final goals = [
          SavingsGoalData(
            id: '1',
            name: '旅遊基金',
            targetAmount: Decimal.parse('60000'),
            currentAmount: Decimal.parse('10000'),
            monthlyReserve: Decimal.parse('5000'),
          ),
        ];

        final forecast = [
          CashflowPoint(
            date: DateTime(2026, 3, 28),
            description: '起始',
            delta: Decimal.zero,
            balance: Decimal.parse('10000'),
            isSafe: true,
          ),
        ];

        final result = PurchasingPower.check(
          amount: Decimal.parse('6000'),
          currentBalance: Decimal.parse('10000'),
          goals: goals,
          forecast: forecast,
        );

        expect(result.canAfford, isTrue);
        expect(result.remainingBalance, equals(Decimal.parse('4000')));
        // 4000 < 5000 月儲蓄預留，有警告
        expect(result.warning, isNotNull);
        expect(result.warning, contains('儲蓄目標'));
      });

      test('餘額充足但現金流會出現不足', () {
        final forecast = [
          CashflowPoint(
            date: DateTime(2026, 3, 28),
            description: '起始',
            delta: Decimal.zero,
            balance: Decimal.parse('20000'),
            isSafe: true,
          ),
          CashflowPoint(
            date: DateTime(2026, 3, 29),
            description: '大筆支出',
            delta: Decimal.parse('-18000'),
            balance: Decimal.parse('2000'),
            isSafe: true,
          ),
        ];

        final result = PurchasingPower.check(
          amount: Decimal.parse('5000'),
          currentBalance: Decimal.parse('20000'),
          goals: [],
          forecast: forecast,
        );

        expect(result.canAfford, isTrue);
        // 現金流第二天：2000 - 5000 = -3000，不安全
        expect(result.forecastSafe, isFalse);
        expect(result.warning, isNotNull);
        expect(result.warning, contains('現金流'));
      });
    });

    group('check — 空輸入', () {
      test('無儲蓄目標和現金流預測', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('1000'),
          currentBalance: Decimal.parse('5000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isTrue);
        expect(result.remainingBalance, equals(Decimal.parse('4000')));
        expect(result.forecastSafe, isTrue);
      });
    });

    group('check — 邊界值', () {
      test('購買金額為零，無法購買', () {
        final result = PurchasingPower.check(
          amount: Decimal.zero,
          currentBalance: Decimal.parse('50000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isFalse);
        expect(result.warning, contains('大於零'));
      });

      test('購買金額恰好等於餘額', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('50000'),
          currentBalance: Decimal.parse('50000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isTrue);
        expect(result.remainingBalance, equals(Decimal.zero));
      });

      test('購買金額超過餘額一分錢', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('50000.01'),
          currentBalance: Decimal.parse('50000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isFalse);
        expect(result.warning, contains('餘額不足'));
      });

      test('餘額為零', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('1'),
          currentBalance: Decimal.zero,
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isFalse);
      });
    });

    group('check — 負數情境', () {
      test('購買金額為負，無法購買', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('-1000'),
          currentBalance: Decimal.parse('50000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isFalse);
        expect(result.warning, contains('大於零'));
      });

      test('餘額為負，無法購買', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('1000'),
          currentBalance: Decimal.parse('-5000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isFalse);
        expect(result.warning, contains('餘額不足'));
      });
    });

    group('check — Decimal 精度', () {
      test('小數金額精確計算', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('99.99'),
          currentBalance: Decimal.parse('100.00'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isTrue);
        expect(result.remainingBalance, equals(Decimal.parse('0.01')));
      });

      test('極小差距精確判斷', () {
        final result = PurchasingPower.check(
          amount: Decimal.parse('1000.001'),
          currentBalance: Decimal.parse('1000.000'),
          goals: [],
          forecast: [],
        );

        expect(result.canAfford, isFalse);
      });
    });

    group('PurchaseCheckResult', () {
      test('Equatable 相等比較', () {
        final a = PurchaseCheckResult(
          canAfford: true,
          remainingBalance: Decimal.parse('1000'),
          purchaseAmount: Decimal.parse('500'),
          forecastSafe: true,
        );
        final b = PurchaseCheckResult(
          canAfford: true,
          remainingBalance: Decimal.parse('1000'),
          purchaseAmount: Decimal.parse('500'),
          forecastSafe: true,
        );

        expect(a, equals(b));
      });

      test('Equatable 不相等比較', () {
        final a = PurchaseCheckResult(
          canAfford: true,
          remainingBalance: Decimal.parse('1000'),
          purchaseAmount: Decimal.parse('500'),
          forecastSafe: true,
        );
        final b = PurchaseCheckResult(
          canAfford: false,
          remainingBalance: Decimal.parse('1000'),
          purchaseAmount: Decimal.parse('500'),
          forecastSafe: true,
        );

        expect(a, isNot(equals(b)));
      });
    });
  });
}
