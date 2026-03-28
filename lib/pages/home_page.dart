import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/balance_card.dart';
import 'package:my_money/widgets/cashflow_row.dart';
import 'package:my_money/widgets/goal_card.dart';
import 'package:my_money/widgets/segmented_control.dart';

/// 首頁
/// 顯示即時可用餘額、攤提後可自由花用金額、
/// 分段控制器（月預算/現金流）、儲蓄目標摘要
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  /// 分段控制器目前選中的索引
  int _segmentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
              child: Text('我的錢錢', style: AppTextStyles.pageTitle()),
            ),
          ),

          // 餘額卡片
          const SliverToBoxAdapter(
            child: BalanceCard(
              balance: '89,700',
              freeToSpend: '62,350',
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),

          // 分段控制器
          SliverToBoxAdapter(
            child: SegmentedControl(
              segments: const ['月預算總覽', '現金流預測'],
              selectedIndex: _segmentIndex,
              onChanged: (index) {
                setState(() => _segmentIndex = index);
              },
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.spacingMd),
          ),

          // 分段內容
          SliverToBoxAdapter(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _segmentIndex == 0
                  ? _buildBudgetOverview(isDark)
                  : _buildCashflowForecast(isDark),
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),

          // 儲蓄目標摘要
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('儲蓄目標', style: AppTextStyles.cardTitle()),
                  TextButton(
                    onPressed: () {},
                    child: const Text('查看全部'),
                  ),
                ],
              ),
            ),
          ),

          // 目標卡片列表
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
                  deadline: '2026 年 10 月',
                ),
                const SizedBox(height: AppTheme.cardGap),
                // 曼谷旅遊
                const GoalCard(
                  emoji: '\u{1F334}',
                  name: '曼谷自由行',
                  currentAmount: '10,500',
                  targetAmount: '30,000',
                  progress: 0.35,
                  deadline: '2026 年 12 月',
                ),
                const SizedBox(height: AppTheme.spacing2xl),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  /// 月預算總覽區塊
  Widget _buildBudgetOverview(bool isDark) {
    return Container(
      key: const ValueKey('budget'),
      margin: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('本月預算', style: AppTextStyles.bodyBold()),
          const SizedBox(height: AppTheme.spacingMd),

          // 預算進度
          _buildBudgetItem('飲食', 8500, 12000, isDark),
          const SizedBox(height: AppTheme.spacingSm + AppTheme.spacingXs),
          _buildBudgetItem('交通', 2800, 4000, isDark),
          const SizedBox(height: AppTheme.spacingSm + AppTheme.spacingXs),
          _buildBudgetItem('娛樂', 3200, 5000, isDark),
          const SizedBox(height: AppTheme.spacingSm + AppTheme.spacingXs),
          _buildBudgetItem('日用品', 1500, 3000, isDark),

          const SizedBox(height: AppTheme.spacingMd),
          const Divider(),
          const SizedBox(height: AppTheme.spacingSm),

          // 總計
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('已花費', style: AppTextStyles.caption()),
              Text(
                '\$16,000 / \$24,000',
                style: AppTextStyles.bodyBold(color: AppColors.accent),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 預算項目行
  Widget _buildBudgetItem(
    String category,
    int spent,
    int budget,
    bool isDark,
  ) {
    final progress = spent / budget;
    final progressColor = progress > 0.8
        ? AppColors.error
        : progress > 0.6
            ? AppColors.warning
            : AppColors.success;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(category, style: AppTextStyles.caption()),
            Text(
              '\$$spent / \$$budget',
              style: AppTextStyles.label(),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: progress.clamp(0.0, 1.0),
            backgroundColor: progressColor.withValues(alpha: 0.12),
            valueColor: AlwaysStoppedAnimation<Color>(progressColor),
            minHeight: 5,
          ),
        ),
      ],
    );
  }

  /// 現金流預測區塊
  Widget _buildCashflowForecast(bool isDark) {
    return Container(
      key: const ValueKey('cashflow'),
      margin: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 未來現金流時間軸
          CashflowRow(
            date: '4/1',
            name: '薪資入帳',
            amount: '52,000',
            isIncome: true,
            isFirst: true,
          ),
          CashflowRow(
            date: '4/5',
            name: '房租',
            amount: '12,000',
          ),
          CashflowRow(
            date: '4/10',
            name: '中信卡帳單',
            amount: '8,500',
          ),
          CashflowRow(
            date: '4/15',
            name: '國泰卡帳單',
            amount: '5,200',
          ),
          CashflowRow(
            date: '4/20',
            name: 'Netflix + Spotify',
            amount: '480',
          ),
          CashflowRow(
            date: '4/25',
            name: '電話費',
            amount: '699',
            isLast: true,
          ),
        ],
      ),
    );
  }
}
