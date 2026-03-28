import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 儲蓄目標 BLoC 事件
abstract class GoalsEvent extends Equatable {
  const GoalsEvent();

  @override
  List<Object?> get props => [];
}

/// 載入儲蓄目標列表
class LoadGoals extends GoalsEvent {
  const LoadGoals();
}

/// 新增儲蓄目標
class AddGoal extends GoalsEvent {
  final SavingsGoalsCompanion goal;

  const AddGoal(this.goal);

  @override
  List<Object?> get props => [goal];
}

/// 更新儲蓄目標
class UpdateGoal extends GoalsEvent {
  final SavingsGoal goal;

  const UpdateGoal(this.goal);

  @override
  List<Object?> get props => [goal];
}

/// 刪除儲蓄目標
class DeleteGoal extends GoalsEvent {
  final String id;

  const DeleteGoal(this.id);

  @override
  List<Object?> get props => [id];
}

/// 存入金額到儲蓄目標
class DepositToGoal extends GoalsEvent {
  /// 目標 ID
  final String goalId;

  /// 存入金額（Decimal 字串）
  final String amount;

  const DepositToGoal({required this.goalId, required this.amount});

  @override
  List<Object?> get props => [goalId, amount];
}
