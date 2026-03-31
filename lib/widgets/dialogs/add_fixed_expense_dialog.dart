import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/fixed_expenses/fixed_expenses_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:uuid/uuid.dart';

/// 新增固定收支 Dialog
class AddFixedExpenseDialog extends StatefulWidget {
  const AddFixedExpenseDialog({super.key});

  @override
  State<AddFixedExpenseDialog> createState() => _AddFixedExpenseDialogState();
}

class _AddFixedExpenseDialogState extends State<AddFixedExpenseDialog> {
  final _nameController = TextEditingController();
  final _amountController = TextEditingController();
  String _type = 'expense';
  String _cycle = 'monthly';
  int _dueDay = 1;
  int _dueMonth = 1; // 年繳用：幾月
  int _startMonth = 1; // 非月繳用：起始月份
  String? _selectedAccountId;

  static const _cycles = {
    'monthly': '月繳',
    'bimonthly': '雙月繳',
    'quarterly': '季繳',
    'semi_annual': '半年繳',
    'annual': '年繳',
  };

  static const _monthNames = [
    '', '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  /// 根據起始月份和週期算出循環月份
  List<int> _getCycleMonths() {
    final interval = _cycleInterval();
    if (interval <= 0 || interval >= 12) return [_startMonth];
    final months = <int>[];
    var m = _startMonth;
    for (var i = 0; i < 12 ~/ interval; i++) {
      months.add(m);
      m = (m + interval - 1) % 12 + 1;
    }
    return months;
  }

  int _cycleInterval() {
    return switch (_cycle) {
      'bimonthly' => 2,
      'quarterly' => 3,
      'semi_annual' => 6,
      'annual' => 12,
      _ => 1,
    };
  }

  @override
  Widget build(BuildContext context) {
    final isIncome = _type == 'income';

    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('新增固定收支', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 收入/支出切換
            _buildTypeToggle(isIncome),
            const SizedBox(height: 16),

            // 名稱
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: '名稱',
                hintText: isIncome ? '例如：薪水' : '例如：房租',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),

            // 金額
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            // 週期
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _cycles.entries.map((entry) {
                final selected = _cycle == entry.key;
                return ChoiceChip(
                  label: Text(entry.value, style: const TextStyle(fontSize: 13)),
                  selected: selected,
                  selectedColor: AppColors.accent.withValues(alpha: 0.2),
                  onSelected: (v) => setState(() => _cycle = entry.key),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),

            // 根據週期顯示不同日期選擇
            _buildDateSelector(),
            const SizedBox(height: 12),

            // 付款/收款方式
            BlocBuilder<AccountsBloc, AccountsState>(
              builder: (context, state) {
                final accounts =
                    state is AccountsLoaded ? state.accounts : <Account>[];
                return DropdownButtonFormField<String>(
                  initialValue: _selectedAccountId,
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
                      final icon = a.type == 'credit_card' ? '💳' : '🏦';
                      return DropdownMenuItem(
                        value: a.id,
                        child: Text('$icon ${a.name}'),
                      );
                    }),
                  ],
                  onChanged: (v) => setState(() => _selectedAccountId = v),
                );
              },
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
          child: const Text('新增'),
        ),
      ],
    );
  }

  Widget _buildTypeToggle(bool isIncome) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _type = 'expense'),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: !isIncome
                      ? AppColors.error.withValues(alpha: 0.15)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '固定支出',
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
              onTap: () => setState(() => _type = 'income'),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isIncome
                      ? AppColors.success.withValues(alpha: 0.15)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '固定收入',
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
    );
  }

  /// 根據週期顯示不同的日期選擇器
  Widget _buildDateSelector() {
    switch (_cycle) {
      case 'monthly':
        return _buildDayDropdown('每月扣款/入帳日');

      case 'annual':
        return Column(
          children: [
            // 月份
            DropdownButtonFormField<int>(
              initialValue: _dueMonth,
              decoration: InputDecoration(
                labelText: '每年幾月',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              items: List.generate(
                12,
                (i) => DropdownMenuItem(
                  value: i + 1,
                  child: Text('${i + 1} 月'),
                ),
              ),
              onChanged: (v) => setState(() => _dueMonth = v ?? 1),
            ),
            const SizedBox(height: 12),
            _buildDayDropdown('每年幾號'),
          ],
        );

      default:
        // bimonthly / quarterly / semi_annual
        final interval = _cycleInterval();
        final cycleMonths = _getCycleMonths();
        final cycleLabel = switch (_cycle) {
          'bimonthly' => '雙月繳循環月份',
          'quarterly' => '季繳循環月份',
          'semi_annual' => '半年繳循環月份',
          _ => '循環月份',
        };

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 起始月份選擇
            DropdownButtonFormField<int>(
              initialValue: _startMonth,
              decoration: InputDecoration(
                labelText: '起始月份',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              items: List.generate(
                interval,
                (i) => DropdownMenuItem(
                  value: i + 1,
                  child: Text('${i + 1} 月起'),
                ),
              ),
              onChanged: (v) => setState(() => _startMonth = v ?? 1),
            ),
            const SizedBox(height: 8),
            // 顯示循環月份
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.accentCool.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$cycleLabel：${cycleMonths.map((m) => _monthNames[m]).join('、')}',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.accentCool.withValues(alpha: 1),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _buildDayDropdown('每次扣款日'),
          ],
        );
    }
  }

  Widget _buildDayDropdown(String label) {
    return DropdownButtonFormField<int>(
      initialValue: _dueDay,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
        fillColor: Colors.white,
      ),
      items: List.generate(
        31,
        (i) => DropdownMenuItem(
          value: i + 1,
          child: Text('${i + 1} 日'),
        ),
      ),
      onChanged: (v) => setState(() => _dueDay = v ?? 1),
    );
  }

  String _resolvePaymentMethod() {
    if (_selectedAccountId == null) return '現金';
    final state = context.read<AccountsBloc>().state;
    if (state is AccountsLoaded) {
      final account = state.accounts.where((a) => a.id == _selectedAccountId).firstOrNull;
      if (account != null) return account.name;
    }
    return '';
  }

  void _submit() {
    final amount = double.tryParse(_amountController.text);
    if (_nameController.text.isEmpty || amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請填寫名稱和有效金額')),
      );
      return;
    }

    // 計算到期日
    final now = DateTime.now();
    DateTime dueDate;

    switch (_cycle) {
      case 'monthly':
        // 下個扣款日
        dueDate = now.day >= _dueDay
            ? (now.month == 12
                ? DateTime(now.year + 1, 1, _dueDay)
                : DateTime(now.year, now.month + 1, _dueDay))
            : DateTime(now.year, now.month, _dueDay);
        break;

      case 'annual':
        // 今年或明年的指定月日
        dueDate = DateTime(now.year, _dueMonth, _dueDay);
        if (dueDate.isBefore(now)) {
          dueDate = DateTime(now.year + 1, _dueMonth, _dueDay);
        }
        break;

      default:
        // bimonthly / quarterly / semi_annual
        // 找下一個循環月份
        final cycleMonths = _getCycleMonths();
        int? nextMonth;
        for (final m in cycleMonths) {
          final candidate = DateTime(now.year, m, _dueDay);
          if (!candidate.isBefore(now)) {
            nextMonth = m;
            break;
          }
        }
        if (nextMonth == null) {
          // 今年的都過了，取明年第一個
          nextMonth = cycleMonths.first;
          dueDate = DateTime(now.year + 1, nextMonth, _dueDay);
        } else {
          dueDate = DateTime(now.year, nextMonth, _dueDay);
        }
        break;
    }

    context.read<FixedExpensesBloc>().add(AddFixedExpense(
      FixedExpensesCompanion.insert(
        id: const Uuid().v4(),
        name: _nameController.text,
        type: Value(_type),
        amount: amount.toString(),
        cycle: _cycle,
        dueDate: dueDate,
        paymentMethod: _resolvePaymentMethod(),
        reservedAmount: '0',
        createdAt: now,
        updatedAt: now,
      ),
    ));

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '已新增${_type == 'income' ? '固定收入' : '固定支出'}：${_nameController.text}',
        ),
      ),
    );
  }
}
