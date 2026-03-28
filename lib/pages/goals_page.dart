import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/goal_card.dart';

/// 儲蓄目標頁面
/// 分為有期限目標與無期限目標兩區
class GoalsPage extends StatelessWidget {
  const GoalsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: BlocBuilder<GoalsBloc, GoalsState>(
        builder: (context, state) {
          if (state is GoalsLoaded && state.goals.isNotEmpty) {
            return _buildFromBloc(state.goals);
          }
          // 初始 / 載入中 / 錯誤時顯示 mock 資料
          return _buildMockContent();
        },
      ),
    );
  }

  /// 從 BLoC 資料建立頁面
  Widget _buildFromBloc(List<SavingsGoal> goals) {
    // 依期限分組
    final withDeadline =
        goals.where((g) => g.deadline != null).toList();
    final withoutDeadline =
        goals.where((g) => g.deadline == null).toList();

    return CustomScrollView(
      slivers: [
        // 大標題
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppTheme.spacingMd,
              AppTheme.spacingLg,
              AppTheme.spacingMd,
              AppTheme.spacingMd,
            ),
            child: Text('儲蓄目標', style: AppTextStyles.pageTitle()),
          ),
        ),

        // ========== 有期限區 ==========
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
                (context, index) {
                  final goal = withDeadline[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: index < withDeadline.length - 1
                          ? AppTheme.cardGap
                          : 0,
                    ),
                    child: _buildGoalCard(goal),
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

        // ========== 無期限區 ==========
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
                (context, index) {
                  final goal = withoutDeadline[index];
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: index < withoutDeadline.length - 1
                          ? AppTheme.cardGap
                          : AppTheme.spacing2xl,
                    ),
                    child: _buildGoalCard(goal),
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

  /// 從 SavingsGoal 資料建立 GoalCard
  Widget _buildGoalCard(SavingsGoal goal) {
    final target = Decimal.parse(goal.targetAmount);
    final current = Decimal.parse(goal.currentAmount);
    final progress =
        target > Decimal.zero ? (current / target).toDouble() : 0.0;

    // 計算剩餘月數
    String? deadlineText;
    if (goal.deadline != null) {
      final now = DateTime.now();
      final monthsLeft =
          (goal.deadline!.year - now.year) * 12 +
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
    );
  }

  /// Mock 內容（fallback）
  Widget _buildMockContent() {
    return CustomScrollView(
      slivers: [
        // 大標題
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppTheme.spacingMd,
              AppTheme.spacingLg,
              AppTheme.spacingMd,
              AppTheme.spacingMd,
            ),
            child: Text('儲蓄目標', style: AppTextStyles.pageTitle()),
          ),
        ),

        // ========== 有期限區 ==========
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
            delegate: SliverChildListDelegate([
              const GoalCard(
                emoji: '\u{1F3EF}',
                name: '京都旅遊',
                currentAmount: '34,000',
                targetAmount: '50,000',
                progress: 0.68,
                deadline: '2026 年 10 月 — 還剩 6 個月',
              ),
              const SizedBox(height: AppTheme.cardGap),
              const GoalCard(
                emoji: '\u{1F334}',
                name: '曼谷自由行',
                currentAmount: '10,500',
                targetAmount: '30,000',
                progress: 0.35,
                deadline: '2026 年 12 月 — 還剩 8 個月',
              ),
            ]),
          ),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.sectionGap),
        ),

        // ========== 無期限區 ==========
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
            delegate: SliverChildListDelegate([
              const GoalCard(
                emoji: '\u{1F4BB}',
                name: 'MacBook Pro',
                currentAmount: '28,000',
                targetAmount: '65,000',
                progress: 0.43,
              ),
              const SizedBox(height: AppTheme.cardGap),
              const GoalCard(
                emoji: '\u{1F6E1}',
                name: '緊急預備金',
                currentAmount: '45,000',
                targetAmount: '100,000',
                progress: 0.45,
              ),
              const SizedBox(height: AppTheme.spacing2xl),
            ]),
          ),
        ),
      ],
    );
  }

  /// 格式化金額為千分位字串
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
