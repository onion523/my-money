import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// iOS 風格分段控制器
/// 支援動畫切換，遵循 iOS HIG 規範
class SegmentedControl extends StatelessWidget {
  /// 各分段的標籤文字
  final List<String> segments;

  /// 目前選中的索引
  final int selectedIndex;

  /// 選中變更回調
  final ValueChanged<int> onChanged;

  const SegmentedControl({
    super.key,
    required this.segments,
    required this.selectedIndex,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurface
            : AppColors.secondaryText.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segmentWidth = constraints.maxWidth / segments.length;

          return Stack(
            children: [
              // 滑動指示器（動畫）
              AnimatedPositioned(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                left: selectedIndex * segmentWidth,
                top: 0,
                bottom: 0,
                width: segmentWidth,
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkBackground : AppColors.surface,
                    borderRadius: BorderRadius.circular(
                      AppTheme.buttonRadius - 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),

              // 分段按鈕
              Row(
                children: List.generate(segments.length, (index) {
                  final isSelected = index == selectedIndex;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => onChanged(index),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppTheme.spacingSm,
                        ),
                        alignment: Alignment.center,
                        child: AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: isSelected
                              ? AppTextStyles.bodyBold(
                                  color: isDark
                                      ? AppColors.darkPrimaryText
                                      : AppColors.primaryText,
                                ).copyWith(fontSize: 14)
                              : AppTextStyles.caption(
                                  color: isDark
                                      ? AppColors.darkSecondaryText
                                      : AppColors.secondaryText,
                                ),
                          child: Text(segments[index]),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );
  }
}
