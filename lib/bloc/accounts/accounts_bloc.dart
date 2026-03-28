import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/data/repositories/account_repository.dart';

import 'accounts_event.dart';
import 'accounts_state.dart';

export 'accounts_event.dart';
export 'accounts_state.dart';

/// 帳戶 BLoC — 管理帳戶 CRUD 操作
class AccountsBloc extends Bloc<AccountsEvent, AccountsState> {
  final AccountRepository _accountRepo;

  AccountsBloc({required AccountRepository accountRepository})
      : _accountRepo = accountRepository,
        super(const AccountsInitial()) {
    on<LoadAccounts>(_onLoadAccounts);
    on<AddAccount>(_onAddAccount);
    on<UpdateAccount>(_onUpdateAccount);
    on<DeleteAccount>(_onDeleteAccount);
  }

  /// 處理載入帳戶列表事件
  Future<void> _onLoadAccounts(
    LoadAccounts event,
    Emitter<AccountsState> emit,
  ) async {
    emit(const AccountsLoading());
    try {
      final accounts = await _accountRepo.getAllAccounts();
      emit(AccountsLoaded(accounts));
    } catch (e) {
      emit(AccountsError(e.toString()));
    }
  }

  /// 處理新增帳戶事件
  Future<void> _onAddAccount(
    AddAccount event,
    Emitter<AccountsState> emit,
  ) async {
    try {
      await _accountRepo.addAccount(event.account);
      final accounts = await _accountRepo.getAllAccounts();
      emit(AccountsLoaded(accounts));
    } catch (e) {
      emit(AccountsError(e.toString()));
    }
  }

  /// 處理更新帳戶事件
  Future<void> _onUpdateAccount(
    UpdateAccount event,
    Emitter<AccountsState> emit,
  ) async {
    try {
      await _accountRepo.updateAccount(event.account);
      final accounts = await _accountRepo.getAllAccounts();
      emit(AccountsLoaded(accounts));
    } catch (e) {
      emit(AccountsError(e.toString()));
    }
  }

  /// 處理刪除帳戶事件
  Future<void> _onDeleteAccount(
    DeleteAccount event,
    Emitter<AccountsState> emit,
  ) async {
    try {
      await _accountRepo.deleteAccount(event.id);
      final accounts = await _accountRepo.getAllAccounts();
      emit(AccountsLoaded(accounts));
    } catch (e) {
      emit(AccountsError(e.toString()));
    }
  }
}
