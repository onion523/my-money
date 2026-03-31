import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/core/ai_advisor.dart';
import 'package:my_money/core/pattern_analyzer.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/ai_suggestion_card.dart';

/// AI 洞察區塊（用在首頁）
/// 從真實交易資料分析消費模式，結合儲蓄目標產生建議
class AiInsightsSection extends StatelessWidget {
  const AiInsightsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocBuilder<ExpensesBloc, ExpensesState>(
      builder: (context, expensesState) {
        return BlocBuilder<GoalsBloc, GoalsState>(
          builder: (context, goalsState) {
            return BlocBuilder<BalanceBloc, BalanceState>(
              builder: (context, balanceState) {
                final suggestions = _generateSuggestions(
                  expensesState,
                  goalsState,
                  balanceState,
                );

                if (suggestions.isEmpty) return const SizedBox.shrink();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppTheme.spacingMd,
                      ),
                      child: Row(
                        children: [
                          const Text('\u{2728}',
                              style: TextStyle(fontSize: 20)),
                          const SizedBox(width: AppTheme.spacingSm),
                          Text(
                            '智慧建議',
                            style: AppTextStyles.cardTitle(
                              color: isDark
                                  ? AppColors.darkPrimaryText
                                  : AppColors.primaryText,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppTheme.spacingMd,
                      ),
                      child: Column(
                        children: suggestions.map((suggestion) {
                          return Padding(
                            padding:
                                const EdgeInsets.only(bottom: AppTheme.cardGap),
                            child: AiSuggestionCard(
                              text: suggestion.text,
                              impactAmount: suggestion.impact > Decimal.zero
                                  ? '\$${suggestion.impact}'
                                  : null,
                              icon:
                                  _getIconForCategory(suggestion.category),
                              iconColor:
                                  _getColorForPriority(suggestion.priority),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  /// 從真實 BLoC 資料產生建議
  List<Suggestion> _generateSuggestions(
    ExpensesState expensesState,
    GoalsState goalsState,
    BalanceState balanceState,
  ) {
    // 取得交易資料
    final transactions = expensesState is ExpensesLoaded
        ? expensesState.transactions
        : [];

    if (transactions.isEmpty) return [];

    // 轉換為 PatternAnalyzer 需要的格式
    final txData = transactions.map((tx) => TransactionData(
          amount: Decimal.parse(tx.amount),
          date: tx.date,
          category: tx.category,
          note: tx.note,
          type: tx.type,
        )).toList();

    // 分析消費模式（降低門檻到 5 筆，讓少量資料也能分析）
    final patterns = PatternAnalyzer.detectPatterns(txData, minCount: 5);

    // 取得儲蓄目標差距
    final goals = goalsState is GoalsLoaded
        ? goalsState.goals
            .where((g) =>
                Decimal.parse(g.targetAmount) > Decimal.parse(g.currentAmount))
            .map((g) => GoalGap(
                  name: g.name,
                  targetAmount: Decimal.parse(g.targetAmount),
                  currentAmount: Decimal.parse(g.currentAmount),
                  monthlyReserve: Decimal.parse(g.monthlyReserve),
                  deadline: g.deadline,
                ))
            .toList()
        : <GoalGap>[];

    // 取得餘額
    final balance = balanceState is BalanceLoaded
        ? balanceState.available
        : Decimal.zero;

    // 產生建議
    final suggestions = AiAdvisor.generateSuggestions(
      patterns: patterns,
      goals: goals,
      balance: balance,
    );

    // 最多回傳 3 個建議
    return suggestions.length > 3 ? suggestions.sublist(0, 3) : suggestions;
  }

  IconData _getIconForCategory(String category) {
    switch (category) {
      case '咖啡':
        return Icons.coffee_outlined;
      case '訂閱':
        return Icons.subscriptions_outlined;
      case '餐飲':
        return Icons.restaurant_outlined;
      case '儲蓄目標':
        return Icons.timeline;
      default:
        return Icons.lightbulb_outline;
    }
  }

  Color _getColorForPriority(SuggestionPriority priority) {
    switch (priority) {
      case SuggestionPriority.high:
        return AppColors.warning;
      case SuggestionPriority.medium:
        return AppColors.accentCool;
      case SuggestionPriority.low:
        return AppColors.success;
    }
  }
}
