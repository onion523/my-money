import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';

class EditGoalDialog extends StatefulWidget {
  final SavingsGoal goal;
  const EditGoalDialog({super.key, required this.goal});

  @override
  State<EditGoalDialog> createState() => _EditGoalDialogState();
}

class _EditGoalDialogState extends State<EditGoalDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _targetController;
  late final TextEditingController _currentController;
  late final TextEditingController _emojiController;
  late String _category;
  late bool _hasDeadline;
  late DateTime _deadline;

  final _categories = ['旅遊', '購物', '儲蓄', '教育', '其他'];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.goal.name);
    _targetController = TextEditingController(text: widget.goal.targetAmount);
    _currentController = TextEditingController(text: widget.goal.currentAmount);
    _emojiController = TextEditingController(text: widget.goal.emoji);
    _category = widget.goal.category.isEmpty ? '儲蓄' : widget.goal.category;
    _hasDeadline = widget.goal.deadline != null;
    _deadline = widget.goal.deadline ?? DateTime.now().add(const Duration(days: 180));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _targetController.dispose();
    _currentController.dispose();
    _emojiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFFF5F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('編輯儲蓄目標', style: TextStyle(fontWeight: FontWeight.w700)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: '目標名稱',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emojiController,
              decoration: InputDecoration(
                labelText: '表情符號',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
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
            TextField(
              controller: _currentController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: '已存金額',
                prefixText: '\$ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
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
          child: const Text('儲存'),
        ),
      ],
    );
  }

  void _submit() {
    final target = double.tryParse(_targetController.text);
    final current = double.tryParse(_currentController.text);
    if (_nameController.text.isEmpty || target == null || target <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('請填寫名稱和有效金額')),
      );
      return;
    }

    final updated = widget.goal.copyWith(
      name: _nameController.text,
      targetAmount: target.toString(),
      currentAmount: (current ?? 0).toString(),
      category: _category,
      emoji: _emojiController.text.isEmpty ? '🎯' : _emojiController.text,
      deadline: Value(_hasDeadline ? _deadline : null),
      monthlyReserve: widget.goal.monthlyReserve,
      updatedAt: DateTime.now(),
    );

    context.read<GoalsBloc>().add(UpdateGoal(updated));

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已更新：${_nameController.text}')),
    );
  }
}
