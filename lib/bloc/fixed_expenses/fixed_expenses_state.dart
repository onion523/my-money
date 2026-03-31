import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 固定收支 BLoC 狀態
abstract class FixedExpensesState extends Equatable {
  const FixedExpensesState();

  @override
  List<Object?> get props => [];
}

/// 初始狀態
class FixedExpensesInitial extends FixedExpensesState {
  const FixedExpensesInitial();
}

/// 載入中
class FixedExpensesLoading extends FixedExpensesState {
  const FixedExpensesLoading();
}

/// 載入完成
class FixedExpensesLoaded extends FixedExpensesState {
  final List<FixedExpense> items;

  const FixedExpensesLoaded(this.items);

  /// 固定支出
  List<FixedExpense> get expenses =>
      items.where((e) => e.type == 'expense').toList();

  /// 固定收入
  List<FixedExpense> get incomes =>
      items.where((e) => e.type == 'income').toList();

  @override
  List<Object?> get props => [items];
}

/// 載入失敗
class FixedExpensesError extends FixedExpensesState {
  final String message;
  const FixedExpensesError(this.message);

  @override
  List<Object?> get props => [message];
}
