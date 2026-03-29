import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 購買力檢查 Dialog
/// 輸入金額後顯示：買得起/買不起、對儲蓄目標的影響、對現金流的影響
class PurchaseCheckDialog extends StatefulWidget {
  const PurchaseCheckDialog({super.key});

  /// 顯示購買力檢查 Dialog 的便利方法
  static Future<void> show(BuildContext context) {
    return showDialog(
      context: context,
      builder: (_) => BlocProvider.value(
        value: context.read<CashflowBloc>(),
        child: const PurchaseCheckDialog(),
      ),
    );
  }

  @override
  State<PurchaseCheckDialog> createState() => _PurchaseCheckDialogState();
}

class _PurchaseCheckDialogState extends State<PurchaseCheckDialog> {
  final _controller = TextEditingController();
  bool _hasChecked = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.modalRadius),
      ),
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingXl,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 標題
              Row(
                children: [
                  const Text('\u{1F4B0}', style: TextStyle(fontSize: 24)),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    '購買力檢查',
                    style: AppTextStyles.cardTitle(
                      color: isDark
                          ? AppColors.darkPrimaryText
                          : AppColors.primaryText,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingMd),

              // 輸入框
              TextField(
                controller: _controller,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  hintText: '你想花多少？',
                  prefixText: '\$ ',
                ),
              ),

              const SizedBox(height: AppTheme.spacingMd),

              // 檢查按鈕
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _onCheck,
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        isDark ? AppColors.darkAccent : AppColors.accent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      vertical: AppTheme.spacingSm + AppTheme.spacingXs,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppTheme.buttonRadius),
                    ),
                  ),
                  child: const Text('檢查'),
                ),
              ),

              // 結果區塊
              if (_hasChecked) ...[
                const SizedBox(height: AppTheme.spacingMd),
                _buildResultSection(isDark),
              ],

              const SizedBox(height: AppTheme.spacingSm),

              // 關閉按鈕
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('關閉'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 按下檢查按鈕
  void _onCheck() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    final amount = Decimal.tryParse(text);
    if (amount == null || amount <= Decimal.zero) return;

    context.read<CashflowBloc>().add(CheckPurchasingPower(amount));
    setState(() {
      _hasChecked = true;
    });
  }

  /// 結果區塊：使用 BlocBuilder 監聽狀態
  Widget _buildResultSection(bool isDark) {
    return BlocBuilder<CashflowBloc, CashflowState>(
      builder: (context, state) {
        if (state is PurchaseCheckResultState) {
          return _buildResultCards(isDark, state);
        }
        if (state is CashflowError) {
          return _buildStatusCard(
            isDark: isDark,
            icon: Icons.error_outline,
            title: '檢查失敗',
            message: state.message,
            statusColor: AppColors.error,
          );
        }
        // 載入中或其他狀態
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: AppTheme.spacingMd),
          child: Center(child: CircularProgressIndicator()),
        );
      },
    );
  }

  /// 根據結果顯示多張結果卡片
  Widget _buildResultCards(bool isDark, PurchaseCheckResultState state) {
    final result = state.result;

    // 決定整體狀態顏色
    final Color statusColor;
    final String statusTitle;
    final IconData statusIcon;

    if (!result.canAfford) {
      statusColor = AppColors.error;
      statusTitle = '買不起';
      statusIcon = Icons.cancel_outlined;
    } else if (!result.forecastSafe) {
      statusColor = AppColors.warning;
      statusTitle = '需要注意';
      statusIcon = Icons.warning_amber_outlined;
    } else {
      statusColor = AppColors.success;
      statusTitle = '買得起';
      statusIcon = Icons.check_circle_outline;
    }

    return Column(
      children: [
        // 主要結果卡片
        _buildStatusCard(
          isDark: isDark,
          icon: statusIcon,
          title: statusTitle,
          message: result.canAfford
              ? '購買後剩餘 \$${_formatAmount(result.remainingBalance)}'
              : '餘額不足，還差 \$${_formatAmount(result.purchaseAmount - result.remainingBalance)}',
          statusColor: statusColor,
        ),

        const SizedBox(height: AppTheme.cardGap),

        // 現金流影響卡片
        _buildStatusCard(
          isDark: isDark,
          icon: result.forecastSafe
              ? Icons.trending_up
              : Icons.trending_down,
          title: '現金流影響',
          message: result.forecastSafe
              ? '未來 30 天現金流安全，不會出現負餘額'
              : '未來現金流可能出現不足，請謹慎考慮',
          statusColor: result.forecastSafe ? AppColors.success : AppColors.warning,
        ),

        // 警告訊息
        if (result.warning != null) ...[
          const SizedBox(height: AppTheme.cardGap),
          _buildStatusCard(
            isDark: isDark,
            icon: Icons.info_outline,
            title: '儲蓄目標影響',
            message: result.warning!,
            statusColor: AppColors.warning,
          ),
        ],
      ],
    );
  }

  /// 單一狀態結果卡片
  Widget _buildStatusCard({
    required bool isDark,
    required IconData icon,
    required String title,
    required String message,
    required Color statusColor,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        border: Border.all(
          color: statusColor.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: statusColor, size: 24),
          const SizedBox(width: AppTheme.spacingSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyBold(color: statusColor),
                ),
                const SizedBox(height: AppTheme.spacingXs),
                Text(
                  message,
                  style: AppTextStyles.caption(
                    color: isDark
                        ? AppColors.darkPrimaryText
                        : AppColors.primaryText,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化金額（加入千分位逗號）
  static String _formatAmount(Decimal amount) {
    final isNegative = amount < Decimal.zero;
    final absAmount = isNegative ? -amount : amount;
    final intPart = absAmount.toBigInt().toString();
    final buffer = StringBuffer();

    if (isNegative) buffer.write('-');

    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(intPart[i]);
    }

    return buffer.toString();
  }
}
