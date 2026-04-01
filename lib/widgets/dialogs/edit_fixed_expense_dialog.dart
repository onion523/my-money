import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/fixed_expenses/fixed_expenses_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';

/// 編輯固定收支 Dialog
class EditFixedExpenseDialog extends StatefulWidget {
  final FixedExpense item;
  const EditFixedExpenseDialog({super.key, required this.item});

  @override
  State<EditFixedExpenseDialog> createState() => _EditFixedExpenseDialogState();
}

class _EditFixedExpenseDialogState extends State<EditFixedExpenseDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _amountController;
  late final TextEditingController _reservedController;
  late String _type;
  late String _cycle;
  late int _dueDay;
  late int _dueMonth;
  late int _startMonth;
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
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.item.name);
    _amountController = TextEditingController(text: widget.item.amount);
    _reservedController =
        TextEditingController(text: widget.item.reservedAmount);
    _type = widget.item.type;
    _cycle = widget.item.cycle;
    _dueDay = widget.item.dueDate.day;
    _dueMonth = widget.item.dueDate.month;
    _startMonth = widget.item.dueDate.month;
    // 對於有週期的，嘗試推算起始月份
    final interval = _cycleInterval();
    if (interval > 1 && interval < 12) {
      _startMonth = ((_dueMonth - 1) % interval) + 1;
    }
    _selectedAccountId = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = context.read<AccountsBloc>().state;
      if (state is AccountsLoaded && widget.item.paymentMethod.isNotEmpty) {
        final match = state.accounts
            .where((a) => a.name == widget.item.paymentMethod)
            .firstOrNull;
        if (match != null) {
          setState(() => _selectedAccountId = match.id);
        }
      }
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _amountController.dispose();
    _reservedController.dispose();
    super.dispose();
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

  @override
  Widget build(BuildContext context) {
    final isIncome = _type == 'income';

    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('編輯固定收支', style: TextStyle(fontWeight: FontWeight.w700)),
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
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
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

            // 已預留金額（僅非月繳支出顯示）
            if (_cycle != 'monthly' && _type == 'expense') ...[
              TextField(
                controller: _reservedController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: '已預留金額',
                  prefixText: '\$ ',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              const SizedBox(height: 12),
            ],

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
          onPressed: _confirmDelete,
          style: TextButton.styleFrom(foregroundColor: AppColors.error),
          child: const Text('刪除'),
        ),
        const Spacer(),
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

  Widget _buildDateSelector() {
    switch (_cycle) {
      case 'monthly':
        return _buildDayDropdown('每月扣款/入帳日');

      case 'annual':
        return Column(
          children: [
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
            _buildDayDropdown('每次扣款/入帳日'),
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

    final reserved = double.tryParse(_reservedController.text) ?? 0;
    final now = DateTime.now();
    DateTime dueDate;

    switch (_cycle) {
      case 'monthly':
        dueDate = now.day >= _dueDay
            ? (now.month == 12
                ? DateTime(now.year + 1, 1, _dueDay)
                : DateTime(now.year, now.month + 1, _dueDay))
            : DateTime(now.year, now.month, _dueDay);
        break;

      case 'annual':
        dueDate = DateTime(now.year, _dueMonth, _dueDay);
        if (dueDate.isBefore(now)) {
          dueDate = DateTime(now.year + 1, _dueMonth, _dueDay);
        }
        break;

      default:
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
          nextMonth = cycleMonths.first;
          dueDate = DateTime(now.year + 1, nextMonth, _dueDay);
        } else {
          dueDate = DateTime(now.year, nextMonth, _dueDay);
        }
        break;
    }

    final updated = widget.item.copyWith(
      name: _nameController.text,
      type: _type,
      amount: amount.toString(),
      cycle: _cycle,
      dueDate: dueDate,
      paymentMethod: _resolvePaymentMethod(),
      reservedAmount: reserved.toString(),
      updatedAt: DateTime.now(),
    );

    context.read<FixedExpensesBloc>().add(UpdateFixedExpense(updated));
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已更新：${_nameController.text}')),
    );
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('確認刪除'),
        content: Text('確定要刪除「${widget.item.name}」嗎？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              context
                  .read<FixedExpensesBloc>()
                  .add(DeleteFixedExpense(widget.item.id));
              Navigator.pop(ctx);
              Navigator.pop(context);
            },
            child: Text('刪除', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}
