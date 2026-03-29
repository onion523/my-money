import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 月報表分類資料
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
/// 本月 vs 上月花費比較、各分類佔比、儲蓄目標進度、文字摘要
class MonthlyReport extends StatelessWidget {
  const MonthlyReport({super.key});

  // ========== Mock 資料 ==========

  /// 本月花費
  static const _thisMonthTotal = 18500.0;

  /// 上月花費
  static const _lastMonthTotal = 16200.0;

  /// 本月 vs 上月差額
  static const _difference = _thisMonthTotal - _lastMonthTotal;

  /// 儲蓄目標進度
  static const _savingsProgress = 0.68;
  static const _savingsGoalName = '日本旅遊基金';

  /// 各分類花費 Mock 資料
  static const _categories = [
    _CategoryData(
      name: '餐飲',
      emoji: '\u{1F35C}',
      amount: 6500,
      color: AppColors.accent,
    ),
    _CategoryData(
      name: '交通',
      emoji: '\u{1F68C}',
      amount: 3200,
      color: AppColors.accentCool,
    ),
    _CategoryData(
      name: '娛樂',
      emoji: '\u{1F3AE}',
      amount: 4100,
      color: AppColors.accentWarm,
    ),
    _CategoryData(
      name: '日用品',
      emoji: '\u{1F6D2}',
      amount: 2800,
      color: AppColors.success,
    ),
    _CategoryData(
      name: '其他',
      emoji: '\u{1F4E6}',
      amount: 1900,
      color: AppColors.warning,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ========== 文字摘要 ==========
          _buildSummaryCard(isDark),

          const SizedBox(height: AppTheme.sectionGap),

          // ========== 本月 vs 上月比較 ==========
          _buildSectionTitle(isDark, '\u{1F4CA}', '本月 vs 上月花費'),
          const SizedBox(height: AppTheme.spacingSm),
          _buildComparisonChart(isDark),

          const SizedBox(height: AppTheme.sectionGap),

          // ========== 各分類佔比 ==========
          _buildSectionTitle(isDark, '\u{1F4C8}', '各分類佔比'),
          const SizedBox(height: AppTheme.spacingSm),
          _buildCategoryBreakdown(isDark),

          const SizedBox(height: AppTheme.sectionGap),

          // ========== 儲蓄目標進度 ==========
          _buildSectionTitle(isDark, '\u{1F3AF}', '儲蓄目標進度'),
          const SizedBox(height: AppTheme.spacingSm),
          _buildSavingsProgress(isDark),

          const SizedBox(height: AppTheme.spacing2xl),
        ],
      ),
    );
  }

  /// 文字摘要卡片
  Widget _buildSummaryCard(bool isDark) {
    final isMore = _difference > 0;
    final diffColor = isMore ? AppColors.error : AppColors.success;
    final diffText = isMore ? '多' : '少';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        gradient: isDark
            ? AppColors.darkBalanceGradient
            : AppColors.balanceGradient,
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
          Text(
            '本月花費摘要',
            style: AppTextStyles.bodyBold(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),
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
                  text: '\$${_formatNumber(_thisMonthTotal)}',
                  style: AppTextStyles.amountMedium(
                    color: isDark ? AppColors.darkAccent : AppColors.accent,
                  ),
                ),
                const TextSpan(text: '，比上月'),
                TextSpan(
                  text: '$diffText \$${_formatNumber(_difference.abs())}',
                  style: AppTextStyles.bodyBold(color: diffColor),
                ),
                const TextSpan(text: '。'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 區塊標題
  Widget _buildSectionTitle(bool isDark, String emoji, String title) {
    return Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 20)),
        const SizedBox(width: AppTheme.spacingSm),
        Text(
          title,
          style: AppTextStyles.cardTitle(
            color: isDark
                ? AppColors.darkPrimaryText
                : AppColors.primaryText,
          ),
        ),
      ],
    );
  }

  /// 本月 vs 上月比較柱狀圖（用 Row + Container 模擬）
  Widget _buildComparisonChart(bool isDark) {
    final maxAmount =
        _thisMonthTotal > _lastMonthTotal ? _thisMonthTotal : _lastMonthTotal;

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
          // 上月
          _buildBarRow(
            isDark: isDark,
            label: '上月',
            amount: _lastMonthTotal,
            maxAmount: maxAmount,
            color: AppColors.accentCool,
          ),

          const SizedBox(height: AppTheme.spacingMd),

          // 本月
          _buildBarRow(
            isDark: isDark,
            label: '本月',
            amount: _thisMonthTotal,
            maxAmount: maxAmount,
            color: isDark ? AppColors.darkAccent : AppColors.accent,
          ),
        ],
      ),
    );
  }

  /// 單一柱狀列
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
          child: Text(
            label,
            style: AppTextStyles.caption(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
        ),
        const SizedBox(width: AppTheme.spacingSm),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                children: [
                  // 背景
                  Container(
                    height: 28,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  // 實際值
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

  /// 各分類佔比區塊（模擬圓餅圖 + 清單）
  Widget _buildCategoryBreakdown(bool isDark) {
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
          // 模擬圓餅圖：用一個圓形 + 分色環
          _buildMockPieChart(isDark),

          const SizedBox(height: AppTheme.spacingMd),

          // 分類清單
          ..._categories.map((cat) {
            final percentage = (cat.amount / _thisMonthTotal * 100).toInt();
            return Padding(
              padding: const EdgeInsets.symmetric(
                vertical: AppTheme.spacingXs,
              ),
              child: Row(
                children: [
                  // 色塊
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: cat.color,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  // emoji + 分類名
                  Text(cat.emoji, style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: AppTheme.spacingXs),
                  Expanded(
                    child: Text(
                      cat.name,
                      style: AppTextStyles.body(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      ),
                    ),
                  ),
                  // 金額 + 百分比
                  Text(
                    '\$${_formatNumber(cat.amount)}',
                    style: AppTextStyles.bodyBold(
                      color: isDark
                          ? AppColors.darkPrimaryText
                          : AppColors.primaryText,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  SizedBox(
                    width: 40,
                    child: Text(
                      '$percentage%',
                      textAlign: TextAlign.end,
                      style: AppTextStyles.caption(
                        color: isDark
                            ? AppColors.darkSecondaryText
                            : AppColors.secondaryText,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  /// 用圓形 Container 模擬圓餅圖
  Widget _buildMockPieChart(bool isDark) {
    return SizedBox(
      width: 140,
      height: 140,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 外圈：用多個弧形容器堆疊模擬
          Container(
            width: 140,
            height: 140,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: SweepGradient(
                colors: [
                  _categories[0].color, // 餐飲
                  _categories[0].color,
                  _categories[1].color, // 交通
                  _categories[1].color,
                  _categories[2].color, // 娛樂
                  _categories[2].color,
                  _categories[3].color, // 日用品
                  _categories[3].color,
                  _categories[4].color, // 其他
                  _categories[4].color,
                  _categories[0].color,
                ],
                stops: const [
                  0.0,
                  0.35, // 餐飲 35%
                  0.35,
                  0.52, // 交通 17%
                  0.52,
                  0.74, // 娛樂 22%
                  0.74,
                  0.89, // 日用品 15%
                  0.89,
                  1.0, // 其他 11%
                  1.0,
                ],
              ),
            ),
          ),
          // 中心白圓
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurface : AppColors.surface,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '\$${_formatNumber(_thisMonthTotal)}',
              style: AppTextStyles.bodyBold(
                color: isDark
                    ? AppColors.darkPrimaryText
                    : AppColors.primaryText,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 儲蓄目標進度摘要
  Widget _buildSavingsProgress(bool isDark) {
    final progressColor = _savingsProgress >= 0.7
        ? AppColors.success
        : _savingsProgress >= 0.4
            ? AppColors.warning
            : AppColors.accent;

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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 目標名稱 + 百分比
          Row(
            children: [
              const Text('\u{2708}\u{FE0F}', style: TextStyle(fontSize: 20)),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: Text(
                  _savingsGoalName,
                  style: AppTextStyles.bodyBold(
                    color: isDark
                        ? AppColors.darkPrimaryText
                        : AppColors.primaryText,
                  ),
                ),
              ),
              Text(
                '${(_savingsProgress * 100).toInt()}%',
                style: AppTextStyles.bodyBold(color: progressColor),
              ),
            ],
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // 進度條
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: _savingsProgress,
              backgroundColor: progressColor.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              minHeight: 8,
            ),
          ),

          const SizedBox(height: AppTheme.spacingSm),

          Text(
            '按照目前進度，預計再 3 個月可達成目標',
            style: AppTextStyles.caption(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化數字（加入千分位逗號）
  static String _formatNumber(double value) {
    final intPart = value.toInt().toString();
    final buffer = StringBuffer();

    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(intPart[i]);
    }

    return buffer.toString();
  }
}
