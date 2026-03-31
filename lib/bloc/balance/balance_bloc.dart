import 'package:decimal/decimal.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/core/balance_calculator.dart';
import 'package:my_money/data/repositories/account_repository.dart';
import 'package:my_money/data/repositories/fixed_expense_repository.dart';
import 'package:my_money/data/repositories/savings_goal_repository.dart';
import 'package:my_money/data/repositories/transaction_repository.dart';

import 'balance_event.dart';
import 'balance_state.dart';

export 'balance_event.dart';
export 'balance_state.dart';

/// 餘額 BLoC — 使用 BalanceCalculator 計算即時可用餘額
class BalanceBloc extends Bloc<BalanceEvent, BalanceState> {
  final AccountRepository _accountRepo;
  final FixedExpenseRepository _fixedExpenseRepo;
  final SavingsGoalRepository _savingsGoalRepo;
  final TransactionRepository _transactionRepo;

  BalanceBloc({
    required AccountRepository accountRepository,
    required FixedExpenseRepository fixedExpenseRepository,
    required SavingsGoalRepository savingsGoalRepository,
    required TransactionRepository transactionRepository,
  })  : _accountRepo = accountRepository,
        _fixedExpenseRepo = fixedExpenseRepository,
        _savingsGoalRepo = savingsGoalRepository,
        _transactionRepo = transactionRepository,
        super(const BalanceInitial()) {
    on<LoadBalance>(_onLoadBalance);
    on<RefreshBalance>(_onRefreshBalance);
  }

  /// 處理載入餘額事件
  Future<void> _onLoadBalance(
    LoadBalance event,
    Emitter<BalanceState> emit,
  ) async {
    emit(const BalanceLoading());
    await _calculateAndEmit(emit);
  }

  /// 處理重新整理餘額事件
  Future<void> _onRefreshBalance(
    RefreshBalance event,
    Emitter<BalanceState> emit,
  ) async {
    await _calculateAndEmit(emit);
  }

  /// 從資料庫取得資料並計算餘額
  Future<void> _calculateAndEmit(Emitter<BalanceState> emit) async {
    try {
      // 從資料庫取得帳戶、固定支出、儲蓄目標、交易紀錄
      final accounts = await _accountRepo.getAllAccounts();
      final fixedExpenses = await _fixedExpenseRepo.getAllFixedExpenses();
      final savingsGoals = await _savingsGoalRepo.getAllGoals();
      final transactions = await _transactionRepo.getAllTransactions();

      // 將 drift 資料模型轉換為核心引擎的資料模型
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

      final savingsGoalDataList = savingsGoals.map((g) => SavingsGoalData(
            id: g.id,
            name: g.name,
            targetAmount: Decimal.parse(g.targetAmount),
            currentAmount: Decimal.parse(g.currentAmount),
            monthlyReserve: Decimal.parse(g.monthlyReserve),
          )).toList();

      // 計算當月交易淨額（收入 - 支出）
      final now = DateTime.now();
      var monthlyIncome = Decimal.zero;
      var monthlyExpense = Decimal.zero;
      for (final tx in transactions) {
        if (tx.date.year == now.year && tx.date.month == now.month) {
          final amount = Decimal.parse(tx.amount);
          if (tx.type == 'income') {
            monthlyIncome += amount;
          } else {
            monthlyExpense += amount;
          }
        }
      }

      // 呼叫核心計算引擎
      final result = BalanceCalculator.calculateAvailableBalance(
        accounts: accountDataList,
        fixedExpenses: fixedExpenseDataList,
        savingsGoals: savingsGoalDataList,
        today: now,
        monthlyIncome: monthlyIncome,
        monthlyExpense: monthlyExpense,
      );

      emit(BalanceLoaded(
        available: result.available,
        afterAllocation: result.afterAllocation,
        pending: result.pendingAllocation,
        unbilledTotal: result.unbilledTotal,
      ));
    } catch (e) {
      emit(BalanceError(e.toString()));
    }
  }
}
