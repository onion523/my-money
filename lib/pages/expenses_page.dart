import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/transaction_tile.dart';

/// 花費頁面
/// 顯示本月花費摘要、分類標籤和交易清單
class ExpensesPage extends StatefulWidget {
  const ExpensesPage({super.key});

  @override
  State<ExpensesPage> createState() => _ExpensesPageState();
}

class _ExpensesPageState extends State<ExpensesPage> {
  /// 目前選中的分類篩選（null 為全部）
  String? _selectedCategory;

  /// Mock 分類標籤
  static const List<String> _categories = [
    '全部',
    '飲食',
    '交通',
    '娛樂',
    '日用品',
    '訂閱',
  ];

  /// Mock 交易資料（fallback）
  static const List<_MockTransaction> _mockTransactions = [
    _MockTransaction(
      name: '全聯福利中心',
      icon: Icons.shopping_cart_outlined,
      category: '日用品',
      date: '3/28',
      amount: '856',
    ),
    _MockTransaction(
      name: '路易莎咖啡',
      icon: Icons.local_cafe_outlined,
      category: '飲食',
      date: '3/27',
      amount: '145',
    ),
    _MockTransaction(
      name: 'Uber',
      icon: Icons.directions_car_outlined,
      category: '交通',
      date: '3/27',
      amount: '235',
    ),
    _MockTransaction(
      name: '麥當勞',
      icon: Icons.fastfood_outlined,
      category: '飲食',
      date: '3/26',
      amount: '189',
    ),
    _MockTransaction(
      name: 'Netflix',
      icon: Icons.movie_outlined,
      category: '訂閱',
      date: '3/25',
      amount: '390',
    ),
    _MockTransaction(
      name: '台北捷運',
      icon: Icons.train_outlined,
      category: '交通',
      date: '3/25',
      amount: '50',
    ),
    _MockTransaction(
      name: '鼎泰豐',
      icon: Icons.restaurant_outlined,
      category: '飲食',
      date: '3/24',
      amount: '680',
    ),
    _MockTransaction(
      name: 'Spotify',
      icon: Icons.music_note_outlined,
      category: '訂閱',
      date: '3/24',
      amount: '149',
    ),
    _MockTransaction(
      name: '誠品書店',
      icon: Icons.menu_book_outlined,
      category: '娛樂',
      date: '3/23',
      amount: '420',
    ),
    _MockTransaction(
      name: '全家便利商店',
      icon: Icons.local_convenience_store_outlined,
      category: '飲食',
      date: '3/22',
      amount: '78',
    ),
  ];

  /// 分類對應的圖示
  static const Map<String, IconData> _categoryIcons = {
    '飲食': Icons.restaurant_outlined,
    '交通': Icons.directions_car_outlined,
    '娛樂': Icons.movie_outlined,
    '日用品': Icons.shopping_cart_outlined,
    '訂閱': Icons.subscriptions_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      child: BlocBuilder<ExpensesBloc, ExpensesState>(
        builder: (context, state) {
          if (state is ExpensesLoaded) {
            return _buildFromBloc(isDark, state);
          }
          // 初始 / 載入中 / 錯誤時顯示 mock 資料
          return _buildMockContent(isDark);
        },
      ),
    );
  }

  /// 從 BLoC 資料建立頁面
  Widget _buildFromBloc(bool isDark, ExpensesLoaded state) {
    final transactions = state.transactions;
    final summary = state.monthlySummary;

    // 篩選交易
    final filtered = _selectedCategory == null
        ? transactions
        : transactions
              .where((t) => t.category == _selectedCategory)
              .toList();

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
            child: Text('花費', style: AppTextStyles.pageTitle()),
          ),
        ),

        // 本月花費摘要（BLoC 資料）
        SliverToBoxAdapter(
          child: _buildMonthlySummaryFromBloc(isDark, summary),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacingMd),
        ),

        // 分類標籤
        SliverToBoxAdapter(
          child: SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              itemCount: _categories.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(width: AppTheme.spacingSm),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = (_selectedCategory == null && cat == '全部')
                    || _selectedCategory == cat;
                return _buildCategoryChip(cat, isSelected, isDark);
              },
            ),
          ),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacingMd),
        ),

        // 交易清單（BLoC 資料）
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final tx = filtered[index];
                final icon = _categoryIcons[tx.category] ??
                    Icons.receipt_outlined;
                return TransactionTile(
                  name: tx.note,
                  icon: icon,
                  category: tx.category,
                  date: '${tx.date.month}/${tx.date.day}',
                  amount: _formatAmount(Decimal.parse(tx.amount)),
                  isExpense: tx.type == 'expense',
                );
              },
              childCount: filtered.length,
            ),
          ),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacing2xl),
        ),
      ],
    );
  }

  /// Mock 內容（fallback）
  Widget _buildMockContent(bool isDark) {
    // 篩選交易
    final filtered = _selectedCategory == null || _selectedCategory == '全部'
        ? _mockTransactions
        : _mockTransactions
              .where((t) => t.category == _selectedCategory)
              .toList();

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
            child: Text('花費', style: AppTextStyles.pageTitle()),
          ),
        ),

        // 本月花費摘要
        SliverToBoxAdapter(
          child: _buildMonthlySummary(isDark),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacingMd),
        ),

        // 分類標籤
        SliverToBoxAdapter(
          child: SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              itemCount: _categories.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(width: AppTheme.spacingSm),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = (_selectedCategory == null && cat == '全部')
                    || _selectedCategory == cat;
                return _buildCategoryChip(cat, isSelected, isDark);
              },
            ),
          ),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacingMd),
        ),

        // 交易清單
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final tx = filtered[index];
                return TransactionTile(
                  name: tx.name,
                  icon: tx.icon,
                  category: tx.category,
                  date: tx.date,
                  amount: tx.amount,
                  isExpense: true,
                );
              },
              childCount: filtered.length,
            ),
          ),
        ),

        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacing2xl),
        ),
      ],
    );
  }

  /// 從 BLoC 月度摘要建立卡片
  Widget _buildMonthlySummaryFromBloc(bool isDark, MonthlySummary summary) {
    final totalSpent = summary.totalSpent;
    final byCategory = summary.byCategory;
    final totalForBar = totalSpent > 0 ? totalSpent : 1.0;

    // 分類顏色配對
    const categoryColors = {
      '飲食': AppColors.accent,
      '交通': AppColors.accentCool,
      '娛樂': AppColors.accentWarm,
      '日用品': AppColors.success,
      '訂閱': AppColors.info,
    };

    return Container(
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
          Text(
            '${DateTime.now().month} 月花費',
            style: AppTextStyles.caption(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: AppTheme.spacingXs),
          Text(
            '\$${_formatAmountDouble(totalSpent)}',
            style: AppTextStyles.amountLarge(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),
          const SizedBox(height: AppTheme.spacingMd),

          // 分類比例條
          if (byCategory.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Row(
                children: byCategory.entries.map((entry) {
                  final color =
                      categoryColors[entry.key] ?? AppColors.secondaryText;
                  final ratio = entry.value / totalForBar;
                  return _buildCategoryBar(color, ratio);
                }).toList(),
              ),
            ),

          const SizedBox(height: AppTheme.spacingSm),

          // 分類圖例
          Wrap(
            spacing: AppTheme.spacingMd,
            runSpacing: AppTheme.spacingXs,
            children: byCategory.entries.map((entry) {
              final color =
                  categoryColors[entry.key] ?? AppColors.secondaryText;
              return _buildLegend(entry.key, color);
            }).toList(),
          ),
        ],
      ),
    );
  }

  /// 本月花費摘要卡片
  Widget _buildMonthlySummary(bool isDark) {
    return Container(
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
          Text(
            '3 月花費',
            style: AppTextStyles.caption(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: AppTheme.spacingXs),
          Text(
            '\$16,000',
            style: AppTextStyles.amountLarge(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),
          const SizedBox(height: AppTheme.spacingSm),

          // 與上月比較
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingSm,
              vertical: AppTheme.spacingXs,
            ),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
            ),
            child: Text(
              '\u{2193} 比上月少 \$2,400（-13%）',
              style: AppTextStyles.label(color: AppColors.success),
            ),
          ),

          const SizedBox(height: AppTheme.spacingMd),

          // 分類比例條
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Row(
              children: [
                _buildCategoryBar(AppColors.accent, 0.35),       // 飲食
                _buildCategoryBar(AppColors.accentCool, 0.18),   // 交通
                _buildCategoryBar(AppColors.accentWarm, 0.22),   // 娛樂
                _buildCategoryBar(AppColors.success, 0.15),      // 日用品
                _buildCategoryBar(AppColors.info, 0.10),         // 訂閱
              ],
            ),
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // 分類圖例
          Wrap(
            spacing: AppTheme.spacingMd,
            runSpacing: AppTheme.spacingXs,
            children: [
              _buildLegend('飲食', AppColors.accent),
              _buildLegend('交通', AppColors.accentCool),
              _buildLegend('娛樂', AppColors.accentWarm),
              _buildLegend('日用品', AppColors.success),
              _buildLegend('訂閱', AppColors.info),
            ],
          ),
        ],
      ),
    );
  }

  /// 分類比例條片段
  Widget _buildCategoryBar(Color color, double ratio) {
    return Expanded(
      flex: (ratio * 100).toInt(),
      child: Container(height: 6, color: color),
    );
  }

  /// 分類圖例
  Widget _buildLegend(String name, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(name, style: AppTextStyles.label()),
      ],
    );
  }

  /// 分類標籤
  Widget _buildCategoryChip(String name, bool isSelected, bool isDark) {
    return GestureDetector(
      onTap: () {
        final newCategory = name == '全部' ? null : name;
        setState(() {
          _selectedCategory = newCategory;
        });
        // 通知 BLoC 篩選
        context.read<ExpensesBloc>().add(FilterByCategory(newCategory));
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingSm + AppTheme.spacingXs,
          vertical: AppTheme.spacingXs + 2,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? AppColors.darkAccent : AppColors.accent)
              : (isDark ? AppColors.darkSurface : AppColors.surface),
          borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
          border: Border.all(
            color: isSelected
                ? Colors.transparent
                : (isDark
                    ? AppColors.darkSecondaryText.withValues(alpha: 0.2)
                    : AppColors.secondaryText.withValues(alpha: 0.2)),
          ),
        ),
        child: Text(
          name,
          style: AppTextStyles.label(
            color: isSelected
                ? Colors.white
                : (isDark
                    ? AppColors.darkSecondaryText
                    : AppColors.secondaryText),
          ),
        ),
      ),
    );
  }

  /// 格式化 Decimal 金額為千分位字串
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

  /// 格式化 double 金額為千分位字串
  static String _formatAmountDouble(double amount) {
    final intPart = amount.truncate().abs().toString();
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

/// Mock 交易資料結構
class _MockTransaction {
  final String name;
  final IconData icon;
  final String category;
  final String date;
  final String amount;

  const _MockTransaction({
    required this.name,
    required this.icon,
    required this.category,
    required this.date,
    required this.amount,
  });
}
