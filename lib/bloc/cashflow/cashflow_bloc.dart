import 'package:decimal/decimal.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/core/balance_calculator.dart';
import 'package:my_money/core/cashflow_forecast.dart' as core;
import 'package:my_money/core/purchasing_power.dart';
import 'package:my_money/data/repositories/account_repository.dart';
import 'package:my_money/data/repositories/fixed_expense_repository.dart';
import 'package:my_money/data/repositories/savings_goal_repository.dart';

import 'cashflow_event.dart';
import 'cashflow_state.dart';

export 'cashflow_event.dart';
export 'cashflow_state.dart';

/// 現金流 BLoC — 使用 CashflowForecast + PurchasingPower 引擎
class CashflowBloc extends Bloc<CashflowEvent, CashflowState> {
  final AccountRepository _accountRepo;
  final FixedExpenseRepository _fixedExpenseRepo;
  final SavingsGoalRepository _savingsGoalRepo;

  /// 暫存的現金流預測結果（供購買力檢查使用）
  List<core.CashflowPoint> _cachedForecast = [];

  /// 暫存的攤提後可自由花用餘額
  Decimal _cachedAfterAllocation = Decimal.zero;

  /// 暫存的儲蓄目標資料
  List<SavingsGoalData> _cachedSavingsGoals = [];

  CashflowBloc({
    required AccountRepository accountRepository,
    required FixedExpenseRepository fixedExpenseRepository,
    required SavingsGoalRepository savingsGoalRepository,
  })  : _accountRepo = accountRepository,
        _fixedExpenseRepo = fixedExpenseRepository,
        _savingsGoalRepo = savingsGoalRepository,
        super(const CashflowInitial()) {
    on<LoadCashflow>(_onLoadCashflow);
    on<CheckPurchasingPower>(_onCheckPurchasingPower);
  }

  /// 處理載入現金流預測事件
  Future<void> _onLoadCashflow(
    LoadCashflow event,
    Emitter<CashflowState> emit,
  ) async {
    emit(const CashflowLoading());
    try {
      // 取得資料庫資料
      final accounts = await _accountRepo.getAllAccounts();
      final fixedExpenses = await _fixedExpenseRepo.getAllFixedExpenses();
      final savingsGoals = await _savingsGoalRepo.getAllGoals();

      // 計算銀行總餘額
      final bankBalance = accounts
          .where((a) => a.type == 'bank')
          .fold(Decimal.zero, (sum, a) => sum + Decimal.parse(a.balance));

      // 將固定支出轉為核心引擎的現金流事件
      final cashflowEvents = <core.CashflowEvent>[];
      for (final expense in fixedExpenses) {
        cashflowEvents.add(core.CashflowEvent(
          date: expense.dueDate,
          description: expense.name,
          delta: -Decimal.parse(expense.amount),
        ));
      }

      // 模擬未來 30 天現金流
      final forecast = core.CashflowForecast.simulate(
        bankBalance: bankBalance,
        events: cashflowEvents,
        days: 30,
      );

      // 找出最低點
      core.CashflowPoint? minimumPoint;
      if (forecast.isNotEmpty) {
        minimumPoint = forecast.reduce(
          (a, b) => a.balance < b.balance ? a : b,
        );
      }

      // 暫存資料供購買力檢查使用
      _cachedForecast = forecast;

      // 計算攤提後餘額
      final accountDataList = accounts.map((a) => AccountData(
            id: a.id,
            name: a.name,
            type: a.type,
            balance: Decimal.parse(a.balance),
            billedAmount:
                a.billedAmount != null ? Decimal.parse(a.billedAmount!) : null,
            unbilledAmount: a.unbilledAmount != null
                ? Decimal.parse(a.unbilledAmount!)
                : null,
          )).toList();

      final fixedExpenseDataList = fixedExpenses.map((e) => FixedExpenseData(
            id: e.id,
            name: e.name,
            amount: Decimal.parse(e.amount),
            cycle: e.cycle,
            dueDate: e.dueDate,
            reservedAmount: Decimal.parse(e.reservedAmount),
          )).toList();

      _cachedSavingsGoals = savingsGoals.map((g) => SavingsGoalData(
            id: g.id,
            name: g.name,
            targetAmount: Decimal.parse(g.targetAmount),
            currentAmount: Decimal.parse(g.currentAmount),
            monthlyReserve: Decimal.parse(g.monthlyReserve),
          )).toList();

      final balanceResult = BalanceCalculator.calculateAvailableBalance(
        accounts: accountDataList,
        fixedExpenses: fixedExpenseDataList,
        savingsGoals: _cachedSavingsGoals,
        today: DateTime.now(),
      );
      _cachedAfterAllocation = balanceResult.afterAllocation;

      emit(CashflowLoaded(
        forecast: forecast,
        minimumPoint: minimumPoint,
      ));
    } catch (e) {
      emit(CashflowError(e.toString()));
    }
  }

  /// 處理購買力檢查事件
  Future<void> _onCheckPurchasingPower(
    CheckPurchasingPower event,
    Emitter<CashflowState> emit,
  ) async {
    try {
      final result = PurchasingPower.check(
        amount: event.amount,
        currentBalance: _cachedAfterAllocation,
        goals: _cachedSavingsGoals,
        forecast: _cachedForecast,
      );
      emit(PurchaseCheckResultState(result));
    } catch (e) {
      emit(CashflowError(e.toString()));
    }
  }
}
