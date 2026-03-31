import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 分類資料（顯示用）
class _CategoryData {
  final String name;
  final String emoji;
  final double amount;
  final Color color;

  const _CategoryData({
    required this.name,
    required this.emoji,
    required this.amount,
    required this.color,
  });
}

/// 月報表元件
/// 本月 vs 上月花費比較、各分類佔比、儲蓄目標進度
class MonthlyReport extends StatelessWidget {
  const MonthlyReport({super.key});

  static const _categoryEmojis = {
    '餐飲': '\u{1F35C}',
    '交通': '\u{1F68C}',
    '娛樂': '\u{1F3AE}',
    '購物': '\u{1F6D2}',
    '生活': '\u{1F3E0}',
    '醫療': '\u{1F3E5}',
    '教育': '\u{1F4DA}',
    '其他': '\u{1F4E6}',
  };

  static const _categoryColors = [
    AppColors.accent,
    AppColors.accentCool,
    AppColors.accentWarm,
    AppColors.success,
    AppColors.warning,
    Color(0xFF9B59B6),
    Color(0xFF3498DB),
    Color(0xFF95A5A6),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocBuilder<ExpensesBloc, ExpensesState>(
      builder: (context, expensesState) {
        return BlocBuilder<GoalsBloc, GoalsState>(
          builder: (context, goalsState) {
            final transactions = expensesState is ExpensesLoaded
                ? expensesState.transactions
                : <Transaction>[];
            final goals =
                goalsState is GoalsLoaded ? goalsState.goals : <SavingsGoal>[];

            final now = DateTime.now();

            // 本月支出
            final thisMonthExpenses = transactions.where((t) =>
                t.type == 'expense' &&
                t.date.year == now.year &&
                t.date.month == now.month);
            final thisMonthTotal = thisMonthExpenses.fold(
                0.0, (sum, t) => sum + Decimal.parse(t.amount).toDouble());

            // 上月支出
            final lastMonth =
                now.month == 1 ? DateTime(now.year - 1, 12) : DateTime(now.year, now.month - 1);
            final lastMonthExpenses = transactions.where((t) =>
                t.type == 'expense' &&
                t.date.year == lastMonth.year &&
                t.date.month == lastMonth.month);
            final lastMonthTotal = lastMonthExpenses.fold(
                0.0, (sum, t) => sum + Decimal.parse(t.amount).toDouble());

            // 分類統計
            final categoryTotals = <String, double>{};
            for (final tx in thisMonthExpenses) {
              categoryTotals[tx.category] =
                  (categoryTotals[tx.category] ?? 0) +
                      Decimal.parse(tx.amount).toDouble();
            }
            final sortedCategories = categoryTotals.entries.toList()
              ..sort((a, b) => b.value.compareTo(a.value));

            final categories = <_CategoryData>[];
            for (var i = 0; i < sortedCategories.length; i++) {
              final entry = sortedCategories[i];
              categories.add(_CategoryData(
                name: entry.key,
                emoji: _categoryEmojis[entry.key] ?? '\u{1F4E6}',
                amount: entry.value,
                color: _categoryColors[i % _categoryColors.length],
              ));
            }

            final difference = thisMonthTotal - lastMonthTotal;

            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSummaryCard(
                      isDark, thisMonthTotal, difference),
                  const SizedBox(height: AppTheme.sectionGap),
                  _buildSectionTitle(isDark, '\u{1F4CA}', '本月 vs 上月花費'),
                  const SizedBox(height: AppTheme.spacingSm),
                  _buildComparisonChart(
                      isDark, thisMonthTotal, lastMonthTotal),
                  const SizedBox(height: AppTheme.sectionGap),
                  if (categories.isNotEmpty) ...[
                    _buildSectionTitle(isDark, '\u{1F4C8}', '各分類佔比'),
                    const SizedBox(height: AppTheme.spacingSm),
                    _buildCategoryBreakdown(
                        isDark, categories, thisMonthTotal),
                    const SizedBox(height: AppTheme.sectionGap),
                  ],
                  if (goals.isNotEmpty) ...[
                    _buildSectionTitle(isDark, '\u{1F3AF}', '儲蓄目標進度'),
                    const SizedBox(height: AppTheme.spacingSm),
                    ...goals.map(
                        (g) => _buildSavingsProgress(isDark, g)),
                  ],
                  if (transactions.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppTheme.spacing2xl),
                        child: Text('尚無交易紀錄，開始記帳後將顯示月報表',
                            style: AppTextStyles.caption()),
                      ),
                    ),
                  const SizedBox(height: AppTheme.spacing2xl),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSummaryCard(
      bool isDark, double thisMonthTotal, double difference) {
    final isMore = difference > 0;
    final diffColor = isMore ? AppColors.error : AppColors.success;
    final diffText = isMore ? '多' : '少';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        gradient:
            isDark ? AppColors.darkBalanceGradient : AppColors.balanceGradient,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('本月花費摘要',
              style: AppTextStyles.bodyBold(
                color: isDark
                    ? AppColors.darkPrimaryText
                    : AppColors.primaryText,
              )),
          const SizedBox(height: AppTheme.spacingSm),
          RichText(
            text: TextSpan(
              style: AppTextStyles.body(
                color: isDark
                    ? AppColors.darkPrimaryText
                    : AppColors.primaryText,
              ),
              children: [
                const TextSpan(text: '本月你花了 '),
                TextSpan(
                  text: '\$${_formatNumber(thisMonthTotal)}',
                  style: AppTextStyles.amountMedium(
                    color: isDark ? AppColors.darkAccent : AppColors.accent,
                  ),
                ),
                if (difference.abs() > 0) ...[
                  const TextSpan(text: '，比上月'),
                  TextSpan(
                    text: '$diffText \$${_formatNumber(difference.abs())}',
                    style: AppTextStyles.bodyBold(color: diffColor),
                  ),
                  const TextSpan(text: '。'),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(bool isDark, String emoji, String title) {
    return Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 20)),
        const SizedBox(width: AppTheme.spacingSm),
        Text(title,
            style: AppTextStyles.cardTitle(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            )),
      ],
    );
  }

  Widget _buildComparisonChart(
      bool isDark, double thisMonthTotal, double lastMonthTotal) {
    final maxAmount =
        thisMonthTotal > lastMonthTotal ? thisMonthTotal : lastMonthTotal;
    if (maxAmount == 0) {
      return Container(
        padding: const EdgeInsets.all(AppTheme.cardPadding),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        ),
        child: Center(
            child: Text('尚無花費資料', style: AppTextStyles.caption())),
      );
    }

    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildBarRow(
            isDark: isDark,
            label: '上月',
            amount: lastMonthTotal,
            maxAmount: maxAmount,
            color: AppColors.accentCool,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          _buildBarRow(
            isDark: isDark,
            label: '本月',
            amount: thisMonthTotal,
            maxAmount: maxAmount,
            color: isDark ? AppColors.darkAccent : AppColors.accent,
          ),
        ],
      ),
    );
  }

  Widget _buildBarRow({
    required bool isDark,
    required String label,
    required double amount,
    required double maxAmount,
    required Color color,
  }) {
    final ratio = maxAmount > 0 ? (amount / maxAmount).clamp(0.0, 1.0) : 0.0;

    return Row(
      children: [
        SizedBox(
          width: 36,
          child: Text(label,
              style: AppTextStyles.caption(
                color: isDark
                    ? AppColors.darkSecondaryText
                    : AppColors.secondaryText,
              )),
        ),
        const SizedBox(width: AppTheme.spacingSm),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                children: [
                  Container(
                    height: 28,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  Container(
                    height: 28,
                    width: constraints.maxWidth * ratio,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: AppTheme.spacingSm),
                    child: Text(
                      '\$${_formatNumber(amount)}',
                      style: AppTextStyles.label(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryBreakdown(
      bool isDark, List<_CategoryData> categories, double total) {
    if (total == 0) return const SizedBox.shrink();

    // 計算圓餅圖 stops
    final stops = <double>[0.0];
    final colors = <Color>[];
    for (final cat in categories) {
      final ratio = cat.amount / total;
      colors.add(cat.color);
      colors.add(cat.color);
      stops.add(stops.last);
      stops.add(stops.last + ratio);
    }
    // 確保最後一個 stop 是 1.0
    if (stops.last < 1.0) stops.add(1.0);
    if (colors.length < stops.length) colors.add(colors.last);

    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // 圓餅圖
          SizedBox(
            width: 140,
            height: 140,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: SweepGradient(
                      colors: colors,
                      stops: stops.length == colors.length ? stops : null,
                    ),
                  ),
                ),
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurface : AppColors.surface,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '\$${_formatNumber(total)}',
                    style: AppTextStyles.bodyBold(
                      color: isDark
                          ? AppColors.darkPrimaryText
                          : AppColors.primaryText,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingMd),
          ...categories.map((cat) {
            final percentage = (cat.amount / total * 100).toInt();
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingXs),
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: cat.color,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(cat.emoji, style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: AppTheme.spacingXs),
                  Expanded(
                    child: Text(cat.name,
                        style: AppTextStyles.body(
                          color: isDark
                              ? AppColors.darkPrimaryText
                              : AppColors.primaryText,
                        )),
                  ),
                  Text('\$${_formatNumber(cat.amount)}',
                      style: AppTextStyles.bodyBold(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      )),
                  const SizedBox(width: AppTheme.spacingSm),
                  SizedBox(
                    width: 40,
                    child: Text('$percentage%',
                        textAlign: TextAlign.end,
                        style: AppTextStyles.caption(
                          color: isDark
                              ? AppColors.darkSecondaryText
                              : AppColors.secondaryText,
                        )),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSavingsProgress(bool isDark, SavingsGoal goal) {
    final target = Decimal.parse(goal.targetAmount);
    final current = Decimal.parse(goal.currentAmount);
    final progress =
        target > Decimal.zero ? (current / target).toDouble() : 0.0;

    final progressColor = progress >= 0.7
        ? AppColors.success
        : progress >= 0.4
            ? AppColors.warning
            : AppColors.accent;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.cardGap),
      child: Container(
        padding: const EdgeInsets.all(AppTheme.cardPadding),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.cardRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(goal.emoji, style: const TextStyle(fontSize: 20)),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(goal.name,
                      style: AppTextStyles.bodyBold(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      )),
                ),
                Text('${(progress * 100).toInt()}%',
                    style: AppTextStyles.bodyBold(color: progressColor)),
              ],
            ),
            const SizedBox(height: AppTheme.spacingSm),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: progressColor.withValues(alpha: 0.15),
                valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                minHeight: 8,
              ),
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              '\$${_formatNumber(current.toDouble())} / \$${_formatNumber(target.toDouble())}',
              style: AppTextStyles.caption(
                color: isDark
                    ? AppColors.darkSecondaryText
                    : AppColors.secondaryText,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatNumber(double value) {
    final intPart = value.toInt().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) buffer.write(',');
      buffer.write(intPart[i]);
    }
    return buffer.toString();
  }
}
