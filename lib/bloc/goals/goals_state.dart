import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 儲蓄目標 BLoC 狀態
abstract class GoalsState extends Equatable {
  const GoalsState();

  @override
  List<Object?> get props => [];
}

/// 初始狀態
class GoalsInitial extends GoalsState {
  const GoalsInitial();
}

/// 載入中
class GoalsLoading extends GoalsState {
  const GoalsLoading();
}

/// 載入完成 — 包含儲蓄目標清單
class GoalsLoaded extends GoalsState {
  /// 儲蓄目標清單
  final List<SavingsGoal> goals;

  const GoalsLoaded(this.goals);

  @override
  List<Object?> get props => [goals];
}

/// 載入失敗
class GoalsError extends GoalsState {
  /// 錯誤訊息
  final String message;

  const GoalsError(this.message);

  @override
  List<Object?> get props => [message];
}
