import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 固定收支 BLoC 事件
abstract class FixedExpensesEvent extends Equatable {
  const FixedExpensesEvent();

  @override
  List<Object?> get props => [];
}

/// 載入所有固定收支
class LoadFixedExpenses extends FixedExpensesEvent {
  const LoadFixedExpenses();
}

/// 新增固定收支
class AddFixedExpense extends FixedExpensesEvent {
  final FixedExpensesCompanion entry;
  const AddFixedExpense(this.entry);

  @override
  List<Object?> get props => [entry];
}

/// 更新固定收支
class UpdateFixedExpense extends FixedExpensesEvent {
  final FixedExpense item;
  const UpdateFixedExpense(this.item);

  @override
  List<Object?> get props => [item];
}

/// 刪除固定收支
class DeleteFixedExpense extends FixedExpensesEvent {
  final String id;
  const DeleteFixedExpense(this.id);

  @override
  List<Object?> get props => [id];
}
