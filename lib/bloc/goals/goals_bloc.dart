import 'package:decimal/decimal.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/data/repositories/savings_goal_repository.dart';

import 'goals_event.dart';
import 'goals_state.dart';

export 'goals_event.dart';
export 'goals_state.dart';

/// 儲蓄目標 BLoC — 管理儲蓄目標 CRUD 與存入操作
class GoalsBloc extends Bloc<GoalsEvent, GoalsState> {
  final SavingsGoalRepository _goalRepo;
  final BalanceBloc _balanceBloc;

  GoalsBloc({
    required SavingsGoalRepository savingsGoalRepository,
    required BalanceBloc balanceBloc,
  })  : _goalRepo = savingsGoalRepository,
        _balanceBloc = balanceBloc,
        super(const GoalsInitial()) {
    on<LoadGoals>(_onLoadGoals);
    on<AddGoal>(_onAddGoal);
    on<UpdateGoal>(_onUpdateGoal);
    on<DeleteGoal>(_onDeleteGoal);
    on<DepositToGoal>(_onDepositToGoal);
  }

  /// 處理載入儲蓄目標事件
  Future<void> _onLoadGoals(
    LoadGoals event,
    Emitter<GoalsState> emit,
  ) async {
    emit(const GoalsLoading());
    try {
      final goals = await _goalRepo.getAllGoals();
      emit(GoalsLoaded(goals));
    } catch (e) {
      emit(GoalsError(e.toString()));
    }
  }

  /// 處理新增儲蓄目標事件
  Future<void> _onAddGoal(
    AddGoal event,
    Emitter<GoalsState> emit,
  ) async {
    try {
      await _goalRepo.addGoal(event.goal);
      final goals = await _goalRepo.getAllGoals();
      emit(GoalsLoaded(goals));
    } catch (e) {
      emit(GoalsError(e.toString()));
    }
  }

  /// 處理更新儲蓄目標事件
  Future<void> _onUpdateGoal(
    UpdateGoal event,
    Emitter<GoalsState> emit,
  ) async {
    try {
      await _goalRepo.updateGoal(event.goal);
      final goals = await _goalRepo.getAllGoals();
      emit(GoalsLoaded(goals));
    } catch (e) {
      emit(GoalsError(e.toString()));
    }
  }

  /// 處理刪除儲蓄目標事件
  Future<void> _onDeleteGoal(
    DeleteGoal event,
    Emitter<GoalsState> emit,
  ) async {
    try {
      await _goalRepo.deleteGoal(event.id);
      final goals = await _goalRepo.getAllGoals();
      emit(GoalsLoaded(goals));
    } catch (e) {
      emit(GoalsError(e.toString()));
    }
  }

  /// 處理存入金額事件 — 同時更新餘額
  Future<void> _onDepositToGoal(
    DepositToGoal event,
    Emitter<GoalsState> emit,
  ) async {
    try {
      // 取得目前目標
      final goals = await _goalRepo.getAllGoals();
      final goal = goals.firstWhere((g) => g.id == event.goalId);

      // 計算新的已存金額
      final currentAmount = Decimal.parse(goal.currentAmount);
      final depositAmount = Decimal.parse(event.amount);
      final newAmount = currentAmount + depositAmount;

      // 更新儲蓄目標
      await _goalRepo.depositToGoal(event.goalId, newAmount.toString());

      // 重新載入目標清單
      final updatedGoals = await _goalRepo.getAllGoals();
      emit(GoalsLoaded(updatedGoals));

      // 同時通知餘額 BLoC 重新整理
      _balanceBloc.add(const RefreshBalance());
    } catch (e) {
      emit(GoalsError(e.toString()));
    }
  }
}
