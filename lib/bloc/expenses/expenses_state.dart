import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 月度花費摘要
class MonthlySummary extends Equatable {
  /// 總花費金額
  final double totalSpent;

  /// 分類花費統計（分類名稱 -> 金額）
  final Map<String, double> byCategory;

  const MonthlySummary({
    required this.totalSpent,
    required this.byCategory,
  });

  @override
  List<Object?> get props => [totalSpent, byCategory];
}

/// 花費 BLoC 狀態
abstract class ExpensesState extends Equatable {
  const ExpensesState();

  @override
  List<Object?> get props => [];
}

/// 初始狀態
class ExpensesInitial extends ExpensesState {
  const ExpensesInitial();
}

/// 載入中
class ExpensesLoading extends ExpensesState {
  const ExpensesLoading();
}

/// 載入完成 — 包含交易清單與月度摘要
class ExpensesLoaded extends ExpensesState {
  /// 交易清單
  final List<Transaction> transactions;

  /// 月度摘要
  final MonthlySummary monthlySummary;

  /// 目前篩選的分類（null 表示全部）
  final String? selectedCategory;

  const ExpensesLoaded({
    required this.transactions,
    required this.monthlySummary,
    this.selectedCategory,
  });

  @override
  List<Object?> get props => [transactions, monthlySummary, selectedCategory];
}

/// 載入失敗
class ExpensesError extends ExpensesState {
  /// 錯誤訊息
  final String message;

  const ExpensesError(this.message);

  @override
  List<Object?> get props => [message];
}
