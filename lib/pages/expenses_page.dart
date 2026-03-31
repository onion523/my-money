import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/fixed_expenses/fixed_expenses_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/dialogs/add_fixed_expense_dialog.dart';
import 'package:my_money/widgets/dialogs/add_transaction_dialog.dart';
import 'package:my_money/widgets/dialogs/edit_fixed_expense_dialog.dart';
import 'package:my_money/widgets/dialogs/edit_transaction_dialog.dart';
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

  /// 分類標籤（與 add_transaction_dialog 的分類一致）
  static const List<String> _categories = [
    '全部',
    '餐飲',
    '交通',
    '娛樂',
    '購物',
    '生活',
    '醫療',
    '教育',
    '其他',
  ];

  /// 分類對應的圖示
  static const Map<String, IconData> _categoryIcons = {
    '餐飲': Icons.restaurant_outlined,
    '交通': Icons.directions_car_outlined,
    '娛樂': Icons.movie_outlined,
    '購物': Icons.shopping_cart_outlined,
    '生活': Icons.home_outlined,
    '醫療': Icons.local_hospital_outlined,
    '教育': Icons.school_outlined,
    '其他': Icons.receipt_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      child: BlocBuilder<ExpensesBloc, ExpensesState>(
        builder: (context, state) {
          if (state is ExpensesLoaded && state.transactions.isNotEmpty) {
            return _buildFromBloc(isDark, state);
          }
          if (state is ExpensesLoaded && state.transactions.isEmpty) {
            return _buildEmptyState(isDark);
          }
          return _buildEmptyState(isDark);
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
                return Dismissible(
                  key: Key(tx.id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    color: AppColors.error,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    child: const Icon(Icons.delete, color: Colors.white),
                  ),
                  confirmDismiss: (_) async {
                    return await showDialog<bool>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('確認刪除'),
                        content: Text('確定要刪除「${tx.note}」嗎？'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
                          TextButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: Text('刪除', style: TextStyle(color: AppColors.error)),
                          ),
                        ],
                      ),
                    ) ?? false;
                  },
                  onDismissed: (_) {
                    context.read<ExpensesBloc>().add(DeleteExpense(tx.id));
                  },
                  child: TransactionTile(
                    name: tx.note,
                    icon: icon,
                    category: tx.category,
                    date: '${tx.date.month}/${tx.date.day}',
                    amount: _formatAmount(Decimal.parse(tx.amount)),
                    isExpense: tx.type == 'expense',
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (_) => EditTransactionDialog(transaction: tx),
                      );
                    },
                  ),
                );
              },
              childCount: filtered.length,
            ),
          ),
        ),

        // 固定收支區塊
        SliverToBoxAdapter(
          child: _buildFixedExpensesSection(isDark),
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
            runSpacing: 8,
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

  /// 固定收支區塊（BLoC 驅動）
  Widget _buildFixedExpensesSection(bool isDark) {
    return BlocBuilder<FixedExpensesBloc, FixedExpensesState>(
      builder: (context, state) {
        if (state is! FixedExpensesLoaded) {
          return const SizedBox.shrink();
        }
        final expenses = state.expenses;
        final incomes = state.incomes;
        // 月繳 vs 非月繳（預留基金）
        final monthlyExpenses =
            expenses.where((e) => e.cycle == 'monthly').toList();
        final reserveExpenses =
            expenses.where((e) => e.cycle != 'monthly').toList();

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 標題列
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('固定收支', style: AppTextStyles.cardTitle()),
                  IconButton(
                    onPressed: () => showDialog(
                      context: context,
                      builder: (_) => const AddFixedExpenseDialog(),
                    ),
                    icon: const Icon(Icons.add_circle_outline),
                    color: AppColors.accent,
                    tooltip: '新增固定收支',
                    iconSize: 28,
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacingSm),

              // 固定收入
              if (incomes.isNotEmpty) ...[
                _buildFixedCard(
                  isDark: isDark,
                  title:
                      '固定收入 \$${_formatAmountDouble(incomes.fold(0.0, (s, e) => s + (double.tryParse(e.amount) ?? 0)))}',
                  items: incomes,
                  isIncome: true,
                ),
                const SizedBox(height: AppTheme.cardGap),
              ],

              // 月繳固定支出
              if (monthlyExpenses.isNotEmpty) ...[
                _buildFixedCard(
                  isDark: isDark,
                  title:
                      '月繳固定支出 \$${_formatAmountDouble(monthlyExpenses.fold(0.0, (s, e) => s + (double.tryParse(e.amount) ?? 0)))}',
                  items: monthlyExpenses,
                  isIncome: false,
                ),
                const SizedBox(height: AppTheme.cardGap),
              ],

              // 繳費預留基金
              if (reserveExpenses.isNotEmpty) ...[
                _buildReserveFundCard(isDark, reserveExpenses),
                const SizedBox(height: AppTheme.cardGap),
              ],

              // 每月攤提總計
              if (expenses.isNotEmpty) ...[
                _buildMonthlyAllocationSummary(isDark, expenses, incomes),
                const SizedBox(height: AppTheme.cardGap),
              ],

              // 沒有任何固定收支
              if (expenses.isEmpty && incomes.isEmpty)
                Container(
                  padding: const EdgeInsets.all(AppTheme.cardPadding),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurface : AppColors.surface,
                    borderRadius:
                        BorderRadius.circular(AppTheme.cardRadius),
                  ),
                  child: Center(
                    child: Text(
                      '尚未設定固定收支',
                      style: AppTextStyles.caption(),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  /// 固定收支卡片（月繳固定支出/固定收入）
  Widget _buildFixedCard({
    required bool isDark,
    required String title,
    required List<FixedExpense> items,
    required bool isIncome,
  }) {
    return Container(
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
          Text(title, style: AppTextStyles.bodyBold()),
          const SizedBox(height: AppTheme.spacingSm),
          for (var i = 0; i < items.length; i++) ...[
            _buildFixedItem(items[i], isDark, isIncome),
            if (i < items.length - 1)
              Divider(
                height: 1,
                color: isDark
                    ? AppColors.darkSecondaryText.withValues(alpha: 0.15)
                    : AppColors.secondaryText.withValues(alpha: 0.15),
              ),
          ],
        ],
      ),
    );
  }

  /// 單筆固定收支項目
  Widget _buildFixedItem(FixedExpense item, bool isDark, bool isIncome) {
    final cycleName = _cycleName(item.cycle);
    final detail =
        '每月 ${item.dueDate.day} 號${item.paymentMethod.isNotEmpty ? ' ・${item.paymentMethod}' : ''}';

    return GestureDetector(
      onTap: () => showDialog(
        context: context,
        builder: (_) => EditFixedExpenseDialog(item: item),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(item.name, style: AppTextStyles.bodyBold()),
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    cycleName,
                    style: AppTextStyles.label(
                      color: AppColors.accent,
                    ).copyWith(fontSize: 11),
                  ),
                ),
                const Spacer(),
                Text(
                  '${isIncome ? '+' : '-'}\$${_formatAmountDouble(double.tryParse(item.amount) ?? 0)}',
                  style: AppTextStyles.bodyBold(
                    color: isIncome ? AppColors.success : AppColors.error,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              detail,
              style: AppTextStyles.label(
                color: isDark
                    ? AppColors.darkSecondaryText
                    : AppColors.secondaryText,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 繳費預留基金卡片
  Widget _buildReserveFundCard(bool isDark, List<FixedExpense> items) {
    final totalReserved = items.fold(
        0.0, (s, e) => s + (double.tryParse(e.reservedAmount) ?? 0));
    final monthlyAllocation = items.fold(0.0, (s, e) {
      final months = _cycleToMonths(e.cycle);
      final amount = double.tryParse(e.amount) ?? 0;
      return s + (months > 0 ? amount / months : 0);
    });

    return Container(
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
          Text('繳費預留基金', style: AppTextStyles.bodyBold()),
          const SizedBox(height: 8),
          // 摘要
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.accentCool.withValues(alpha: 0.15),
                  AppColors.accent.withValues(alpha: 0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '已累積預留金',
                      style: AppTextStyles.label(
                        color: isDark
                            ? AppColors.darkSecondaryText
                            : AppColors.secondaryText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '\$${_formatAmountDouble(totalReserved)}',
                      style: AppTextStyles.amountMedium(),
                    ),
                  ],
                ),
                Text(
                  '每月攤提 \$${_formatAmountDouble(monthlyAllocation)}',
                  style: AppTextStyles.label(
                    color: isDark
                        ? AppColors.darkSecondaryText
                        : AppColors.secondaryText,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingSm),

          // 各項目
          for (var i = 0; i < items.length; i++) ...[
            _buildReserveItem(items[i], isDark),
            if (i < items.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  /// 預留基金單項（含進度條）
  Widget _buildReserveItem(FixedExpense item, bool isDark) {
    final amount = double.tryParse(item.amount) ?? 0;
    final reserved = double.tryParse(item.reservedAmount) ?? 0;
    final progress = amount > 0 ? (reserved / amount).clamp(0.0, 1.0) : 0.0;
    final months = _cycleToMonths(item.cycle);
    final monthlyAlloc = months > 0 ? amount / months : 0.0;
    final cycleName = _cycleName(item.cycle);
    final remaining = (amount - reserved).clamp(0.0, double.infinity);

    return GestureDetector(
      onTap: () => showDialog(
        context: context,
        builder: (_) => EditFixedExpenseDialog(item: item),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(item.name, style: AppTextStyles.bodyBold()),
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  cycleName,
                  style: AppTextStyles.label(
                    color: AppColors.accent,
                  ).copyWith(fontSize: 11),
                ),
              ),
              const Spacer(),
              Text(
                '\$${_formatAmountDouble(amount)}',
                style: AppTextStyles.bodyBold(),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '到期 ${item.dueDate.year}/${item.dueDate.month}/${item.dueDate.day} ・每月預留 \$${_formatAmountDouble(monthlyAlloc)}',
            style: AppTextStyles.label(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: 6),
          // 進度條
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: isDark
                  ? AppColors.darkSecondaryText.withValues(alpha: 0.15)
                  : AppColors.secondaryText.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation(
                progress >= 1.0 ? AppColors.success : AppColors.accent,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '已存 \$${_formatAmountDouble(reserved)}',
                style: AppTextStyles.label(
                  color: isDark
                      ? AppColors.darkSecondaryText
                      : AppColors.secondaryText,
                ),
              ),
              Text(
                progress >= 1.0
                    ? '到期時足夠'
                    : '還差 \$${_formatAmountDouble(remaining)}',
                style: AppTextStyles.label(
                  color: progress >= 1.0
                      ? AppColors.success
                      : (isDark
                          ? AppColors.darkSecondaryText
                          : AppColors.secondaryText),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 每月攤提總計摘要卡片
  Widget _buildMonthlyAllocationSummary(
      bool isDark, List<FixedExpense> expenses, List<FixedExpense> incomes) {
    // 計算每筆固定支出的每月攤提
    final items = <_AllocationItem>[];
    var totalAllocation = 0.0;

    for (final e in expenses) {
      final amount = double.tryParse(e.amount) ?? 0;
      final months = _cycleToMonths(e.cycle);
      final monthly = months > 0 ? amount / months : 0.0;
      totalAllocation += monthly;
      items.add(_AllocationItem(
        name: e.name,
        cycle: e.cycle,
        totalAmount: amount,
        monthlyAmount: monthly,
      ));
    }

    // 固定收入的每月攤提
    var totalIncomeAllocation = 0.0;
    for (final e in incomes) {
      final amount = double.tryParse(e.amount) ?? 0;
      final months = _cycleToMonths(e.cycle);
      final monthly = months > 0 ? amount / months : 0.0;
      totalIncomeAllocation += monthly;
    }

    final netMonthly = totalIncomeAllocation - totalAllocation;

    return Container(
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
          Text('每月攤提明細', style: AppTextStyles.bodyBold()),
          const SizedBox(height: AppTheme.spacingSm),
          // 各項目攤提
          for (final item in items) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      item.name,
                      style: AppTextStyles.body(
                        color: isDark
                            ? AppColors.darkPrimaryText
                            : AppColors.primaryText,
                      ),
                    ),
                  ),
                  Text(
                    item.cycle == 'monthly'
                        ? ''
                        : '${_cycleName(item.cycle)} \$${_formatAmountDouble(item.totalAmount)} → ',
                    style: AppTextStyles.label(
                      color: isDark
                          ? AppColors.darkSecondaryText
                          : AppColors.secondaryText,
                    ),
                  ),
                  Text(
                    '\$${_formatAmountDouble(item.monthlyAmount)}/月',
                    style: AppTextStyles.bodyBold(color: AppColors.error),
                  ),
                ],
              ),
            ),
          ],
          const Divider(),
          // 總計
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('固定支出攤提合計', style: AppTextStyles.bodyBold()),
              Text(
                '\$${_formatAmountDouble(totalAllocation)}/月',
                style: AppTextStyles.bodyBold(color: AppColors.error),
              ),
            ],
          ),
          if (totalIncomeAllocation > 0) ...[
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('固定收入合計', style: AppTextStyles.body()),
                Text(
                  '+\$${_formatAmountDouble(totalIncomeAllocation)}/月',
                  style: AppTextStyles.bodyBold(color: AppColors.success),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('固定收支淨額', style: AppTextStyles.bodyBold()),
                Text(
                  '${netMonthly >= 0 ? '+' : ''}\$${_formatAmountDouble(netMonthly)}/月',
                  style: AppTextStyles.bodyBold(
                    color: netMonthly >= 0 ? AppColors.success : AppColors.error,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// 週期代碼轉顯示名稱
  static String _cycleName(String cycle) {
    switch (cycle) {
      case 'monthly':
        return '月繳';
      case 'bimonthly':
        return '雙月繳';
      case 'quarterly':
        return '季繳';
      case 'semi_annual':
        return '半年繳';
      case 'annual':
        return '年繳';
      default:
        return cycle;
    }
  }

  /// 週期代碼轉月數
  static int _cycleToMonths(String cycle) {
    switch (cycle) {
      case 'monthly':
        return 1;
      case 'bimonthly':
        return 2;
      case 'quarterly':
        return 3;
      case 'semi_annual':
        return 6;
      case 'annual':
        return 12;
      default:
        return 1;
    }
  }

  /// 空狀態
  Widget _buildEmptyState(bool isDark) {
    return CustomScrollView(
      slivers: [
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
        SliverToBoxAdapter(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.receipt_long_outlined,
                      size: 40,
                      color: AppColors.accent,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text('尚未記錄花費', style: AppTextStyles.cardTitle()),
                  const SizedBox(height: 8),
                  Text(
                    '記錄每一筆花費，追蹤你的消費狀況',
                    style: AppTextStyles.body(color: AppColors.secondaryText),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () {
                      showDialog(
                        context: context,
                        builder: (_) => const AddTransactionDialog(),
                      );
                    },
                    icon: const Icon(Icons.add),
                    label: const Text('記一筆花費'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        // 即使沒有交易記錄，也顯示固定收支
        SliverToBoxAdapter(
          child: _buildFixedExpensesSection(isDark),
        ),
        const SliverToBoxAdapter(
          child: SizedBox(height: AppTheme.spacing2xl),
        ),
      ],
    );
  }
}

/// 攤提明細項目（內部使用）
class _AllocationItem {
  final String name;
  final String cycle;
  final double totalAmount;
  final double monthlyAmount;

  const _AllocationItem({
    required this.name,
    required this.cycle,
    required this.totalAmount,
    required this.monthlyAmount,
  });
}
