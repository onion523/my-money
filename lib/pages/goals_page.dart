import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/dialogs/add_saving_dialog.dart';
import 'package:my_money/widgets/dialogs/edit_goal_dialog.dart';
import 'package:my_money/widgets/goal_card.dart';

/// 儲蓄目標頁面 — 新刪修查
class GoalsPage extends StatelessWidget {
  const GoalsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: BlocBuilder<GoalsBloc, GoalsState>(
        builder: (context, state) {
          final goals =
              state is GoalsLoaded ? state.goals : <SavingsGoal>[];

          if (goals.isEmpty) {
            return _buildEmptyState(context);
          }
          return _buildFromBloc(context, goals);
        },
      ),
    );
  }

  /// 從 BLoC 資料建立頁面
  Widget _buildFromBloc(BuildContext context, List<SavingsGoal> goals) {
    final withDeadline = goals.where((g) => g.deadline != null).toList();
    final withoutDeadline = goals.where((g) => g.deadline == null).toList();

    return CustomScrollView(
      slivers: [
        // 大標題 + 新增按鈕
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppTheme.spacingMd,
              AppTheme.spacingLg,
              AppTheme.spacingMd,
              AppTheme.spacingMd,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('儲蓄目標', style: AppTextStyles.pageTitle()),
                IconButton(
                  onPressed: () => _openAddDialog(context),
                  icon: const Icon(Icons.add_circle_outline),
                  color: AppColors.accent,
                  tooltip: '新增目標',
                  iconSize: 28,
                ),
              ],
            ),
          ),
        ),

        // 有期限區
        if (withDeadline.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              child: Row(
                children: [
                  const Text('\u{23F3}', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text('有期限目標', style: AppTextStyles.cardTitle()),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.spacingSm),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, index) {
                  final goal = withDeadline[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: index < withDeadline.length - 1
                          ? AppTheme.cardGap
                          : 0,
                    ),
                    child: _buildGoalCard(ctx, goal),
                  );
                },
                childCount: withDeadline.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),
        ],

        // 無期限區
        if (withoutDeadline.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              child: Row(
                children: [
                  const Text('\u{2728}', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text('無期限目標', style: AppTextStyles.cardTitle()),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.spacingSm),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, index) {
                  final goal = withoutDeadline[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: index < withoutDeadline.length - 1
                          ? AppTheme.cardGap
                          : AppTheme.spacing2xl,
                    ),
                    child: _buildGoalCard(ctx, goal),
                  );
                },
                childCount: withoutDeadline.length,
              ),
            ),
          ),
        ],
      ],
    );
  }

  /// 建立目標卡片（含編輯/刪除按鈕）
  Widget _buildGoalCard(BuildContext context, SavingsGoal goal) {
    final target = Decimal.parse(goal.targetAmount);
    final current = Decimal.parse(goal.currentAmount);
    final progress =
        target > Decimal.zero ? (current / target).toDouble() : 0.0;

    String? deadlineText;
    if (goal.deadline != null) {
      final now = DateTime.now();
      final monthsLeft = (goal.deadline!.year - now.year) * 12 +
          (goal.deadline!.month - now.month);
      deadlineText =
          '${goal.deadline!.year} 年 ${goal.deadline!.month} 月 — 還剩 $monthsLeft 個月';
    }

    return GoalCard(
      emoji: goal.emoji,
      name: goal.name,
      currentAmount: _formatAmount(current),
      targetAmount: _formatAmount(target),
      progress: progress,
      deadline: deadlineText,
      onEdit: () => showDialog(
        context: context,
        builder: (_) => EditGoalDialog(goal: goal),
      ),
      onDelete: () => _confirmDelete(context, goal),
    );
  }

  /// 空狀態
  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.savings_outlined,
                size: 40,
                color: AppColors.accent,
              ),
            ),
            const SizedBox(height: 24),
            Text('還沒有儲蓄目標', style: AppTextStyles.cardTitle()),
            const SizedBox(height: 8),
            Text(
              '設定一個目標，開始存錢吧',
              style: AppTextStyles.body(color: AppColors.secondaryText),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _openAddDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('新增目標'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openAddDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => const AddSavingDialog(),
    );
  }

  void _confirmDelete(BuildContext context, SavingsGoal goal) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('確認刪除'),
        content: Text('確定要刪除「${goal.name}」嗎？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              context.read<GoalsBloc>().add(DeleteGoal(goal.id));
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('已刪除：${goal.name}')),
              );
            },
            child: Text('刪除', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  static String _formatAmount(Decimal amount) {
    final intPart = amount.truncate().toBigInt().abs().toString();
    final formatted = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) {
        formatted.write(',');
      }
      formatted.write(intPart[i]);
    }
    return formatted.toString();
  }
}
