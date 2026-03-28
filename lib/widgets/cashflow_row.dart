import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 現金流時間軸的一行
/// 顯示日期、事件名稱、金額和時間軸連接線
class CashflowRow extends StatelessWidget {
  /// 日期文字（例如：3/28）
  final String date;

  /// 事件名稱
  final String name;

  /// 金額
  final String amount;

  /// 是否為收入（true 為收入，false 為支出）
  final bool isIncome;

  /// 是否為最後一筆（控制時間軸連接線）
  final bool isLast;

  /// 是否為第一筆
  final bool isFirst;

  const CashflowRow({
    super.key,
    required this.date,
    required this.name,
    required this.amount,
    this.isIncome = false,
    this.isLast = false,
    this.isFirst = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dotColor = isIncome ? AppColors.success : AppColors.accent;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 日期欄
          SizedBox(
            width: 48,
            child: Text(
              date,
              style: AppTextStyles.label(
                color: isDark
                    ? AppColors.darkSecondaryText
                    : AppColors.secondaryText,
              ),
              textAlign: TextAlign.right,
            ),
          ),

          const SizedBox(width: AppTheme.spacingSm),

          // 時間軸（圓點 + 連接線）
          SizedBox(
            width: 20,
            child: Column(
              children: [
                // 上方連接線
                if (!isFirst)
                  Container(
                    width: 1.5,
                    height: 8,
                    color: dotColor.withValues(alpha: 0.3),
                  ),

                // 圓點
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: dotColor.withValues(alpha: 0.3),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                ),

                // 下方連接線
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      color: dotColor.withValues(alpha: 0.15),
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(width: AppTheme.spacingSm),

          // 內容
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppTheme.spacingMd),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: AppTextStyles.body(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      ),
                    ),
                  ),
                  Text(
                    isIncome ? '+\$$amount' : '-\$$amount',
                    style: AppTextStyles.amountSmall(
                      color: isIncome ? AppColors.success : AppColors.error,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
