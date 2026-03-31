import 'package:decimal/decimal.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/data/repositories/transaction_repository.dart';

import 'expenses_event.dart';
import 'expenses_state.dart';

export 'expenses_event.dart';
export 'expenses_state.dart';

/// 花費 BLoC — 管理交易紀錄與月度摘要
class ExpensesBloc extends Bloc<ExpensesEvent, ExpensesState> {
  final TransactionRepository _transactionRepo;

  /// 所有交易紀錄（用於分類篩選時保留完整資料）
  List<Transaction> _allTransactions = [];

  ExpensesBloc({required TransactionRepository transactionRepository})
      : _transactionRepo = transactionRepository,
        super(const ExpensesInitial()) {
    on<LoadExpenses>(_onLoadExpenses);
    on<AddExpense>(_onAddExpense);
    on<UpdateExpense>(_onUpdateExpense);
    on<DeleteExpense>(_onDeleteExpense);
    on<FilterByCategory>(_onFilterByCategory);
  }

  /// 處理載入花費事件
  Future<void> _onLoadExpenses(
    LoadExpenses event,
    Emitter<ExpensesState> emit,
  ) async {
    emit(const ExpensesLoading());
    try {
      _allTransactions = await _transactionRepo.getAllTransactions();
      final summary = _calculateMonthlySummary(_allTransactions);
      emit(ExpensesLoaded(
        transactions: _allTransactions,
        monthlySummary: summary,
      ));
    } catch (e) {
      emit(ExpensesError(e.toString()));
    }
  }

  /// 處理新增花費事件
  Future<void> _onAddExpense(
    AddExpense event,
    Emitter<ExpensesState> emit,
  ) async {
    try {
      await _transactionRepo.addTransaction(event.transaction);
      _allTransactions = await _transactionRepo.getAllTransactions();
      final summary = _calculateMonthlySummary(_allTransactions);
      emit(ExpensesLoaded(
        transactions: _allTransactions,
        monthlySummary: summary,
      ));
    } catch (e) {
      emit(ExpensesError(e.toString()));
    }
  }

  /// 處理更新花費事件
  Future<void> _onUpdateExpense(
    UpdateExpense event,
    Emitter<ExpensesState> emit,
  ) async {
    try {
      await _transactionRepo.updateTransaction(event.transaction);
      _allTransactions = await _transactionRepo.getAllTransactions();
      final summary = _calculateMonthlySummary(_allTransactions);
      emit(ExpensesLoaded(
        transactions: _allTransactions,
        monthlySummary: summary,
      ));
    } catch (e) {
      emit(ExpensesError(e.toString()));
    }
  }

  /// 處理刪除花費事件
  Future<void> _onDeleteExpense(
    DeleteExpense event,
    Emitter<ExpensesState> emit,
  ) async {
    try {
      await _transactionRepo.deleteTransaction(event.id);
      _allTransactions = await _transactionRepo.getAllTransactions();
      final summary = _calculateMonthlySummary(_allTransactions);
      emit(ExpensesLoaded(
        transactions: _allTransactions,
        monthlySummary: summary,
      ));
    } catch (e) {
      emit(ExpensesError(e.toString()));
    }
  }

  /// 處理分類篩選事件（只更新選中分類，不篩選 transactions）
  Future<void> _onFilterByCategory(
    FilterByCategory event,
    Emitter<ExpensesState> emit,
  ) async {
    final summary = _calculateMonthlySummary(_allTransactions);
    emit(ExpensesLoaded(
      transactions: _allTransactions,
      monthlySummary: summary,
      selectedCategory: event.category,
    ));
  }

  /// 計算本月花費摘要
  MonthlySummary _calculateMonthlySummary(List<Transaction> transactions) {
    final now = DateTime.now();
    final thisMonth = transactions.where((t) =>
        t.date.year == now.year &&
        t.date.month == now.month &&
        t.type == 'expense');

    double totalSpent = 0;
    final byCategory = <String, double>{};

    for (final tx in thisMonth) {
      final amount = Decimal.parse(tx.amount).toDouble();
      totalSpent += amount;
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + amount;
    }

    return MonthlySummary(
      totalSpent: totalSpent,
      byCategory: byCategory,
    );
  }
}
