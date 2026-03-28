import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// AI 建議卡片元件
/// 柔和水彩風格，暖黃背景 #FFFDE6
/// 顯示圖示 + 建議文字 + 影響金額
class AiSuggestionCard extends StatelessWidget {
  /// 建議文字
  final String text;

  /// 影響金額（格式化字串，例：$300）
  final String? impactAmount;

  /// 圖示（預設用燈泡 💡）
  final IconData? icon;

  /// 圖示顏色（預設暖橙）
  final Color? iconColor;

  /// 點擊回調
  final VoidCallback? onTap;

  /// AI 建議卡片暖黃背景色
  static const Color _cardBackground = Color(0xFFFFFDE6);

  /// AI 建議卡片暗色背景色
  static const Color _darkCardBackground = Color(0xFF2A2A3A);

  const AiSuggestionCard({
    super.key,
    required this.text,
    this.impactAmount,
    this.icon,
    this.iconColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? _darkCardBackground : _cardBackground;
    final icoColor = iconColor ?? AppColors.warning;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppTheme.cardPadding),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppTheme.cardRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 圖示
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: icoColor.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(
                icon ?? Icons.lightbulb_outline,
                color: icoColor,
                size: 20,
              ),
            ),

            const SizedBox(width: AppTheme.spacingSm + AppTheme.spacingXs),

            // 文字 + 影響金額
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 建議文字
                  Text(
                    text,
                    style: AppTextStyles.body(
                      color: isDark
                          ? AppColors.darkPrimaryText
                          : AppColors.primaryText,
                    ),
                  ),

                  // 影響金額
                  if (impactAmount != null &&
                      impactAmount!.isNotEmpty) ...[
                    const SizedBox(height: AppTheme.spacingXs),
                    Row(
                      children: [
                        Icon(
                          Icons.trending_up,
                          size: 14,
                          color: AppColors.success,
                        ),
                        const SizedBox(width: AppTheme.spacingXs),
                        Text(
                          '每月可省 $impactAmount',
                          style: AppTextStyles.caption(
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
