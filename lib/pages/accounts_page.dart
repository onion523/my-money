import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/dialogs/edit_account_dialog.dart';
import 'package:my_money/widgets/dialogs/edit_credit_card_dialog.dart';
import 'package:my_money/widgets/dialogs/update_balance_dialog.dart';

/// 帳戶頁面
/// 顯示銀行帳戶列表與信用卡列表
class AccountsPage extends StatelessWidget {
  const AccountsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      child: BlocBuilder<AccountsBloc, AccountsState>(
        builder: (context, state) {
          if (state is AccountsLoaded) {
            if (state.accounts.isNotEmpty) {
              return _buildFromBloc(context, isDark, state.accounts);
            }
            // 沒有帳戶時顯示空狀態
            return _buildEmptyState(context);
          }
          if (state is AccountsLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          // 錯誤或初始狀態也顯示空狀態
          return _buildEmptyState(context);
        },
      ),
    );
  }

  /// 開啟對應的編輯 Dialog
  void _openEditDialog(BuildContext context, Account account) {
    showDialog(
      context: context,
      builder: (_) => account.type == 'credit_card'
          ? EditCreditCardDialog(account: account)
          : EditAccountDialog(account: account),
    );
  }

  /// 開啟新增帳戶 Dialog
  void _openAddDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => const UpdateBalanceDialog(),
    );
  }

  /// 從 BLoC 資料建立頁面
  Widget _buildFromBloc(BuildContext context, bool isDark, List<Account> accounts) {
    final bankAccounts = accounts.where((a) => a.type == 'bank').toList();
    final creditCards = accounts.where((a) => a.type == 'credit_card').toList();

    // 銀行帳戶與信用卡的顏色配對
    const bankColors = [Color(0xFF4A90D9), Color(0xFF2ECC71), Color(0xFF9B59B6)];
    const cardColors = [Color(0xFF00C300), Color(0xFF4ECDC4), Color(0xFFE74C3C)];

    return CustomScrollView(
      slivers: [
        // 大標題 + 新增帳戶按鈕
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppTheme.spacingMd,
              AppTheme.spacingLg,
              AppTheme.spacingMd,
              AppTheme.spacingMd,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('帳戶', style: AppTextStyles.pageTitle()),
                IconButton(
                  onPressed: () => _openAddDialog(context),
                  icon: const Icon(Icons.add_circle_outline),
                  color: AppColors.accent,
                  tooltip: '新增帳戶',
                  iconSize: 28,
                ),
              ],
            ),
          ),
        ),

        // 銀行帳戶區塊
        if (bankAccounts.isNotEmpty) ...[
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
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final account = bankAccounts[index];
                  final color = bankColors[index % bankColors.length];
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: index < bankAccounts.length - 1
                          ? AppTheme.cardGap
                          : 0,
                    ),
                    child: GestureDetector(
                      onLongPress: () => _openEditDialog(context, account),
                      child: _buildBankAccount(
                        isDark: isDark,
                        bankName: account.name,
                        accountNumber: '****-${account.id.substring(account.id.length - 4)}',
                        balance: _formatAmount(Decimal.parse(account.balance)),
                        icon: Icons.account_balance,
                        color: color,
                        onEdit: () => _openEditDialog(context, account),
                      ),
                    ),
                  );
                },
                childCount: bankAccounts.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),
        ],

        // 信用卡區塊
        if (creditCards.isNotEmpty) ...[
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
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final card = creditCards[index];
                  final color = cardColors[index % cardColors.length];
                  final dueDate = card.paymentDate != null
                      ? '${DateTime.now().month + 1}/${card.paymentDate}'
                      : '-';
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: index < creditCards.length - 1
                          ? AppTheme.cardGap
                          : AppTheme.spacing2xl,
                    ),
                    child: GestureDetector(
                      onLongPress: () => _openEditDialog(context, card),
                      child: _buildCreditCard(
                        isDark: isDark,
                        cardName: card.name,
                        cardNumber: '****-${card.id.substring(card.id.length - 4)}',
                        billedAmount: card.billedAmount != null
                            ? _formatAmount(Decimal.parse(card.billedAmount!))
                            : '0',
                        unbilledAmount: card.unbilledAmount != null
                            ? _formatAmount(Decimal.parse(card.unbilledAmount!))
                            : '0',
                        dueDate: dueDate,
                        color: color,
                        onEdit: () => _openEditDialog(context, card),
                      ),
                    ),
                  );
                },
                childCount: creditCards.length,
              ),
            ),
          ),
        ],
      ],
    );
  }

  /// 空狀態 — 引導使用者新增第一個帳戶
  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.account_balance_outlined,
                size: 40,
                color: AppColors.accent,
              ),
            ),
            const SizedBox(height: 24),
            Text('還沒有帳戶', style: AppTextStyles.cardTitle()),
            const SizedBox(height: 8),
            Text(
              '新增你的銀行帳戶或信用卡，開始追蹤財務狀況',
              style: AppTextStyles.body(color: AppColors.secondaryText),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _openAddDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('新增帳戶'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 格式化金額為千分位字串
  static String _formatAmount(Decimal amount) {
    final intPart = amount.truncate().toBigInt().abs().toString();
    final formatted = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) {
        formatted.write(',');
      }
      formatted.write(intPart[i]);
    }
    return formatted.toString();
  }

  /// 建立銀行帳戶卡片
  Widget _buildBankAccount({
    required bool isDark,
    required String bankName,
    required String accountNumber,
    required String balance,
    required IconData icon,
    required Color color,
    VoidCallback? onEdit,
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

          // 編輯按鈕
          if (onEdit != null) ...[
            const SizedBox(width: AppTheme.spacingSm),
            IconButton(
              onPressed: onEdit,
              icon: Icon(
                Icons.edit_outlined,
                size: 20,
                color: isDark ? AppColors.darkSecondaryText : AppColors.secondaryText,
              ),
              tooltip: '編輯',
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              padding: EdgeInsets.zero,
            ),
          ],
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
    VoidCallback? onEdit,
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
              // 編輯按鈕
              if (onEdit != null)
                IconButton(
                  onPressed: onEdit,
                  icon: Icon(
                    Icons.edit_outlined,
                    size: 20,
                    color: isDark ? AppColors.darkSecondaryText : AppColors.secondaryText,
                  ),
                  tooltip: '編輯',
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  padding: EdgeInsets.zero,
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
