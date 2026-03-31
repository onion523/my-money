import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';

/// 更新帳戶餘額 Dialog — 選擇現有帳戶更新餘額
class UpdateBalanceDialog extends StatefulWidget {
  const UpdateBalanceDialog({super.key});

  @override
  State<UpdateBalanceDialog> createState() => _UpdateBalanceDialogState();
}

class _UpdateBalanceDialogState extends State<UpdateBalanceDialog> {
  final _balanceController = TextEditingController();
  final _unbilledAmountController = TextEditingController();
  Account? _selectedAccount;

  @override
  void dispose() {
    _balanceController.dispose();
    _unbilledAmountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('更新餘額',
          style: TextStyle(fontWeight: FontWeight.w700)),
      content: BlocBuilder<AccountsBloc, AccountsState>(
        builder: (context, state) {
          final accounts =
              state is AccountsLoaded ? state.accounts : <Account>[];

          if (accounts.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Text('尚未建立帳戶，請先到帳戶頁面新增。'),
            );
          }

          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 選擇帳戶
                DropdownButtonFormField<String>(
                  value: _selectedAccount?.id,
                  decoration: InputDecoration(
                    labelText: '選擇帳戶',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  items: accounts.map((a) {
                    final label = a.type == 'credit_card'
                        ? '💳 ${a.name}'
                        : '🏦 ${a.name}';
                    return DropdownMenuItem(value: a.id, child: Text(label));
                  }).toList(),
                  onChanged: (id) {
                    final account = accounts.firstWhere((a) => a.id == id);
                    setState(() {
                      _selectedAccount = account;
                      if (account.type == 'credit_card') {
                        _balanceController.text =
                            account.billedAmount ?? account.balance;
                        _unbilledAmountController.text =
                            account.unbilledAmount ?? '0';
                      } else {
                        _balanceController.text = account.balance;
                      }
                    });
                  },
                ),

                if (_selectedAccount != null) ...[
                  const SizedBox(height: 16),

                  // 餘額 / 已出帳金額
                  TextField(
                    controller: _balanceController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: _selectedAccount!.type == 'credit_card'
                          ? '已出帳金額'
                          : '目前餘額',
                      prefixText: '\$ ',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                  ),

                  // 信用卡額外：未出帳金額
                  if (_selectedAccount!.type == 'credit_card') ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _unbilledAmountController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: '未出帳金額',
                        prefixText: '\$ ',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                    ),
                  ],
                ],
              ],
            ),
          );
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: _selectedAccount == null ? null : _submit,
          style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
          child: const Text('更新'),
        ),
      ],
    );
  }

  void _submit() {
    if (_selectedAccount == null) return;

    final balance = double.tryParse(_balanceController.text);
    if (balance == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請輸入有效金額')),
      );
      return;
    }

    final account = _selectedAccount!;

    if (account.type == 'credit_card') {
      final unbilled =
          double.tryParse(_unbilledAmountController.text) ?? 0;
      final total = balance + unbilled;
      context.read<AccountsBloc>().add(UpdateAccount(
            account.copyWith(
              balance: total.toString(),
              billedAmount: Value(balance.toString()),
              unbilledAmount: Value(unbilled.toString()),
            ),
          ));
    } else {
      context.read<AccountsBloc>().add(UpdateAccount(
            account.copyWith(balance: balance.toString()),
          ));
    }

    // 更新餘額 BLoC
    context.read<BalanceBloc>().add(const RefreshBalance());

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已更新：${account.name}')),
    );
  }
}
