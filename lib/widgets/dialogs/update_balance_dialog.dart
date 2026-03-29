import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:uuid/uuid.dart';

/// 更新帳戶餘額 / 新增帳戶 Dialog
class UpdateBalanceDialog extends StatefulWidget {
  const UpdateBalanceDialog({super.key});

  @override
  State<UpdateBalanceDialog> createState() => _UpdateBalanceDialogState();
}

class _UpdateBalanceDialogState extends State<UpdateBalanceDialog> {
  final _nameController = TextEditingController();
  final _balanceController = TextEditingController();
  String _type = 'bank';

  @override
  void dispose() {
    _nameController.dispose();
    _balanceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('新增/更新帳戶', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
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
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: _type == 'bank' ? '銀行名稱（例如：中國信託）' : '信用卡名稱（例如：LINE Pay 卡）',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _balanceController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: _type == 'bank' ? '目前餘額' : '已出帳金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
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
          child: const Text('儲存'),
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

    context.read<AccountsBloc>().add(AddAccount(
      AccountsCompanion.insert(
        id: const Uuid().v4(),
        name: _nameController.text,
        type: _type,
        balance: balance.toString(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    ));

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已新增：${_nameController.text}')),
    );
  }
}
