import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/core/cashflow_forecast.dart';
import 'package:my_money/data/database.dart';
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

  // ========== Mock 資料（BLoC 錯誤時的 fallback）==========

  /// Mock 餘額
  static const _mockBalance = '89,700';
  static const _mockFreeToSpend = '62,350';

  /// Mock 儲蓄目標
  static const _mockGoals = [
    _MockGoal(
      emoji: '\u{1F3EF}',
      name: '京都旅遊',
      currentAmount: '34,000',
      targetAmount: '50,000',
      progress: 0.68,
      deadline: '2026 年 10 月',
    ),
    _MockGoal(
      emoji: '\u{1F334}',
      name: '曼谷自由行',
      currentAmount: '10,500',
      targetAmount: '30,000',
      progress: 0.35,
      deadline: '2026 年 12 月',
    ),
  ];

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

          // 餘額卡片（BLoC 驅動）
          SliverToBoxAdapter(
            child: BlocBuilder<BalanceBloc, BalanceState>(
              builder: (context, state) {
                if (state is BalanceLoaded) {
                  return BalanceCard(
                    balance: _formatAmount(state.available),
                    freeToSpend: _formatAmount(state.afterAllocation),
                  );
                }
                // 初始 / 載入中 / 錯誤時顯示 mock 資料
                return const BalanceCard(
                  balance: _mockBalance,
                  freeToSpend: _mockFreeToSpend,
                );
              },
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),

          // 分段控制器
          SliverToBoxAdapter(
            child: SegmentedControl(
              segments: const ['月預算總覽', '現金流���測'],
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
                  : _buildCashflowForecastSection(isDark),
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),

          // 儲蓄目標摘���
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

          // 目標卡片列表（BLoC 驅動）
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
            ),
            sliver: BlocBuilder<GoalsBloc, GoalsState>(
              builder: (context, state) {
                if (state is GoalsLoaded && state.goals.isNotEmpty) {
                  return _buildGoalsList(state.goals);
                }
                // 初始 / 載入中 / 錯誤時顯示 mock 資料
                return _buildMockGoalsList();
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 從 BLoC 資料建立儲蓄目標列表
  Widget _buildGoalsList(List<SavingsGoal> goals) {
    final children = <Widget>[];
    for (var i = 0; i < goals.length; i++) {
      final goal = goals[i];
      final target = Decimal.parse(goal.targetAmount);
      final current = Decimal.parse(goal.currentAmount);
      final progress =
          target > Decimal.zero ? (current / target).toDouble() : 0.0;

      children.add(GoalCard(
        emoji: goal.emoji,
        name: goal.name,
        currentAmount: _formatAmount(current),
        targetAmount: _formatAmount(target),
        progress: progress,
        deadline: goal.deadline != null
            ? '${goal.deadline!.year} 年 ${goal.deadline!.month} ���'
            : null,
      ));
      if (i < goals.length - 1) {
        children.add(const SizedBox(height: AppTheme.cardGap));
      }
    }
    children.add(const SizedBox(height: AppTheme.spacing2xl));
    return SliverList(delegate: SliverChildListDelegate(children));
  }

  /// Mock 儲蓄目標列表（fallback）
  Widget _buildMockGoalsList() {
    return SliverList(
      delegate: SliverChildListDelegate([
        for (var i = 0; i < _mockGoals.length; i++) ...[
          GoalCard(
            emoji: _mockGoals[i].emoji,
            name: _mockGoals[i].name,
            currentAmount: _mockGoals[i].currentAmount,
            targetAmount: _mockGoals[i].targetAmount,
            progress: _mockGoals[i].progress,
            deadline: _mockGoals[i].deadline,
          ),
          if (i < _mockGoals.length - 1)
            const SizedBox(height: AppTheme.cardGap),
        ],
        const SizedBox(height: AppTheme.spacing2xl),
      ]),
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

  /// 現金流預測區塊（BLoC 驅動，含 fallback）
  Widget _buildCashflowForecastSection(bool isDark) {
    return BlocBuilder<CashflowBloc, CashflowState>(
      builder: (context, state) {
        if (state is CashflowLoaded && state.forecast.isNotEmpty) {
          return _buildCashflowFromData(isDark, state.forecast);
        }
        // 初始 / 載入中 / 錯誤時顯示 mock 資料
        return _buildMockCashflowForecast(isDark);
      },
    );
  }

  /// 從 BLoC 資料建立現��流預測
  Widget _buildCashflowFromData(bool isDark, List<CashflowPoint> forecast) {
    // 過濾出有實際變動的事件（排除「無變動」）
    final events =
        forecast.where((p) => p.description != '無變動').toList();

    // 最多顯示 6 筆
    final displayEvents = events.length > 6 ? events.sublist(0, 6) : events;

    if (displayEvents.isEmpty) {
      return _buildMockCashflowForecast(isDark);
    }

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < displayEvents.length; i++)
            CashflowRow(
              date:
                  '${displayEvents[i].date.month}/${displayEvents[i].date.day}',
              name: displayEvents[i].description,
              amount: _formatAmount(displayEvents[i].delta.abs()),
              isIncome: displayEvents[i].delta > Decimal.zero,
              isFirst: i == 0,
              isLast: i == displayEvents.length - 1,
            ),
        ],
      ),
    );
  }

  /// Mock 現金流預測（fallback）
  Widget _buildMockCashflowForecast(bool isDark) {
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
          CashflowRow(
            date: '4/1',
            name: '薪資入帳',
            amount: '52,000',
            isIncome: true,
            isFirst: true,
          ),
          CashflowRow(
            date: '4/5',
            name: '房��',
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

/// Mock 儲蓄目標資料結構
class _MockGoal {
  final String emoji;
  final String name;
  final String currentAmount;
  final String targetAmount;
  final double progress;
  final String? deadline;

  const _MockGoal({
    required this.emoji,
    required this.name,
    required this.currentAmount,
    required this.targetAmount,
    required this.progress,
    this.deadline,
  });
}
