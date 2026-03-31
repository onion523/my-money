import 'package:drift/drift.dart' as drift;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/pages/onboarding/onboarding_complete_page.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:uuid/uuid.dart';

/// 設定儲蓄目標頁面（選填）
class SetupGoalPage extends StatefulWidget {
  const SetupGoalPage({super.key});

  @override
  State<SetupGoalPage> createState() => _SetupGoalPageState();
}

class _SetupGoalPageState extends State<SetupGoalPage> {
  /// 已新增的目標列表
  final List<_GoalEntry> _goals = [];

  final _nameController = TextEditingController();
  final _amountController = TextEditingController();
  final _emojiController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  DateTime? _selectedDeadline;

  @override
  void dispose() {
    _nameController.dispose();
    _amountController.dispose();
    _emojiController.dispose();
    super.dispose();
  }

  /// 選擇期限日期
  Future<void> _pickDeadline() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDeadline ?? DateTime.now().add(const Duration(days: 180)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (date != null) {
      setState(() => _selectedDeadline = date);
    }
  }

  /// 新增目標到列表
  void _addGoal() {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _goals.add(_GoalEntry(
        name: _nameController.text.trim(),
        targetAmount: _amountController.text.trim(),
        emoji: _emojiController.text.trim().isEmpty
            ? '🎯'
            : _emojiController.text.trim(),
        deadline: _selectedDeadline,
      ));
      _nameController.clear();
      _amountController.clear();
      _emojiController.clear();
      _selectedDeadline = null;
    });
  }

  /// 移除目標
  void _removeGoal(int index) {
    setState(() => _goals.removeAt(index));
  }

  /// 儲存目標並完成
  void _saveAndComplete() {
    final goalsBloc = context.read<GoalsBloc>();
    final now = DateTime.now();
    const uuid = Uuid();

    // 將所有目標寫入 BLoC
    for (final goal in _goals) {
      goalsBloc.add(AddGoal(SavingsGoalsCompanion(
        id: drift.Value(uuid.v4()),
        name: drift.Value(goal.name),
        targetAmount: drift.Value(goal.targetAmount),
        currentAmount: const drift.Value('0'),
        category: const drift.Value('一般'),
        deadline: drift.Value(goal.deadline),
        monthlyReserve: const drift.Value('0'),
        emoji: drift.Value(goal.emoji),
        createdAt: drift.Value(now),
        updatedAt: drift.Value(now),
      )));
    }

    _navigateToComplete();
  }

  /// 跳過並前往完成頁
  void _skip() {
    _navigateToComplete();
  }

  /// 導航到完成頁
  void _navigateToComplete() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const OnboardingCompletePage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingLg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 標題
              _buildHeader(),

              const SizedBox(height: AppTheme.spacingLg),

              // 新增目標表單
              _buildAddForm(),

              const SizedBox(height: AppTheme.spacingLg),

              // 已新增目標列表
              Expanded(child: _buildGoalList()),

              // 按鈕區
              _buildButtons(),

              const SizedBox(height: AppTheme.spacingLg),
            ],
          ),
        ),
      ),
    );
  }

  /// 建構標題
  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 步驟指示
        Text(
          '步驟 2/3',
          style: AppTextStyles.label(color: AppColors.accent),
        ),
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          '有什麼想存的嗎？',
          style: GoogleFonts.zenMaruGothic(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: AppColors.primaryText,
          ),
        ),
        const SizedBox(height: AppTheme.spacingXs),
        Text(
          '設定儲蓄目標，讓我們幫你追蹤進度（選填）',
          style: AppTextStyles.caption(),
        ),
      ],
    );
  }

  /// 建構新增目標表單
  Widget _buildAddForm() {
    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 目標名稱 + 表情符號
            Row(
              children: [
                // 表情符號
                SizedBox(
                  width: 64,
                  child: TextFormField(
                    controller: _emojiController,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24),
                    decoration: const InputDecoration(
                      hintText: '🎯',
                      hintStyle: TextStyle(fontSize: 24),
                      contentPadding: EdgeInsets.symmetric(vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingSm),
                // 名稱
                Expanded(
                  child: TextFormField(
                    controller: _nameController,
                    textInputAction: TextInputAction.next,
                    style: AppTextStyles.body(),
                    decoration: const InputDecoration(
                      labelText: '目標名稱',
                      hintText: '例如：日本旅行',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return '請輸入目標名稱';
                      }
                      return null;
                    },
                  ),
                ),
              ],
            ),

            const SizedBox(height: AppTheme.spacingMd),

            // 目標金額
            TextFormField(
              controller: _amountController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
              ],
              textInputAction: TextInputAction.done,
              style: AppTextStyles.body(),
              decoration: const InputDecoration(
                labelText: '目標金額',
                hintText: '例如：100000',
                prefixIcon: Icon(
                  Icons.attach_money_rounded,
                  color: AppColors.secondaryText,
                ),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return '請輸入目標金額';
                }
                if (double.tryParse(value.trim()) == null) {
                  return '請輸入有效的金額';
                }
                return null;
              },
              onFieldSubmitted: (_) => _addGoal(),
            ),

            const SizedBox(height: AppTheme.spacingMd),

            // 期限選擇
            GestureDetector(
              onTap: _pickDeadline,
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: '目標期限（選填）',
                  prefixIcon: Icon(
                    Icons.calendar_today_rounded,
                    color: AppColors.secondaryText,
                  ),
                ),
                child: Text(
                  _selectedDeadline != null
                      ? '${_selectedDeadline!.year}/${_selectedDeadline!.month}/${_selectedDeadline!.day}'
                      : '點選設定期限',
                  style: AppTextStyles.body(
                    color: _selectedDeadline != null
                        ? AppColors.primaryText
                        : AppColors.secondaryText,
                  ),
                ),
              ),
            ),

            const SizedBox(height: AppTheme.spacingMd),

            // 新增按鈕
            SizedBox(
              height: 44,
              child: OutlinedButton.icon(
                onPressed: _addGoal,
                icon: const Icon(Icons.add_rounded),
                label: const Text('新增目標'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.accent,
                  side: const BorderSide(color: AppColors.accent),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppTheme.buttonRadius),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 建構已新增目標列表
  Widget _buildGoalList() {
    if (_goals.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.savings_rounded,
              size: 48,
              color: AppColors.secondaryText.withValues(alpha: 0.3),
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              '尚未新增目標',
              style: AppTextStyles.caption(
                color: AppColors.secondaryText.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      itemCount: _goals.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppTheme.spacingSm),
      itemBuilder: (context, index) {
        final goal = _goals[index];
        return Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.cardPadding,
            vertical: AppTheme.spacingSm + AppTheme.spacingXs,
          ),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTheme.inputRadius),
            border: Border.all(
              color: AppColors.secondaryText.withValues(alpha: 0.1),
            ),
          ),
          child: Row(
            children: [
              // 表情符號
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.accentWarm.withValues(alpha: 0.2),
                ),
                child: Center(
                  child: Text(
                    goal.emoji,
                    style: const TextStyle(fontSize: 20),
                  ),
                ),
              ),
              const SizedBox(width: AppTheme.spacingSm + AppTheme.spacingXs),
              // 目標資訊
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(goal.name, style: AppTextStyles.bodyBold()),
                    Text(
                      goal.deadline != null
                          ? '\$ ${goal.targetAmount}・${goal.deadline!.year}/${goal.deadline!.month}/${goal.deadline!.day}'
                          : '\$ ${goal.targetAmount}',
                      style:
                          AppTextStyles.caption(color: AppColors.accentWarm),
                    ),
                  ],
                ),
              ),
              // 刪除按鈕
              IconButton(
                icon: Icon(
                  Icons.close_rounded,
                  size: 20,
                  color: AppColors.secondaryText.withValues(alpha: 0.5),
                ),
                onPressed: () => _removeGoal(index),
              ),
            ],
          ),
        );
      },
    );
  }

  /// 建構底部按鈕區
  Widget _buildButtons() {
    return Column(
      children: [
        // 完成按鈕（有目標時顯示）
        if (_goals.isNotEmpty)
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _saveAndComplete,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTheme.inputRadius),
                ),
                elevation: 0,
              ),
              child: Text(
                '完成',
                style: AppTextStyles.bodyBold(color: Colors.white),
              ),
            ),
          ),

        if (_goals.isNotEmpty)
          const SizedBox(height: AppTheme.spacingSm),

        // 先跳過按鈕
        SizedBox(
          width: double.infinity,
          height: 48,
          child: TextButton(
            onPressed: _skip,
            child: Text(
              _goals.isEmpty ? '先跳過' : '先跳過，之後再設定',
              style: AppTextStyles.body(color: AppColors.secondaryText),
            ),
          ),
        ),
      ],
    );
  }
}

/// 目標條目資料
class _GoalEntry {
  final String name;
  final String targetAmount;
  final String emoji;
  final DateTime? deadline;

  const _GoalEntry({
    required this.name,
    required this.targetAmount,
    required this.emoji,
    this.deadline,
  });
}
