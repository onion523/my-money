import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:my_money/core/ai_advisor.dart';
import 'package:my_money/core/pattern_analyzer.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/ai_suggestion_card.dart';

/// AI 洞察區塊（用在首頁）
/// 呼叫 PatternAnalyzer 和 AiAdvisor 產生建議，顯示 AI 建議卡片
class AiInsightsSection extends StatelessWidget {
  const AiInsightsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // 使用 mock 資料產生建議
    final suggestions = _generateMockSuggestions();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 標題
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMd,
          ),
          child: Row(
            children: [
              const Text('\u{2728}', style: TextStyle(fontSize: 20)),
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

        // 建議卡片列表
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMd,
          ),
          child: Column(
            children: suggestions.map((suggestion) {
              return Padding(
                padding: const EdgeInsets.only(bottom: AppTheme.cardGap),
                child: AiSuggestionCard(
                  text: suggestion.text,
                  impactAmount: suggestion.impact > Decimal.zero
                      ? '\$${suggestion.impact}'
                      : null,
                  icon: _getIconForCategory(suggestion.category),
                  iconColor: _getColorForPriority(suggestion.priority),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  /// 使用 mock patterns 和 goals 產生建議
  List<Suggestion> _generateMockSuggestions() {
    // Mock 消費模式
    final mockPatterns = [
      ConsumptionPattern(
        type: PatternType.weeklyRecurring,
        description: '每週三咖啡 \$150',
        category: '咖啡',
        averageAmount: Decimal.parse('150'),
        occurrences: 8,
        dayOfWeek: 3,
      ),
      ConsumptionPattern(
        type: PatternType.monthlyRecurring,
        description: '每月 Netflix ~\$390',
        category: '訂閱',
        averageAmount: Decimal.parse('390'),
        occurrences: 3,
      ),
      ConsumptionPattern(
        type: PatternType.categoryConcentration,
        description: '餐飲佔花費 42%',
        category: '餐飲',
        averageAmount: Decimal.parse('7800'),
        occurrences: 28,
        percentage: 42,
      ),
    ];

    // Mock 儲蓄目標差距
    final mockGoals = [
      GoalGap(
        name: '日本旅遊基金',
        targetAmount: Decimal.parse('40000'),
        currentAmount: Decimal.parse('27200'),
        monthlyReserve: Decimal.parse('5000'),
        deadline: DateTime(2026, 9, 30),
      ),
    ];

    // Mock 餘額
    final mockBalance = Decimal.parse('45000');

    // 使用 AiAdvisor 產生建議
    final suggestions = AiAdvisor.generateSuggestions(
      patterns: mockPatterns,
      goals: mockGoals,
      balance: mockBalance,
    );

    // 最多回傳 3 個建議
    if (suggestions.length > 3) {
      return suggestions.sublist(0, 3);
    }
    return suggestions;
  }

  /// 根據分類回傳對應圖示
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

  /// 根據優先級回傳對應顏色
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
