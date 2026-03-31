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

      // 將固定支出轉為核心引擎的現金流事件（根據週期計算未來到期日）
      final cashflowEvents = <core.CashflowEvent>[];
      final today = DateTime.now();
      final todayNormalized = DateTime(today.year, today.month, today.day);
      final endDate = todayNormalized.add(const Duration(days: 30));

      for (final expense in fixedExpenses) {
        final delta = expense.type == 'income'
            ? Decimal.parse(expense.amount)
            : -Decimal.parse(expense.amount);

        // 根據週期產生未來 30 天內的所有到期日
        for (final date in _generateDueDates(expense.dueDate, expense.cycle, todayNormalized, endDate)) {
          cashflowEvents.add(core.CashflowEvent(
            date: date,
            description: expense.name,
            delta: delta,
          ));
        }
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

  /// 根據 dueDay 和週期，產生 [start] 到 [end] 之間的所有到期日
  static List<DateTime> _generateDueDates(
    DateTime dueDate,
    String cycle,
    DateTime start,
    DateTime end,
  ) {
    final dueDay = dueDate.day;
    final results = <DateTime>[];

    // 計算週期的月數間隔
    final monthInterval = switch (cycle) {
      'monthly' => 1,
      'bimonthly' => 2,
      'quarterly' => 3,
      'semi_annual' => 6,
      'annual' => 12,
      _ => 1,
    };

    // 從 start 的月份開始掃描，往前多看一個月以免遺漏
    var year = start.year;
    var month = start.month - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }

    // 掃描每個月，檢查是否為合法的週期月份
    for (var i = 0; i < 36; i++) {
      // 計算這個月的實際扣款日（處理月份天數不足）
      final lastDay = DateTime(year, month + 1, 0).day;
      final actualDay = dueDay > lastDay ? lastDay : dueDay;
      final date = DateTime(year, month, actualDay);

      if (date.isAfter(end)) break;

      if (!date.isBefore(start)) {
        if (monthInterval == 1) {
          // 月繳：每個月都符合
          results.add(date);
        } else {
          // 非月繳：檢查與原始到期月份的間距是否為週期的倍數
          final monthDiff = (year - dueDate.year) * 12 + (month - dueDate.month);
          if (monthDiff % monthInterval == 0) {
            results.add(date);
          }
        }
      }

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return results;
  }
}
