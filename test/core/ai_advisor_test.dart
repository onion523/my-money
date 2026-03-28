import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/ai_advisor.dart';
import 'package:my_money/core/pattern_analyzer.dart';

void main() {
  group('AiAdvisor', () {
    group('有模式 + 有目標差距', () {
      test('週期性咖啡消費 + 旅遊目標差距 → 產生「少喝咖啡」建議', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.weeklyRecurring,
            description: '每週三咖啡 \$150',
            category: '咖啡',
            averageAmount: Decimal.parse('150'),
            occurrences: 5,
            dayOfWeek: 3,
          ),
        ];

        // 設計目標差距使節省咖啡能明顯縮短月數
        // 每週少喝 2 杯 → 月省 150*2*4 = 1200
        // remaining=20000, monthlyReserve=2000 → 原需 10 個月
        // 加上 1200 → 3200/月 → ceil(20000/3200)=7 個月 → 省 3 個月
        final goals = [
          GoalGap(
            name: '泰國旅費',
            targetAmount: Decimal.parse('30000'),
            currentAmount: Decimal.parse('10000'),
            monthlyReserve: Decimal.parse('2000'),
            deadline: DateTime(2027, 12, 31),
          ),
        ];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('50000'),
        );

        expect(suggestions, isNotEmpty);

        // 應有咖啡相關的節省建議
        final coffeeSuggestion = suggestions
            .where((s) => s.category == '咖啡')
            .toList();
        expect(coffeeSuggestion, isNotEmpty);
        expect(coffeeSuggestion.first.text, contains('少喝'));
        expect(coffeeSuggestion.first.text, contains('咖啡'));
        expect(coffeeSuggestion.first.impact, greaterThan(Decimal.zero));
      });

      test('建議文字包含具體金額', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.weeklyRecurring,
            description: '每週三咖啡 \$150',
            category: '咖啡',
            averageAmount: Decimal.parse('150'),
            occurrences: 5,
            dayOfWeek: 3,
          ),
        ];

        final goals = [
          GoalGap(
            name: '京都旅費',
            targetAmount: Decimal.parse('50000'),
            currentAmount: Decimal.parse('20000'),
            monthlyReserve: Decimal.parse('5000'),
            deadline: DateTime(2026, 10, 31),
          ),
        ];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('100000'),
        );

        // 建議文字應包含金額符號
        final coffeeSuggestion = suggestions
            .where((s) => s.category == '咖啡')
            .first;
        expect(coffeeSuggestion.text, contains('\$'));
      });

      test('建議文字包含目標名稱和時間', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.weeklyRecurring,
            description: '每週三咖啡 \$150',
            category: '咖啡',
            averageAmount: Decimal.parse('150'),
            occurrences: 5,
            dayOfWeek: 3,
          ),
        ];

        final goals = [
          GoalGap(
            name: '泰國旅費',
            targetAmount: Decimal.parse('30000'),
            currentAmount: Decimal.parse('10000'),
            monthlyReserve: Decimal.parse('5000'),
            deadline: DateTime(2026, 12, 31),
          ),
        ];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('50000'),
        );

        // 應有包含目標名稱的建議
        final goalRelated = suggestions
            .where((s) => s.text.contains('泰國旅費'))
            .toList();
        expect(goalRelated, isNotEmpty);
      });

      test('分類集中度高 + 目標差距 → 產生控制建議', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.categoryConcentration,
            description: '娛樂佔花費 45%',
            category: '娛樂',
            averageAmount: Decimal.parse('9000'),
            occurrences: 10,
            percentage: 45,
          ),
        ];

        final goals = [
          GoalGap(
            name: '旅遊基金',
            targetAmount: Decimal.parse('50000'),
            currentAmount: Decimal.parse('10000'),
            monthlyReserve: Decimal.parse('5000'),
          ),
        ];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('80000'),
        );

        final entertainmentSuggestion = suggestions
            .where((s) => s.category == '娛樂')
            .toList();
        expect(entertainmentSuggestion, isNotEmpty);
        expect(entertainmentSuggestion.first.text, contains('娛樂'));
        expect(entertainmentSuggestion.first.text, contains('控制'));
      });
    });

    group('有模式 + 無目標差距', () {
      test('有消費模式但無目標 → 只產生觀察性建議', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.weeklyRecurring,
            description: '每週三咖啡 \$150',
            category: '咖啡',
            averageAmount: Decimal.parse('150'),
            occurrences: 5,
            dayOfWeek: 3,
          ),
        ];

        // 無目標差距
        final goals = <GoalGap>[];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('50000'),
        );

        expect(suggestions, isNotEmpty);

        // 建議應為低優先級的觀察性質
        final coffeeSuggestion = suggestions
            .where((s) => s.category == '咖啡')
            .first;
        expect(coffeeSuggestion.priority, equals(SuggestionPriority.low));
        expect(coffeeSuggestion.impact, equals(Decimal.zero));
      });

      test('所有目標已達成 → 只產生觀察性建議', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.monthlyRecurring,
            description: '每月 Uber Eats ~\$3000',
            category: '餐飲',
            averageAmount: Decimal.parse('3000'),
            occurrences: 3,
          ),
        ];

        // 目標已達成（currentAmount >= targetAmount）
        final goals = [
          GoalGap(
            name: '已達成目標',
            targetAmount: Decimal.parse('10000'),
            currentAmount: Decimal.parse('10000'),
            monthlyReserve: Decimal.parse('5000'),
          ),
        ];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('50000'),
        );

        expect(suggestions, isNotEmpty);

        // 無活躍目標差距 → 觀察性建議
        final dining = suggestions
            .where((s) => s.category == '餐飲')
            .first;
        expect(dining.priority, equals(SuggestionPriority.low));
      });
    });

    group('無模式', () {
      test('空模式清單 → 回傳空建議', () {
        final suggestions = AiAdvisor.generateSuggestions(
          patterns: [],
          goals: [
            GoalGap(
              name: '旅遊',
              targetAmount: Decimal.parse('50000'),
              currentAmount: Decimal.parse('10000'),
              monthlyReserve: Decimal.parse('5000'),
            ),
          ],
          balance: Decimal.parse('50000'),
        );

        expect(suggestions, isEmpty);
      });
    });

    group('進度預測建議', () {
      test('有期限目標 → 產生預計完成時間建議', () {
        final patterns = [
          ConsumptionPattern(
            type: PatternType.weeklyRecurring,
            description: '每週三咖啡 \$150',
            category: '咖啡',
            averageAmount: Decimal.parse('150'),
            occurrences: 5,
            dayOfWeek: 3,
          ),
        ];

        final goals = [
          GoalGap(
            name: '京都旅費',
            targetAmount: Decimal.parse('50000'),
            currentAmount: Decimal.parse('34000'),
            monthlyReserve: Decimal.parse('5000'),
            deadline: DateTime(2026, 10, 31),
          ),
        ];

        final suggestions = AiAdvisor.generateSuggestions(
          patterns: patterns,
          goals: goals,
          balance: Decimal.parse('100000'),
        );

        // 應有儲蓄目標進度預測
        final progressSuggestion = suggestions
            .where((s) => s.category == '儲蓄目標')
            .toList();
        expect(progressSuggestion, isNotEmpty);
        expect(progressSuggestion.first.text, contains('京都旅費'));
        expect(progressSuggestion.first.text, contains('月'));
      });
    });

    group('GoalGap 計算', () {
      test('monthsNeeded 正確計算', () {
        final goal = GoalGap(
          name: '旅遊',
          targetAmount: Decimal.parse('30000'),
          currentAmount: Decimal.parse('10000'),
          monthlyReserve: Decimal.parse('5000'),
        );

        // 剩 20000 / 每月 5000 = 4 個月
        expect(goal.remaining, equals(Decimal.parse('20000')));
        expect(goal.monthsNeeded, equals(4));
      });

      test('monthlyReserve 為零 → monthsNeeded 為 -1', () {
        final goal = GoalGap(
          name: '旅遊',
          targetAmount: Decimal.parse('30000'),
          currentAmount: Decimal.parse('10000'),
          monthlyReserve: Decimal.zero,
        );

        expect(goal.monthsNeeded, equals(-1));
      });
    });
  });
}
