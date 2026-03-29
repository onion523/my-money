import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';

/// 編輯信用卡 Dialog
/// 可修改名稱、已出帳金額、未入帳金額、結帳日、扣繳日，或刪除
class EditCreditCardDialog extends StatefulWidget {
  final Account account;

  const EditCreditCardDialog({super.key, required this.account});

  @override
  State<EditCreditCardDialog> createState() => _EditCreditCardDialogState();
}

class _EditCreditCardDialogState extends State<EditCreditCardDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _billedAmountController;
  late final TextEditingController _unbilledAmountController;
  int? _billingDate;
  int? _paymentDate;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.account.name);
    _billedAmountController = TextEditingController(
      text: widget.account.billedAmount ?? '0',
    );
    _unbilledAmountController = TextEditingController(
      text: widget.account.unbilledAmount ?? '0',
    );
    _billingDate = widget.account.billingDate;
    _paymentDate = widget.account.paymentDate;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _billedAmountController.dispose();
    _unbilledAmountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('編輯信用卡', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 名稱
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: '信用卡名稱',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 已出帳金額
            TextField(
              controller: _billedAmountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '已出帳金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 未入帳金額
            TextField(
              controller: _unbilledAmountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '未入帳金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 結帳日
            _buildDateDropdown(
              label: '結帳日',
              value: _billingDate,
              onChanged: (v) => setState(() => _billingDate = v),
            ),
            const SizedBox(height: 12),

            // 扣繳日
            _buildDateDropdown(
              label: '扣繳日',
              value: _paymentDate,
              onChanged: (v) => setState(() => _paymentDate = v),
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

  /// 日期下拉選單（1-31）
  Widget _buildDateDropdown({
    required String label,
    required int? value,
    required ValueChanged<int?> onChanged,
  }) {
    return DropdownButtonFormField<int>(
      value: value,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
        fillColor: Colors.white,
      ),
      items: [
        const DropdownMenuItem<int>(
          value: null,
          child: Text('未設定'),
        ),
        ...List.generate(31, (i) => i + 1).map(
          (day) => DropdownMenuItem<int>(
            value: day,
            child: Text('每月 $day 日'),
          ),
        ),
      ],
      onChanged: onChanged,
    );
  }

  /// 提交更新
  void _submit() {
    if (_nameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請填寫信用卡名稱')),
      );
      return;
    }

    final billedAmount = double.tryParse(_billedAmountController.text) ?? 0;
    final unbilledAmount = double.tryParse(_unbilledAmountController.text) ?? 0;
    // 信用卡的 balance 為已出帳 + 未入帳的負值總和
    final totalBalance = billedAmount + unbilledAmount;

    final updated = widget.account.copyWith(
      name: _nameController.text,
      balance: totalBalance.toString(),
      billedAmount: Value(billedAmount.toString()),
      unbilledAmount: Value(unbilledAmount.toString()),
      billingDate: Value(_billingDate),
      paymentDate: Value(_paymentDate),
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
