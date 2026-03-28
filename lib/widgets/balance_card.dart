import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 即時可用餘額大卡片
/// 使用漸層背景（FFF5F5 -> FFE8E8），顯示可用餘額與攤提後可自由花用金額
class BalanceCard extends StatelessWidget {
  /// 即時可用餘額
  final String balance;

  /// 攤提後可自由花用金額
  final String? freeToSpend;

  /// 餘額標籤
  final String label;

  const BalanceCard({
    super.key,
    required this.balance,
    this.freeToSpend,
    this.label = '即時可用餘額',
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
      ),
      padding: const EdgeInsets.all(AppTheme.spacingLg),
      decoration: BoxDecoration(
        gradient: isDark
            ? AppColors.darkBalanceGradient
            : AppColors.balanceGradient,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: (isDark ? AppColors.darkAccent : AppColors.accent)
                .withValues(alpha: 0.1),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 標籤
          Text(
            label,
            style: AppTextStyles.caption(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: AppTheme.spacingSm),

          // 餘額大數字
          Text(
            '\$$balance',
            style: AppTextStyles.amountLarge(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),

          // 攤提後可自由花用
          if (freeToSpend != null) ...[
            const SizedBox(height: AppTheme.spacingSm),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingSm + AppTheme.spacingXs,
                vertical: AppTheme.spacingXs,
              ),
              decoration: BoxDecoration(
                color: (isDark ? AppColors.darkAccent : AppColors.accent)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
              ),
              child: Text(
                '攤提後可自由花用 \$$freeToSpend',
                style: AppTextStyles.label(
                  color: isDark ? AppColors.darkAccent : AppColors.accent,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
