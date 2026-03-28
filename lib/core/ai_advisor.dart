import 'package:decimal/decimal.dart';

import 'pattern_analyzer.dart';

/// 建議優先級
enum SuggestionPriority {
  /// 高優先：可立即產生明顯影響
  high,

  /// 中優先：值得注意
  medium,

  /// 低優先：觀察性建議
  low,
}

/// AI 節省建議資料模型
class Suggestion {
  /// 建議文字（繁體中文台灣用語）
  final String text;

  /// 預估影響金額（每月可節省的金額）
  final Decimal impact;

  /// 相關分類
  final String category;

  /// 優先級
  final SuggestionPriority priority;

  const Suggestion({
    required this.text,
    required this.impact,
    required this.category,
    required this.priority,
  });
}

/// 儲蓄目標差距資料（計算用）
class GoalGap {
  /// 目標名稱
  final String name;

  /// 目標金額
  final Decimal targetAmount;

  /// 目前已存金額
  final Decimal currentAmount;

  /// 每月預留金額
  final Decimal monthlyReserve;

  /// 目標期限（可為空）
  final DateTime? deadline;

  const GoalGap({
    required this.name,
    required this.targetAmount,
    required this.currentAmount,
    required this.monthlyReserve,
    this.deadline,
  });

  /// 剩餘需存金額
  Decimal get remaining => targetAmount - currentAmount;

  /// 按目前速度還需幾個月
  int get monthsNeeded {
    if (monthlyReserve <= Decimal.zero) return -1;
    final months = (remaining / monthlyReserve).toDouble();
    return months.ceil();
  }
}

/// AI 節省建議引擎 — 結合消費模式與儲蓄目標差距，產生可操作的建議
///
/// 所有建議文字使用繁體中文台灣用語
class AiAdvisor {
  /// 產生節省建議
  ///
  /// [patterns] 消費模式清單（來自 PatternAnalyzer）
  /// [goals] 儲蓄目標差距清單
  /// [balance] 目前可用餘額
  ///
  /// 回傳依優先級排序的建議清單
  static List<Suggestion> generateSuggestions({
    required List<ConsumptionPattern> patterns,
    required List<GoalGap> goals,
    required Decimal balance,
  }) {
    // 無消費模式 → 無法產生建議
    if (patterns.isEmpty) return [];

    final suggestions = <Suggestion>[];

    // 有目標差距 → 產生節省 + 目標關聯建議
    final activeGoals = goals
        .where((g) => g.remaining > Decimal.zero)
        .toList();

    // 針對週期性消費產生節省建議
    for (final pattern in patterns) {
      if (pattern.type == PatternType.weeklyRecurring) {
        suggestions.addAll(
          _generateWeeklySavingSuggestions(pattern, activeGoals),
        );
      } else if (pattern.type == PatternType.monthlyRecurring) {
        suggestions.addAll(
          _generateMonthlySavingSuggestions(pattern, activeGoals),
        );
      } else if (pattern.type == PatternType.categoryConcentration) {
        suggestions.addAll(
          _generateConcentrationSuggestions(pattern, balance),
        );
      }
    }

    // 針對有期限目標產生進度預測建議
    for (final goal in activeGoals) {
      if (goal.deadline != null && goal.monthlyReserve > Decimal.zero) {
        suggestions.add(_generateProgressSuggestion(goal));
      }
    }

    // 按優先級排序（高 → 低）
    suggestions.sort((a, b) => a.priority.index.compareTo(b.priority.index));

    return suggestions;
  }

  /// 針對每週重複消費產生節省建議
  ///
  /// 例：「每週少喝 2 杯咖啡（省 $300），泰國旅費可提早 1 個月存滿」
  static List<Suggestion> _generateWeeklySavingSuggestions(
    ConsumptionPattern pattern,
    List<GoalGap> goals,
  ) {
    final suggestions = <Suggestion>[];
    // 假設每週減少 2 次
    final reduceTimes = 2;
    final weeklyReduction = pattern.averageAmount * Decimal.fromInt(reduceTimes);
    final monthlySaving = weeklyReduction * Decimal.fromInt(4);

    if (goals.isNotEmpty) {
      // 找最接近完成的目標
      final nearestGoal = _findNearestGoal(goals);

      // 計算提早幾個月
      final currentMonths = nearestGoal.monthsNeeded;
      final newMonthlyReserve = nearestGoal.monthlyReserve + monthlySaving;
      final newMonths = newMonthlyReserve > Decimal.zero
          ? (nearestGoal.remaining / newMonthlyReserve).toDouble().ceil()
          : currentMonths;
      final savedMonths = currentMonths - newMonths;

      if (savedMonths > 0) {
        suggestions.add(Suggestion(
          text: '每週少喝 $reduceTimes 杯${pattern.category}'
              '（省 \$$monthlySaving），'
              '${nearestGoal.name}可提早 $savedMonths 個月存滿',
          impact: monthlySaving,
          category: pattern.category,
          priority: SuggestionPriority.high,
        ));
      } else {
        suggestions.add(Suggestion(
          text: '每週少 $reduceTimes 次${pattern.category}'
              '，每月可省 \$$monthlySaving',
          impact: monthlySaving,
          category: pattern.category,
          priority: SuggestionPriority.medium,
        ));
      }
    } else {
      // 無目標差距 → 觀察性建議
      suggestions.add(Suggestion(
        text: '每週${pattern.category}消費約 \$${pattern.averageAmount}，'
            '每月合計約 \$${pattern.averageAmount * Decimal.fromInt(4)}',
        impact: Decimal.zero,
        category: pattern.category,
        priority: SuggestionPriority.low,
      ));
    }

    return suggestions;
  }

  /// 針對每月重複消費產生節省建議
  static List<Suggestion> _generateMonthlySavingSuggestions(
    ConsumptionPattern pattern,
    List<GoalGap> goals,
  ) {
    final suggestions = <Suggestion>[];

    if (goals.isNotEmpty) {
      final nearestGoal = _findNearestGoal(goals);
      // 建議減少 30% 的月度重複消費
      final reduction = pattern.averageAmount *
              Decimal.parse('0.3');

      suggestions.add(Suggestion(
        text: '${pattern.description}，'
            '若減少 30% 可省 \$$reduction，'
            '加速${nearestGoal.name}進度',
        impact: reduction,
        category: pattern.category,
        priority: SuggestionPriority.medium,
      ));
    } else {
      suggestions.add(Suggestion(
        text: '${pattern.description}，為固定月支出',
        impact: Decimal.zero,
        category: pattern.category,
        priority: SuggestionPriority.low,
      ));
    }

    return suggestions;
  }

  /// 針對分類集中度產生建議
  ///
  /// 例：「本月娛樂花費超過均值 40%，建議控制在 $3,000 以內」
  static List<Suggestion> _generateConcentrationSuggestions(
    ConsumptionPattern pattern,
    Decimal balance,
  ) {
    final suggestions = <Suggestion>[];
    final pct = pattern.percentage ?? 0;

    // 超過 40% 視為需要注意
    if (pct >= 40) {
      // 建議控制在目前的 70%
      final suggested = pattern.averageAmount *
              Decimal.parse('0.7');
      final saving = pattern.averageAmount - suggested;

      suggestions.add(Suggestion(
        text: '${pattern.category}花費佔總支出 ${pct.toInt()}%，'
            '建議控制在 \$$suggested 以內',
        impact: saving,
        category: pattern.category,
        priority: SuggestionPriority.high,
      ));
    } else {
      suggestions.add(Suggestion(
        text: '${pattern.description}，屬正常範圍',
        impact: Decimal.zero,
        category: pattern.category,
        priority: SuggestionPriority.low,
      ));
    }

    return suggestions;
  }

  /// 產生儲蓄進度預測建議
  ///
  /// 例：「照目前速度，京都旅費 9 月中能存滿」
  static Suggestion _generateProgressSuggestion(GoalGap goal) {
    final monthsNeeded = goal.monthsNeeded;
    final now = DateTime.now();
    final completionDate = DateTime(
      now.year,
      now.month + monthsNeeded,
      15, // 月中
    );

    final monthName = '${completionDate.month} 月';

    // 檢查是否能在期限內完成
    if (goal.deadline != null &&
        completionDate.isAfter(goal.deadline!)) {
      final deficit = goal.remaining -
          (goal.monthlyReserve *
              Decimal.fromInt(
                _monthsBetween(now, goal.deadline!),
              ));

      return Suggestion(
        text: '照目前速度，${goal.name}無法在期限內存滿，'
            '還差 \$$deficit',
        impact: deficit > Decimal.zero ? deficit : Decimal.zero,
        category: '儲蓄目標',
        priority: SuggestionPriority.high,
      );
    }

    return Suggestion(
      text: '照目前速度，${goal.name}預計$monthName中能存滿',
      impact: Decimal.zero,
      category: '儲蓄目標',
      priority: SuggestionPriority.low,
    );
  }

  /// 找最接近完成的目標（剩餘金額最少）
  static GoalGap _findNearestGoal(List<GoalGap> goals) {
    return goals.reduce((a, b) => a.remaining < b.remaining ? a : b);
  }

  /// 計算兩個日期之間的月數
  static int _monthsBetween(DateTime from, DateTime to) {
    return (to.year - from.year) * 12 + (to.month - from.month);
  }
}
