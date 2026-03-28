import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/pattern_analyzer.dart';

void main() {
  group('PatternAnalyzer', () {
    /// 產生指定數量的基本交易資料（填充用，無明顯模式）
    List<TransactionData> _generateFillerTransactions(int count) {
      final categories = ['交通', '日用品', '服飾', '醫療', '通訊'];
      return List.generate(count, (i) {
        return TransactionData(
          amount: Decimal.parse('${100 + i * 10}'),
          date: DateTime(2026, 1, 1).add(Duration(days: i)),
          category: categories[i % categories.length],
          note: '雜項 $i',
          type: 'expense',
        );
      });
    }

    group('偵測週期性消費 — 每週重複', () {
      test('每週三出現咖啡消費 → 偵測為 weeklyRecurring', () {
        // 建立 30 筆填充交易
        final filler = _generateFillerTransactions(25);

        // 加入 5 筆「每週三咖啡」交易
        final coffeeTransactions = List.generate(5, (i) {
          // 從 2026-01-07（週三）開始，每隔 7 天
          final date = DateTime(2026, 1, 7).add(Duration(days: i * 7));
          return TransactionData(
            amount: Decimal.parse('150'),
            date: date,
            category: '咖啡',
            note: '星巴克',
            type: 'expense',
          );
        });

        final transactions = [...filler, ...coffeeTransactions];

        final patterns = PatternAnalyzer.detectPatterns(transactions);

        // 應該偵測到咖啡的週期性模式
        final weeklyPatterns = patterns
            .where((p) => p.type == PatternType.weeklyRecurring)
            .where((p) => p.category == '咖啡')
            .toList();

        expect(weeklyPatterns, isNotEmpty);
        expect(weeklyPatterns.first.dayOfWeek, equals(DateTime.wednesday));
        expect(weeklyPatterns.first.averageAmount, equals(Decimal.parse('150')));
        expect(weeklyPatterns.first.description, contains('週三'));
        expect(weeklyPatterns.first.description, contains('咖啡'));
      });
    });

    group('偵測月度消費 — 每月重複', () {
      test('Uber Eats 每月出現 → 偵測為 monthlyRecurring', () {
        final filler = _generateFillerTransactions(25);

        // 加入 3 筆「每月 Uber Eats」交易（跨 3 個月）
        final uberTransactions = [
          TransactionData(
            amount: Decimal.parse('2800'),
            date: DateTime(2026, 1, 15),
            category: '餐飲',
            note: 'Uber Eats',
            type: 'expense',
          ),
          TransactionData(
            amount: Decimal.parse('3200'),
            date: DateTime(2026, 2, 12),
            category: '餐飲',
            note: 'Uber Eats',
            type: 'expense',
          ),
          TransactionData(
            amount: Decimal.parse('3000'),
            date: DateTime(2026, 3, 18),
            category: '餐飲',
            note: 'Uber Eats',
            type: 'expense',
          ),
        ];

        final transactions = [...filler, ...uberTransactions];

        final patterns = PatternAnalyzer.detectPatterns(
          transactions,
          minCount: 28,
        );

        final monthlyPatterns = patterns
            .where((p) => p.type == PatternType.monthlyRecurring)
            .where((p) => p.description.contains('Uber Eats'))
            .toList();

        expect(monthlyPatterns, isNotEmpty);
        expect(monthlyPatterns.first.category, equals('餐飲'));
        expect(monthlyPatterns.first.description, contains('每月'));
        expect(monthlyPatterns.first.description, contains('Uber Eats'));
      });
    });

    group('偵測分類集中', () {
      test('餐飲佔花費超過 30% → 偵測為 categoryConcentration', () {
        // 建立 15 筆小額非餐飲交易
        final others = List.generate(15, (i) {
          return TransactionData(
            amount: Decimal.parse('100'),
            date: DateTime(2026, 1, 1).add(Duration(days: i)),
            category: '交通',
            note: '捷運',
            type: 'expense',
          );
        });

        // 建立 15 筆大額餐飲交易（確保佔比超過 30%）
        final dining = List.generate(15, (i) {
          return TransactionData(
            amount: Decimal.parse('500'),
            date: DateTime(2026, 1, 1).add(Duration(days: i)),
            category: '餐飲',
            note: '午餐',
            type: 'expense',
          );
        });

        final transactions = [...others, ...dining];
        // 總花費 = 15*100 + 15*500 = 1500 + 7500 = 9000
        // 餐飲佔 7500/9000 ≈ 83%

        final patterns = PatternAnalyzer.detectPatterns(transactions);

        final concentrationPatterns = patterns
            .where((p) => p.type == PatternType.categoryConcentration)
            .where((p) => p.category == '餐飲')
            .toList();

        expect(concentrationPatterns, isNotEmpty);
        expect(concentrationPatterns.first.percentage!, greaterThanOrEqualTo(30));
        expect(concentrationPatterns.first.description, contains('餐飲'));
        expect(concentrationPatterns.first.description, contains('%'));
      });
    });

    group('不足最低筆數', () {
      test('不足 30 筆（預設門檻）→ 回傳空結果', () {
        final transactions = List.generate(29, (i) {
          return TransactionData(
            amount: Decimal.parse('100'),
            date: DateTime(2026, 1, 1).add(Duration(days: i)),
            category: '餐飲',
            note: '午餐',
            type: 'expense',
          );
        });

        final patterns = PatternAnalyzer.detectPatterns(transactions);

        expect(patterns, isEmpty);
      });

      test('自訂門檻 50 筆，只有 40 筆 → 空結果', () {
        final transactions = _generateFillerTransactions(40);

        final patterns = PatternAnalyzer.detectPatterns(
          transactions,
          minCount: 50,
        );

        expect(patterns, isEmpty);
      });
    });

    group('無明顯模式', () {
      test('交易分散無規律 → 無週期性模式', () {
        // 30 筆交易，每筆不同分類不同日期，不會有週期性
        final transactions = List.generate(30, (i) {
          return TransactionData(
            amount: Decimal.parse('${100 + i * 7}'),
            date: DateTime(2026, 1, 1).add(Duration(days: i)),
            category: '分類$i',
            note: '備註$i',
            type: 'expense',
          );
        });

        final patterns = PatternAnalyzer.detectPatterns(transactions);

        // 不應有週期性或月度模式（每個分類只出現一次）
        final weeklyPatterns = patterns
            .where((p) => p.type == PatternType.weeklyRecurring)
            .toList();
        final monthlyPatterns = patterns
            .where((p) => p.type == PatternType.monthlyRecurring)
            .toList();

        expect(weeklyPatterns, isEmpty);
        expect(monthlyPatterns, isEmpty);
      });

      test('全部是收入交易 → 空結果', () {
        final transactions = List.generate(30, (i) {
          return TransactionData(
            amount: Decimal.parse('50000'),
            date: DateTime(2026, 1, 1).add(Duration(days: i)),
            category: '薪資',
            note: '月薪',
            type: 'income',
          );
        });

        final patterns = PatternAnalyzer.detectPatterns(transactions);

        expect(patterns, isEmpty);
      });
    });
  });
}
