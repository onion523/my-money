import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:uuid/uuid.dart';

/// 記帳 Dialog — 支援花費和收入
class AddTransactionDialog extends StatefulWidget {
  /// 預設類型：expense 或 income
  final String initialType;

  const AddTransactionDialog({
    super.key,
    this.initialType = 'expense',
  });

  @override
  State<AddTransactionDialog> createState() => _AddTransactionDialogState();
}

class _AddTransactionDialogState extends State<AddTransactionDialog> {
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  late String _type;
  String _category = '餐飲';
  String? _selectedAccountId; // null = 現金

  final _expenseCategories = ['餐飲', '交通', '娛樂', '購物', '生活', '醫療', '教育', '其他'];
  final _incomeCategories = ['薪水', '獎金', '兼職', '投資', '退款', '其他'];

  @override
  void initState() {
    super.initState();
    _type = widget.initialType;
    _category = _type == 'income' ? '薪水' : '餐飲';
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  List<String> get _currentCategories =>
      _type == 'income' ? _incomeCategories : _expenseCategories;

  @override
  Widget build(BuildContext context) {
    final isIncome = _type == 'income';

    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        isIncome ? '記一筆收入' : '記一筆花費',
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 收入/支出切換
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _type = 'expense';
                        _category = '餐飲';
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: !isIncome
                              ? AppColors.error.withValues(alpha: 0.15)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '支出',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: !isIncome ? AppColors.error : Colors.grey,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _type = 'income';
                        _category = '薪水';
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: isIncome
                              ? AppColors.success.withValues(alpha: 0.15)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '收入',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: isIncome ? AppColors.success : Colors.grey,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 金額
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '金額',
                prefixText: isIncome ? '+ \$ ' : '- \$ ',
                prefixStyle: TextStyle(
                  color: isIncome ? AppColors.success : AppColors.error,
                  fontWeight: FontWeight.w600,
                ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),

            // 帳戶選擇
            BlocBuilder<AccountsBloc, AccountsState>(
              builder: (context, state) {
                final accounts =
                    state is AccountsLoaded ? state.accounts : <Account>[];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: DropdownButtonFormField<String>(
                    value: _selectedAccountId,
                    decoration: InputDecoration(
                      labelText: isIncome ? '入帳帳戶' : '付款方式',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('💵 現金'),
                      ),
                      ...accounts.map((a) {
                        final icon =
                            a.type == 'credit_card' ? '💳' : '🏦';
                        return DropdownMenuItem(
                          value: a.id,
                          child: Text('$icon ${a.name}'),
                        );
                      }),
                    ],
                    onChanged: (v) =>
                        setState(() => _selectedAccountId = v),
                  ),
                );
              },
            ),

            // 備註
            TextField(
              controller: _noteController,
              decoration: InputDecoration(
                labelText: isIncome ? '備註（例如：3月薪水）' : '備註（例如：午餐牛肉麵）',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 分類
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _currentCategories.map((cat) {
                final selected = _category == cat;
                return ChoiceChip(
                  label: Text(cat, style: const TextStyle(fontSize: 13)),
                  selected: selected,
                  selectedColor: (isIncome ? AppColors.success : AppColors.accent)
                      .withValues(alpha: 0.2),
                  onSelected: (v) => setState(() => _category = cat),
                );
              }).toList(),
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
          style: FilledButton.styleFrom(
            backgroundColor: isIncome ? AppColors.success : AppColors.accent,
          ),
          child: const Text('記錄'),
        ),
      ],
    );
  }

  void _submit() {
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請輸入有效金額')),
      );
      return;
    }
    final note = _noteController.text.isEmpty ? _category : _noteController.text;
    final isIncome = _type == 'income';

    context.read<ExpensesBloc>().add(AddExpense(
      TransactionsCompanion.insert(
        id: const Uuid().v4(),
        type: _type,
        amount: amount.toString(),
        date: DateTime.now(),
        note: note,
        category: _category,
        accountId: Value(_selectedAccountId),
        createdAt: DateTime.now(),
      ),
    ));

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isIncome
            ? '已記錄收入：$note +\$$amount'
            : '已記錄花費：$note -\$$amount'),
      ),
    );
  }
}
