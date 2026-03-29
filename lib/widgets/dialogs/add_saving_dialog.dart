import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:uuid/uuid.dart';

/// 存入儲蓄目標 Dialog
class AddSavingDialog extends StatefulWidget {
  const AddSavingDialog({super.key});

  @override
  State<AddSavingDialog> createState() => _AddSavingDialogState();
}

class _AddSavingDialogState extends State<AddSavingDialog> {
  final _nameController = TextEditingController();
  final _targetController = TextEditingController();
  String _category = '旅遊';
  bool _hasDeadline = true;
  DateTime _deadline = DateTime.now().add(const Duration(days: 180));

  final _categories = ['旅遊', '購物', '儲蓄', '教育', '其他'];

  @override
  void dispose() {
    _nameController.dispose();
    _targetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('新增儲蓄目標', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: '目標名稱（例如：日本京都）',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _targetController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '目標金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: _categories.map((cat) {
                final selected = _category == cat;
                return ChoiceChip(
                  label: Text(cat),
                  selected: selected,
                  selectedColor: AppColors.accent.withValues(alpha: 0.2),
                  onSelected: (v) => setState(() => _category = cat),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              title: const Text('設定期限'),
              subtitle: Text(_hasDeadline ? '有期限，會佔月預算' : '無期限，有閒錢再存'),
              value: _hasDeadline,
              activeColor: AppColors.accent,
              onChanged: (v) => setState(() => _hasDeadline = v),
              contentPadding: EdgeInsets.zero,
            ),
            if (_hasDeadline)
              ListTile(
                title: const Text('目標日期'),
                subtitle: Text('${_deadline.year}/${_deadline.month}/${_deadline.day}'),
                trailing: const Icon(Icons.calendar_today),
                contentPadding: EdgeInsets.zero,
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: _deadline,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 3650)),
                  );
                  if (date != null) setState(() => _deadline = date);
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
          child: const Text('建立'),
        ),
      ],
    );
  }

  void _submit() {
    final target = double.tryParse(_targetController.text);
    if (_nameController.text.isEmpty || target == null || target <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請填寫名稱和有效金額')),
      );
      return;
    }

    final emoji = _category == '旅遊' ? '✈️' : _category == '購物' ? '🛍️' : '💰';
    context.read<GoalsBloc>().add(AddGoal(
      SavingsGoalsCompanion.insert(
        id: const Uuid().v4(),
        name: _nameController.text,
        targetAmount: target.toString(),
        currentAmount: '0',
        category: _category,
        deadline: Value(_hasDeadline ? _deadline : null),
        monthlyReserve: '0',
        emoji: emoji,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    ));

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已建立目標：${_nameController.text}')),
    );
  }
}
