import 'package:drift/drift.dart' as drift;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/pages/onboarding/setup_goal_page.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:uuid/uuid.dart';

/// 設定帳戶頁面 — 新增銀行帳戶
class SetupAccountPage extends StatefulWidget {
  const SetupAccountPage({super.key});

  @override
  State<SetupAccountPage> createState() => _SetupAccountPageState();
}

class _SetupAccountPageState extends State<SetupAccountPage> {
  /// 已新增的帳戶列表（名稱 + 餘額）
  final List<_AccountEntry> _accounts = [];

  final _nameController = TextEditingController();
  final _balanceController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _nameController.dispose();
    _balanceController.dispose();
    super.dispose();
  }

  /// 新增帳戶到列表
  void _addAccount() {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _accounts.add(_AccountEntry(
        name: _nameController.text.trim(),
        balance: _balanceController.text.trim(),
      ));
      _nameController.clear();
      _balanceController.clear();
    });
  }

  /// 移除帳戶
  void _removeAccount(int index) {
    setState(() => _accounts.removeAt(index));
  }

  /// 儲存帳戶並進入下一步
  void _saveAndNext() {
    final accountsBloc = context.read<AccountsBloc>();
    final now = DateTime.now();
    const uuid = Uuid();

    // 將所有帳戶寫入 BLoC
    for (final account in _accounts) {
      accountsBloc.add(AddAccount(AccountsCompanion(
        id: drift.Value(uuid.v4()),
        name: drift.Value(account.name),
        type: const drift.Value('bank'),
        balance: drift.Value(account.balance),
        createdAt: drift.Value(now),
        updatedAt: drift.Value(now),
      )));
    }

    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SetupGoalPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingLg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 標題
              _buildHeader(),

              const SizedBox(height: AppTheme.spacingLg),

              // 新增帳戶表單
              _buildAddForm(),

              const SizedBox(height: AppTheme.spacingLg),

              // 已新增帳戶列表
              Expanded(child: _buildAccountList()),

              // 下一步按鈕
              _buildNextButton(),

              const SizedBox(height: AppTheme.spacingLg),
            ],
          ),
        ),
      ),
    );
  }

  /// 建構標題
  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 步驟指示
        Text(
          '步驟 1/3',
          style: AppTextStyles.label(color: AppColors.accent),
        ),
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          '你的錢在哪裡？',
          style: GoogleFonts.zenMaruGothic(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: AppColors.primaryText,
          ),
        ),
        const SizedBox(height: AppTheme.spacingXs),
        Text(
          '新增你的銀行帳戶，讓我們知道你的資產',
          style: AppTextStyles.caption(),
        ),
      ],
    );
  }

  /// 建構新增帳戶表單
  Widget _buildAddForm() {
    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 帳戶名稱
            TextFormField(
              controller: _nameController,
              textInputAction: TextInputAction.next,
              style: AppTextStyles.body(),
              decoration: const InputDecoration(
                labelText: '帳戶名稱',
                hintText: '例如：台新銀行',
                prefixIcon: Icon(
                  Icons.account_balance_outlined,
                  color: AppColors.secondaryText,
                ),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return '請輸入帳戶名稱';
                }
                return null;
              },
            ),

            const SizedBox(height: AppTheme.spacingMd),

            // 帳戶餘額
            TextFormField(
              controller: _balanceController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
              ],
              textInputAction: TextInputAction.done,
              style: AppTextStyles.body(),
              decoration: const InputDecoration(
                labelText: '目前餘額',
                hintText: '例如：50000',
                prefixIcon: Icon(
                  Icons.attach_money_rounded,
                  color: AppColors.secondaryText,
                ),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return '請輸入目前餘額';
                }
                if (double.tryParse(value.trim()) == null) {
                  return '請輸入有效的金額';
                }
                return null;
              },
              onFieldSubmitted: (_) => _addAccount(),
            ),

            const SizedBox(height: AppTheme.spacingMd),

            // 新增按鈕
            SizedBox(
              height: 44,
              child: OutlinedButton.icon(
                onPressed: _addAccount,
                icon: const Icon(Icons.add_rounded),
                label: const Text('新增帳戶'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.accent,
                  side: const BorderSide(color: AppColors.accent),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppTheme.buttonRadius),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 建構已新增帳戶列表
  Widget _buildAccountList() {
    if (_accounts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.account_balance_rounded,
              size: 48,
              color: AppColors.secondaryText.withValues(alpha: 0.3),
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              '尚未新增帳戶',
              style: AppTextStyles.caption(
                color: AppColors.secondaryText.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      itemCount: _accounts.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppTheme.spacingSm),
      itemBuilder: (context, index) {
        final account = _accounts[index];
        return Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.cardPadding,
            vertical: AppTheme.spacingSm + AppTheme.spacingXs,
          ),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTheme.inputRadius),
            border: Border.all(
              color: AppColors.secondaryText.withValues(alpha: 0.1),
            ),
          ),
          child: Row(
            children: [
              // 圖示
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.accent.withValues(alpha: 0.1),
                ),
                child: const Icon(
                  Icons.account_balance_rounded,
                  size: 20,
                  color: AppColors.accent,
                ),
              ),
              const SizedBox(width: AppTheme.spacingSm + AppTheme.spacingXs),
              // 帳戶資訊
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account.name,
                      style: AppTextStyles.bodyBold(),
                    ),
                    Text(
                      '\$ ${account.balance}',
                      style: AppTextStyles.caption(color: AppColors.accent),
                    ),
                  ],
                ),
              ),
              // 刪除按鈕
              IconButton(
                icon: Icon(
                  Icons.close_rounded,
                  size: 20,
                  color: AppColors.secondaryText.withValues(alpha: 0.5),
                ),
                onPressed: () => _removeAccount(index),
              ),
            ],
          ),
        );
      },
    );
  }

  /// 建構下一步按鈕
  Widget _buildNextButton() {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: _accounts.isEmpty ? null : _saveAndNext,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.accent.withValues(alpha: 0.3),
          disabledForegroundColor: Colors.white.withValues(alpha: 0.6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.inputRadius),
          ),
          elevation: 0,
        ),
        child: Text(
          '下一步',
          style: AppTextStyles.bodyBold(color: Colors.white),
        ),
      ),
    );
  }
}

/// 帳戶條目資料
class _AccountEntry {
  final String name;
  final String balance;

  const _AccountEntry({required this.name, required this.balance});
}
