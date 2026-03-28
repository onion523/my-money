import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 交易紀錄行
/// 顯示名稱 + 分類 + 日期 + 金額
class TransactionTile extends StatelessWidget {
  /// 交易名稱
  final String name;

  /// 分類圖示
  final IconData icon;

  /// 分類名稱
  final String category;

  /// 日期
  final String date;

  /// 金額（正數為收入，負數為支出）
  final String amount;

  /// 是否為支出
  final bool isExpense;

  /// 點擊回調
  final VoidCallback? onTap;

  const TransactionTile({
    super.key,
    required this.name,
    required this.icon,
    required this.category,
    required this.date,
    required this.amount,
    this.isExpense = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.cardRadius),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm + AppTheme.spacingXs,
        ),
        child: Row(
          children: [
            // 分類圖示
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: (isDark ? AppColors.darkAccent : AppColors.accent)
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.inputRadius),
              ),
              child: Icon(
                icon,
                color: isDark ? AppColors.darkAccent : AppColors.accent,
                size: 22,
              ),
            ),

            const SizedBox(width: AppTheme.spacingSm + AppTheme.spacingXs),

            // 名稱與分類
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: AppTextStyles.body(
                      color: isDark
                          ? AppColors.darkPrimaryText
                          : AppColors.primaryText,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$category ・ $date',
                    style: AppTextStyles.label(
                      color: isDark
                          ? AppColors.darkSecondaryText
                          : AppColors.secondaryText,
                    ),
                  ),
                ],
              ),
            ),

            // 金額
            Text(
              isExpense ? '-\$$amount' : '+\$$amount',
              style: AppTextStyles.amountSmall(
                color: isExpense ? AppColors.error : AppColors.success,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
