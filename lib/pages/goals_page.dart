import 'package:flutter/material.dart';
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
      child: CustomScrollView(
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
                // 京都旅遊
                const GoalCard(
                  emoji: '\u{1F3EF}',
                  name: '京都旅遊',
                  currentAmount: '34,000',
                  targetAmount: '50,000',
                  progress: 0.68,
                  deadline: '2026 年 10 月 — 還剩 6 個月',
                ),
                const SizedBox(height: AppTheme.cardGap),

                // 曼谷旅遊
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
                // MacBook
                const GoalCard(
                  emoji: '\u{1F4BB}',
                  name: 'MacBook Pro',
                  currentAmount: '28,000',
                  targetAmount: '65,000',
                  progress: 0.43,
                ),
                const SizedBox(height: AppTheme.cardGap),

                // 緊急預備金
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
      ),
    );
  }
}
