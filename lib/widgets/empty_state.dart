import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 空狀態元件
/// 顯示插圖圖示 + 文字說明 + 動作按鈕
class EmptyState extends StatelessWidget {
  /// 圖示
  final IconData icon;

  /// 主要文字
  final String title;

  /// 說明文字
  final String? subtitle;

  /// 動作按鈕文字
  final String? actionText;

  /// 動作按鈕回調
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionText,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacing2xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 圖示容器（水彩暈開效果）
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    (isDark ? AppColors.darkAccent : AppColors.accent)
                        .withValues(alpha: 0.15),
                    (isDark ? AppColors.darkAccent : AppColors.accent)
                        .withValues(alpha: 0.05),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.6, 1.0],
                ),
              ),
              child: Icon(
                icon,
                size: 40,
                color: isDark ? AppColors.darkAccent : AppColors.accent,
              ),
            ),

            const SizedBox(height: AppTheme.spacingLg),

            // 主要文字
            Text(
              title,
              style: AppTextStyles.subtitle(
                color: isDark
                    ? AppColors.darkPrimaryText
                    : AppColors.primaryText,
              ),
              textAlign: TextAlign.center,
            ),

            // 說明文字
            if (subtitle != null) ...[
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                subtitle!,
                style: AppTextStyles.caption(
                  color: isDark
                      ? AppColors.darkSecondaryText
                      : AppColors.secondaryText,
                ),
                textAlign: TextAlign.center,
              ),
            ],

            // 動作按鈕
            if (actionText != null && onAction != null) ...[
              const SizedBox(height: AppTheme.spacingLg),
              ElevatedButton(
                onPressed: onAction,
                child: Text(actionText!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
