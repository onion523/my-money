import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/data/repositories/fixed_expense_repository.dart';

import 'fixed_expenses_event.dart';
import 'fixed_expenses_state.dart';

export 'fixed_expenses_event.dart';
export 'fixed_expenses_state.dart';

/// 固定收支 BLoC — 管理固定支出與固定收入
class FixedExpensesBloc extends Bloc<FixedExpensesEvent, FixedExpensesState> {
  final FixedExpenseRepository _repo;
  final CashflowBloc _cashflowBloc;

  FixedExpensesBloc({
    required FixedExpenseRepository repository,
    required CashflowBloc cashflowBloc,
  })  : _repo = repository,
        _cashflowBloc = cashflowBloc,
        super(const FixedExpensesInitial()) {
    on<LoadFixedExpenses>(_onLoad);
    on<AddFixedExpense>(_onAdd);
    on<UpdateFixedExpense>(_onUpdate);
    on<DeleteFixedExpense>(_onDelete);
  }

  Future<void> _onLoad(
    LoadFixedExpenses event,
    Emitter<FixedExpensesState> emit,
  ) async {
    emit(const FixedExpensesLoading());
    try {
      final items = await _repo.getAllFixedExpenses();
      emit(FixedExpensesLoaded(items));
    } catch (e) {
      emit(FixedExpensesError(e.toString()));
    }
  }

  Future<void> _onAdd(
    AddFixedExpense event,
    Emitter<FixedExpensesState> emit,
  ) async {
    try {
      await _repo.createFixedExpense(event.entry);
    } catch (_) {
      // API 失敗時不中斷，繼續重新載入
    }
    final items = await _repo.getAllFixedExpenses();
    emit(FixedExpensesLoaded(items));
    _cashflowBloc.add(const LoadCashflow());
  }

  Future<void> _onUpdate(
    UpdateFixedExpense event,
    Emitter<FixedExpensesState> emit,
  ) async {
    try {
      await _repo.updateFixedExpense(event.item);
    } catch (_) {}
    final items = await _repo.getAllFixedExpenses();
    emit(FixedExpensesLoaded(items));
    _cashflowBloc.add(const LoadCashflow());
  }

  Future<void> _onDelete(
    DeleteFixedExpense event,
    Emitter<FixedExpensesState> emit,
  ) async {
    try {
      await _repo.deleteFixedExpense(event.id);
    } catch (_) {}
    final items = await _repo.getAllFixedExpenses();
    emit(FixedExpensesLoaded(items));
    _cashflowBloc.add(const LoadCashflow());
  }
}
