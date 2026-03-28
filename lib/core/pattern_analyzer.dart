import 'package:decimal/decimal.dart';

/// 消費模式類型
enum PatternType {
  /// 每週重複消費（例：每週三咖啡）
  weeklyRecurring,

  /// 每月重複消費（例：每月 Uber Eats）
  monthlyRecurring,

  /// 分類集中（例：餐飲佔 45%）
  categoryConcentration,
}

/// 消費模式資料模型
class ConsumptionPattern {
  /// 模式類型
  final PatternType type;

  /// 模式描述（繁體中文）
  final String description;

  /// 相關分類
  final String category;

  /// 平均金額
  final Decimal averageAmount;

  /// 出現次數
  final int occurrences;

  /// 佔總花費百分比（僅 categoryConcentration 使用）
  final double? percentage;

  /// 週幾出現（僅 weeklyRecurring 使用，1=週一 ~ 7=週日）
  final int? dayOfWeek;

  const ConsumptionPattern({
    required this.type,
    required this.description,
    required this.category,
    required this.averageAmount,
    required this.occurrences,
    this.percentage,
    this.dayOfWeek,
  });
}

/// 交易資料（分析用，與資料庫模型解耦）
class TransactionData {
  /// 交易金額
  final Decimal amount;

  /// 交易日期
  final DateTime date;

  /// 分類
  final String category;

  /// 備註
  final String note;

  /// 交易類型：expense / income / transfer
  final String type;

  const TransactionData({
    required this.amount,
    required this.date,
    required this.category,
    required this.note,
    required this.type,
  });
}

/// 消費模式分析引擎 — 從交易紀錄中找出週期性消費模式
class PatternAnalyzer {
  /// 週幾的中文名稱對照
  static const _weekdayNames = {
    1: '一',
    2: '二',
    3: '三',
    4: '四',
    5: '五',
    6: '六',
    7: '日',
  };

  /// 分析交易紀錄找出週期性消費模式
  ///
  /// [transactions] 交易紀錄清單
  /// [minCount] 最低交易筆數門檻，不足則回傳空列表
  ///
  /// 偵測三種模式：
  /// - 每週重複消費（同一分類 + 相同週幾 + 出現 3 次以上）
  /// - 每月重複消費（同一分類 + 備註相似 + 每月出現）
  /// - 分類集中度（單一分類佔總花費 30% 以上）
  static List<ConsumptionPattern> detectPatterns(
    List<TransactionData> transactions, {
    int minCount = 30,
  }) {
    // 交易不足最低門檻 → 無法分析，回傳空列表
    if (transactions.length < minCount) return [];

    // 只分析支出交易
    final expenses = transactions
        .where((t) => t.type == 'expense')
        .toList();

    if (expenses.isEmpty) return [];

    final patterns = <ConsumptionPattern>[];

    // 偵測每週重複消費
    patterns.addAll(_detectWeeklyPatterns(expenses));

    // 偵測每月重複消費
    patterns.addAll(_detectMonthlyPatterns(expenses));

    // 偵測分類集中度
    patterns.addAll(_detectCategoryConcentration(expenses));

    return patterns;
  }

  /// 偵測每週重複消費模式
  ///
  /// 邏輯：按分類 + 週幾分組，同一組合出現 3 次以上視為模式
  static List<ConsumptionPattern> _detectWeeklyPatterns(
    List<TransactionData> expenses,
  ) {
    final patterns = <ConsumptionPattern>[];

    // 按（分類, 週幾）分組
    final grouped = <String, List<TransactionData>>{};
    for (final tx in expenses) {
      final key = '${tx.category}_${tx.date.weekday}';
      grouped.putIfAbsent(key, () => []).add(tx);
    }

    for (final entry in grouped.entries) {
      final txList = entry.value;
      // 至少出現 3 次才視為週期性
      if (txList.length < 3) continue;

      final category = txList.first.category;
      final weekday = txList.first.date.weekday;
      final total = txList.fold(
        Decimal.zero,
        (sum, tx) => sum + tx.amount,
      );
      final average = (total / Decimal.fromInt(txList.length)).toDecimal(
        scaleOnInfinitePrecision: 0,
      );

      final weekdayName = _weekdayNames[weekday] ?? '$weekday';

      patterns.add(ConsumptionPattern(
        type: PatternType.weeklyRecurring,
        description: '每週$weekdayName$category \$$average',
        category: category,
        averageAmount: average,
        occurrences: txList.length,
        dayOfWeek: weekday,
      ));
    }

    return patterns;
  }

  /// 偵測每月重複消費模式
  ///
  /// 邏輯：按分類 + 備註分組，橫跨 2 個以上不同月份視為模式
  static List<ConsumptionPattern> _detectMonthlyPatterns(
    List<TransactionData> expenses,
  ) {
    final patterns = <ConsumptionPattern>[];

    // 按（分類, 備註）分組
    final grouped = <String, List<TransactionData>>{};
    for (final tx in expenses) {
      if (tx.note.isEmpty) continue;
      final key = '${tx.category}_${tx.note}';
      grouped.putIfAbsent(key, () => []).add(tx);
    }

    for (final entry in grouped.entries) {
      final txList = entry.value;

      // 計算橫跨幾個不同月份
      final months = txList
          .map((tx) => '${tx.date.year}-${tx.date.month}')
          .toSet();

      // 至少橫跨 2 個月
      if (months.length < 2) continue;

      final category = txList.first.category;
      final note = txList.first.note;
      final total = txList.fold(
        Decimal.zero,
        (sum, tx) => sum + tx.amount,
      );
      final average = (total / Decimal.fromInt(txList.length)).toDecimal(
        scaleOnInfinitePrecision: 0,
      );

      patterns.add(ConsumptionPattern(
        type: PatternType.monthlyRecurring,
        description: '每月 $note ~\$$average',
        category: category,
        averageAmount: average,
        occurrences: txList.length,
      ));
    }

    return patterns;
  }

  /// 偵測分類集中度
  ///
  /// 邏輯：單一分類佔總支出 30% 以上
  static List<ConsumptionPattern> _detectCategoryConcentration(
    List<TransactionData> expenses,
  ) {
    final patterns = <ConsumptionPattern>[];

    final totalExpense = expenses.fold(
      Decimal.zero,
      (sum, tx) => sum + tx.amount,
    );

    if (totalExpense == Decimal.zero) return [];

    // 按分類加總
    final categoryTotals = <String, Decimal>{};
    final categoryCounts = <String, int>{};
    for (final tx in expenses) {
      categoryTotals[tx.category] =
          (categoryTotals[tx.category] ?? Decimal.zero) + tx.amount;
      categoryCounts[tx.category] =
          (categoryCounts[tx.category] ?? 0) + 1;
    }

    for (final entry in categoryTotals.entries) {
      final ratio = (entry.value / totalExpense).toDouble();
      final percentage = (ratio * 100).roundToDouble();

      // 30% 以上視為集中
      if (percentage >= 30) {
        patterns.add(ConsumptionPattern(
          type: PatternType.categoryConcentration,
          description: '${entry.key}佔花費 ${percentage.toInt()}%',
          category: entry.key,
          averageAmount: entry.value,
          occurrences: categoryCounts[entry.key] ?? 0,
          percentage: percentage,
        ));
      }
    }

    return patterns;
  }
}
