import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:uuid/uuid.dart';

/// 新增帳戶 Dialog — 銀行帳戶或信用卡
class AddAccountDialog extends StatefulWidget {
  const AddAccountDialog({super.key});

  @override
  State<AddAccountDialog> createState() => _AddAccountDialogState();
}

class _AddAccountDialogState extends State<AddAccountDialog> {
  final _nameController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _balanceController = TextEditingController();
  final _unbilledAmountController = TextEditingController();
  String _type = 'bank';
  int? _billingDate;
  int? _paymentDate;

  @override
  void dispose() {
    _nameController.dispose();
    _accountNumberController.dispose();
    _balanceController.dispose();
    _unbilledAmountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title:
          const Text('新增帳戶', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 帳戶類型
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('銀行帳戶'),
                    selected: _type == 'bank',
                    selectedColor: AppColors.accent.withValues(alpha: 0.2),
                    onSelected: (v) => setState(() => _type = 'bank'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('信用卡'),
                    selected: _type == 'credit_card',
                    selectedColor: AppColors.accent.withValues(alpha: 0.2),
                    onSelected: (v) => setState(() => _type = 'credit_card'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 名稱
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: _type == 'bank' ? '銀行名稱' : '信用卡名稱',
                hintText: _type == 'bank' ? '例如：中國信託' : '例如：LINE Pay 卡',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),

            // 帳號
            TextField(
              controller: _accountNumberController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: _type == 'bank' ? '銀行帳號' : '信用卡卡號',
                hintText: _type == 'bank' ? '例如：00712345678901' : '例如：4311952612345678',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 餘額 / 已出帳金額
            TextField(
              controller: _balanceController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: _type == 'bank' ? '目前餘額' : '已出帳金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),

            // 信用卡額外欄位
            if (_type == 'credit_card') ...[
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
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                value: _billingDate,
                decoration: InputDecoration(
                  labelText: '結帳日',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.white,
                ),
                items: [
                  const DropdownMenuItem<int>(
                      value: null, child: Text('未設定')),
                  ...List.generate(
                      31,
                      (i) => DropdownMenuItem<int>(
                          value: i + 1, child: Text('每月 ${i + 1} 日'))),
                ],
                onChanged: (v) => setState(() => _billingDate = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                value: _paymentDate,
                decoration: InputDecoration(
                  labelText: '繳款日',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.white,
                ),
                items: [
                  const DropdownMenuItem<int>(
                      value: null, child: Text('未設定')),
                  ...List.generate(
                      31,
                      (i) => DropdownMenuItem<int>(
                          value: i + 1, child: Text('每月 ${i + 1} 日'))),
                ],
                onChanged: (v) => setState(() => _paymentDate = v),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: _submit,
          style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
          child: const Text('新增'),
        ),
      ],
    );
  }

  void _submit() {
    final balance = double.tryParse(_balanceController.text);
    if (_nameController.text.isEmpty || balance == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請填寫名稱和金額')),
      );
      return;
    }

    if (_type == 'credit_card') {
      final unbilled =
          double.tryParse(_unbilledAmountController.text) ?? 0;
      final total = balance + unbilled;
      context.read<AccountsBloc>().add(AddAccount(
            AccountsCompanion.insert(
              id: const Uuid().v4(),
              name: _nameController.text,
              type: _type,
              accountNumber: Value(_accountNumberController.text),
              balance: total.toString(),
              billingDate: Value(_billingDate),
              paymentDate: Value(_paymentDate),
              billedAmount: Value(balance.toString()),
              unbilledAmount: Value(unbilled.toString()),
              createdAt: DateTime.now(),
              updatedAt: DateTime.now(),
            ),
          ));
    } else {
      context.read<AccountsBloc>().add(AddAccount(
            AccountsCompanion.insert(
              id: const Uuid().v4(),
              name: _nameController.text,
              type: _type,
              accountNumber: Value(_accountNumberController.text),
              balance: balance.toString(),
              createdAt: DateTime.now(),
              updatedAt: DateTime.now(),
            ),
          ));
    }

    context.read<BalanceBloc>().add(const RefreshBalance());

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已新增：${_nameController.text}')),
    );
  }
}
