import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/core/cashflow_forecast.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/ai_insights_section.dart';
import 'package:my_money/widgets/balance_card.dart';
import 'package:my_money/widgets/cashflow_row.dart';
import 'package:my_money/widgets/goal_card.dart';
import 'package:my_money/widgets/monthly_report.dart';
import 'package:my_money/navigation/app_navigation.dart';
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

  // ========== 預設值（BLoC 尚未載入時）==========

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
                    unbilled: _formatAmount(state.unbilledTotal),
                  );
                }
                // 初始 / 載入中 / 錯誤時顯示 0
                return const BalanceCard(
                  balance: '0',
                  freeToSpend: '0',
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
              segments: const ['月預算總覽', '現金流預測', '月報表'],
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
                  : _segmentIndex == 1
                      ? _buildCashflowForecastSection(isDark)
                      : const MonthlyReport(),
            ),
          ),

          // AI 智慧建議
          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.sectionGap),
          ),
          const SliverToBoxAdapter(
            child: AiInsightsSection(),
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
                    onPressed: () {
                      context.findAncestorStateOfType<AppNavigationState>()?.switchToTab(2);
                    },
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
                // 無資料時顯示空狀態
                return SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTheme.spacingLg),
                    child: Center(
                      child: Text(
                        '尚未設定儲蓄目標',
                        style: AppTextStyles.caption(),
                      ),
                    ),
                  ),
                );
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
            ? '${goal.deadline!.year} 年 ${goal.deadline!.month} 月'
            : null,
      ));
      if (i < goals.length - 1) {
        children.add(const SizedBox(height: AppTheme.cardGap));
      }
    }
    children.add(const SizedBox(height: AppTheme.spacing2xl));
    return SliverList(delegate: SliverChildListDelegate(children));
  }

  /// 月預算總覽區塊（BLoC 驅動）
  Widget _buildBudgetOverview(bool isDark) {
    return BlocBuilder<ExpensesBloc, ExpensesState>(
      builder: (context, state) {
        final summary = state is ExpensesLoaded ? state.monthlySummary : null;
        final categories = summary?.byCategory.entries.toList() ?? [];

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
              Text('本月花費', style: AppTextStyles.bodyBold()),
              const SizedBox(height: AppTheme.spacingMd),

              if (categories.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTheme.spacingLg),
                    child: Text(
                      '本月尚未記錄花費',
                      style: AppTextStyles.caption(),
                    ),
                  ),
                )
              else ...[
                for (var i = 0; i < categories.length; i++) ...[
                  _buildBudgetItem(
                    categories[i].key,
                    categories[i].value.toInt(),
                    0,
                    isDark,
                  ),
                  if (i < categories.length - 1)
                    const SizedBox(
                        height: AppTheme.spacingSm + AppTheme.spacingXs),
                ],
                const SizedBox(height: AppTheme.spacingMd),
                const Divider(),
                const SizedBox(height: AppTheme.spacingSm),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('本月已花費', style: AppTextStyles.caption()),
                    Text(
                      '\$${summary!.totalSpent.toInt()}',
                      style: AppTextStyles.bodyBold(color: AppColors.accent),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  /// 花費分類項目行
  Widget _buildBudgetItem(
    String category,
    int spent,
    int _,
    bool isDark,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(category, style: AppTextStyles.caption()),
        Text(
          '\$$spent',
          style: AppTextStyles.label(),
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
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingLg),
          child: Text(
            '新增固定支出後將顯示現金流預測',
            style: AppTextStyles.caption(),
          ),
        ),
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
