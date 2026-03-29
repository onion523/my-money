import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';

/// 編輯帳戶 Dialog — 銀行帳戶用
/// 可修改名稱、類型、餘額，或刪除帳戶
class EditAccountDialog extends StatefulWidget {
  final Account account;

  const EditAccountDialog({super.key, required this.account});

  @override
  State<EditAccountDialog> createState() => _EditAccountDialogState();
}

class _EditAccountDialogState extends State<EditAccountDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _balanceController;
  late String _type;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.account.name);
    _balanceController = TextEditingController(text: widget.account.balance);
    _type = widget.account.type;
  }

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
      title: const Text('編輯帳戶', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 類型選擇
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
                labelText: '帳戶名稱',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 餘額
            TextField(
              controller: _balanceController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '餘額',
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
        // 刪除按鈕
        TextButton(
          onPressed: _confirmDelete,
          style: TextButton.styleFrom(foregroundColor: AppColors.error),
          child: const Text('刪除'),
        ),
        const Spacer(),
        // 取消
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        // 儲存
        FilledButton(
          onPressed: _submit,
          style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
          child: const Text('儲存'),
        ),
      ],
    );
  }

  /// 提交更新
  void _submit() {
    final balance = double.tryParse(_balanceController.text);
    if (_nameController.text.isEmpty || balance == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請填寫名稱和有效金額')),
      );
      return;
    }

    final updated = widget.account.copyWith(
      name: _nameController.text,
      type: _type,
      balance: balance.toString(),
      updatedAt: DateTime.now(),
    );

    context.read<AccountsBloc>().add(UpdateAccount(updated));
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已更新：${_nameController.text}')),
    );
  }

  /// 確認刪除
  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFFFFF5F5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('確認刪除', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text('確定要刪除「${widget.account.name}」嗎？此操作無法復原。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              context.read<AccountsBloc>().add(DeleteAccount(widget.account.id));
              Navigator.pop(ctx); // 關閉確認 Dialog
              Navigator.pop(context); // 關閉編輯 Dialog
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('已刪除：${widget.account.name}')),
              );
            },
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('刪除'),
          ),
        ],
      ),
    );
  }
}
