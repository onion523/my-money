import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 成員進度元件
/// 顯示頭像 + 名稱 + 金額 + 進度條
class MemberProgress extends StatelessWidget {
  /// 成員名稱
  final String name;

  /// 貢獻金額（格式化字串）
  final String amount;

  /// 進度百分比（0.0 ~ 1.0）
  final double progress;

  /// 進度條顏色（預設使用暖黃）
  final Color? progressColor;

  /// 頭像背景色（預設根據名稱自動產生）
  final Color? avatarColor;

  const MemberProgress({
    super.key,
    required this.name,
    required this.amount,
    required this.progress,
    this.progressColor,
    this.avatarColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final barColor = progressColor ?? AppColors.accentWarm;

    // 根據名稱第一個字自動產生頭像背景色
    final bgColor = avatarColor ?? _generateAvatarColor(name);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
      child: Row(
        children: [
          // 頭像圓形
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: bgColor.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              name.isNotEmpty ? name.characters.first : '?',
              style: AppTextStyles.bodyBold(color: bgColor),
            ),
          ),

          const SizedBox(width: AppTheme.spacingSm + AppTheme.spacingXs),

          // 名稱 + 進度條 + 金額
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 第一行：名稱 + 金額
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      name,
                      style: AppTextStyles.bodyBold(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      ),
                    ),
                    Text(
                      '\$$amount',
                      style: AppTextStyles.amountSmall(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: AppTheme.spacingXs),

                // 進度條
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress.clamp(0.0, 1.0),
                    backgroundColor: barColor.withValues(alpha: 0.15),
                    valueColor: AlwaysStoppedAnimation<Color>(barColor),
                    minHeight: 6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 根據名稱自動產生柔和的頭像背景色
  Color _generateAvatarColor(String name) {
    if (name.isEmpty) return AppColors.accent;

    // 簡易雜湊：用名稱字元碼值決定色相
    final hash = name.codeUnits.fold(0, (sum, c) => sum + c);
    final colors = [
      AppColors.accent, // 柔和粉紅
      AppColors.accentWarm, // 暖黃
      AppColors.accentCool, // 淺藍
      AppColors.success, // 柔和綠
      AppColors.warning, // 暖橙
    ];

    return colors[hash % colors.length];
  }
}
