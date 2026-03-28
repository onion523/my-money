import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 帳戶頁面
/// 顯示銀行帳戶列表與信用卡列表
class AccountsPage extends StatelessWidget {
  const AccountsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          // 大標題
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppTheme.spacingMd,
                AppTheme.spacingLg,
                AppTheme.spacingMd,
                AppTheme.spacingMd,
              ),
              child: Text('帳戶', style: AppTextStyles.pageTitle()),
            ),
          ),

          // 銀行帳戶區塊
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              child: Text('銀行帳戶', style: AppTextStyles.cardTitle()),
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.spacingSm),
          ),

          // 銀行帳戶列表
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildBankAccount(
                  isDark: isDark,
                  bankName: '中國信託',
                  accountNumber: '****-3842',
                  balance: '102,800',
                  icon: Icons.account_balance,
                  color: const Color(0xFF4A90D9),
                ),
                const SizedBox(height: AppTheme.cardGap),
                _buildBankAccount(
                  isDark: isDark,
                  bankName: '國泰世華',
                  accountNumber: '****-7156',
                  balance: '42,800',
                  icon: Icons.account_balance,
                  color: const Color(0xFF2ECC71),
                ),
              ]),
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),

          // 信用卡區塊
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              child: Text('信用卡', style: AppTextStyles.cardTitle()),
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.spacingSm),
          ),

          // 信用卡列表
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildCreditCard(
                  isDark: isDark,
                  cardName: '中信 LINE Pay 卡',
                  cardNumber: '****-8821',
                  billedAmount: '8,500',
                  unbilledAmount: '3,200',
                  dueDate: '4/10',
                  color: const Color(0xFF00C300),
                ),
                const SizedBox(height: AppTheme.cardGap),
                _buildCreditCard(
                  isDark: isDark,
                  cardName: '國泰 CUBE 卡',
                  cardNumber: '****-5567',
                  billedAmount: '5,200',
                  unbilledAmount: '1,800',
                  dueDate: '4/15',
                  color: const Color(0xFF4ECDC4),
                ),
                const SizedBox(height: AppTheme.spacing2xl),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  /// 建立銀行帳戶卡片
  Widget _buildBankAccount({
    required bool isDark,
    required String bankName,
    required String accountNumber,
    required String balance,
    required IconData icon,
    required Color color,
  }) {
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
      child: Row(
        children: [
          // 銀行圖示
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppTheme.inputRadius),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: AppTheme.spacingMd),

          // 銀行名稱與帳號
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(bankName, style: AppTextStyles.bodyBold()),
                const SizedBox(height: 2),
                Text(
                  accountNumber,
                  style: AppTextStyles.label(
                    color: isDark
                        ? AppColors.darkSecondaryText
                        : AppColors.secondaryText,
                  ),
                ),
              ],
            ),
          ),

          // 餘額
          Text(
            '\$$balance',
            style: AppTextStyles.amountMedium(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),
        ],
      ),
    );
  }

  /// 建立信用卡卡片
  Widget _buildCreditCard({
    required bool isDark,
    required String cardName,
    required String cardNumber,
    required String billedAmount,
    required String unbilledAmount,
    required String dueDate,
    required Color color,
  }) {
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
          // 卡片名稱與卡號
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppTheme.inputRadius),
                ),
                child: Icon(
                  Icons.credit_card,
                  color: color,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppTheme.spacingMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(cardName, style: AppTextStyles.bodyBold()),
                    const SizedBox(height: 2),
                    Text(
                      cardNumber,
                      style: AppTextStyles.label(
                        color: isDark
                            ? AppColors.darkSecondaryText
                            : AppColors.secondaryText,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: AppTheme.spacingMd),
          const Divider(),
          const SizedBox(height: AppTheme.spacingSm),

          // 已出帳 + 未入帳
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '已出帳',
                      style: AppTextStyles.label(
                        color: isDark
                            ? AppColors.darkSecondaryText
                            : AppColors.secondaryText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '\$$billedAmount',
                      style: AppTextStyles.amountSmall(
                        color: AppColors.error,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '未入帳',
                      style: AppTextStyles.label(
                        color: isDark
                            ? AppColors.darkSecondaryText
                            : AppColors.secondaryText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '\$$unbilledAmount',
                      style: AppTextStyles.amountSmall(
                        color: AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '繳款日',
                    style: AppTextStyles.label(
                      color: isDark
                          ? AppColors.darkSecondaryText
                          : AppColors.secondaryText,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    dueDate,
                    style: AppTextStyles.bodyBold(
                      color: isDark
                          ? AppColors.darkPrimaryText
                          : AppColors.primaryText,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
