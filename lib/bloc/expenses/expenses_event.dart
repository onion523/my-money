import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 花費 BLoC 事件
abstract class ExpensesEvent extends Equatable {
  const ExpensesEvent();

  @override
  List<Object?> get props => [];
}

/// 載入花費紀錄
class LoadExpenses extends ExpensesEvent {
  const LoadExpenses();
}

/// 新增花費
class AddExpense extends ExpensesEvent {
  final TransactionsCompanion transaction;

  const AddExpense(this.transaction);

  @override
  List<Object?> get props => [transaction];
}

/// 刪除花費
class DeleteExpense extends ExpensesEvent {
  final String id;

  const DeleteExpense(this.id);

  @override
  List<Object?> get props => [id];
}

/// 依分類篩選
class FilterByCategory extends ExpensesEvent {
  /// 分類名稱（null 表示全部）
  final String? category;

  const FilterByCategory(this.category);

  @override
  List<Object?> get props => [category];
}
