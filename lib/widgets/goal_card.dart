import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 儲蓄目標卡片
/// 顯示 emoji + 名稱 + 進度條 + 金額
class GoalCard extends StatelessWidget {
  /// 目標 emoji 圖示
  final String emoji;

  /// 目標名稱
  final String name;

  /// 目前金額
  final String currentAmount;

  /// 目標金額
  final String targetAmount;

  /// 進度百分比（0.0 ~ 1.0）
  final double progress;

  /// 截止日期（可選）
  final String? deadline;

  /// 點擊回調
  final VoidCallback? onTap;

  /// 編輯回調
  final VoidCallback? onEdit;

  /// 刪除回調
  final VoidCallback? onDelete;

  const GoalCard({
    super.key,
    required this.emoji,
    required this.name,
    required this.currentAmount,
    required this.targetAmount,
    required this.progress,
    this.deadline,
    this.onTap,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // 根據進度選擇顏色
    final progressColor = _getProgressColor(progress);

    return GestureDetector(
      onTap: onTap,
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
            // 第一行：emoji + 名稱 + 百分比
            Row(
              children: [
                // Emoji
                Text(emoji, style: const TextStyle(fontSize: 28)),
                const SizedBox(width: AppTheme.spacingSm),

                // 名稱與截止日
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: AppTextStyles.bodyBold()),
                      if (deadline != null)
                        Text(
                          deadline!,
                          style: AppTextStyles.label(
                            color: isDark
                                ? AppColors.darkSecondaryText
                                : AppColors.secondaryText,
                          ),
                        ),
                    ],
                  ),
                ),

                // 百分比
                Text(
                  '${(progress * 100).toInt()}%',
                  style: AppTextStyles.bodyBold(color: progressColor),
                ),

                // 編輯 / 刪除按鈕
                if (onEdit != null)
                  IconButton(
                    onPressed: onEdit,
                    icon: Icon(Icons.edit_outlined, size: 18,
                      color: isDark ? AppColors.darkSecondaryText : AppColors.secondaryText),
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    padding: EdgeInsets.zero,
                    tooltip: '編輯',
                  ),
                if (onDelete != null)
                  IconButton(
                    onPressed: onDelete,
                    icon: Icon(Icons.delete_outline, size: 18,
                      color: AppColors.error.withValues(alpha: 0.6)),
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    padding: EdgeInsets.zero,
                    tooltip: '刪除',
                  ),
              ],
            ),

            const SizedBox(height: AppTheme.spacingSm + AppTheme.spacingXs),

            // 進度條
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0),
                backgroundColor: progressColor.withValues(alpha: 0.15),
                valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                minHeight: 6,
              ),
            ),

            const SizedBox(height: AppTheme.spacingSm),

            // 金額
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '\$$currentAmount',
                  style: AppTextStyles.amountSmall(
                    color: isDark
                        ? AppColors.darkPrimaryText
                        : AppColors.primaryText,
                  ),
                ),
                Text(
                  '/ \$$targetAmount',
                  style: AppTextStyles.caption(
                    color: isDark
                        ? AppColors.darkSecondaryText
                        : AppColors.secondaryText,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// 根據進度回傳對應顏色
  Color _getProgressColor(double progress) {
    if (progress >= 0.7) return AppColors.success;
    if (progress >= 0.4) return AppColors.warning;
    return AppColors.accent;
  }
}
