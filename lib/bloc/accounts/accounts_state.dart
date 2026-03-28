import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 帳戶 BLoC 狀態
abstract class AccountsState extends Equatable {
  const AccountsState();

  @override
  List<Object?> get props => [];
}

/// 初始狀態
class AccountsInitial extends AccountsState {
  const AccountsInitial();
}

/// 載入中
class AccountsLoading extends AccountsState {
  const AccountsLoading();
}

/// 載入完成 — 包含帳戶清單
class AccountsLoaded extends AccountsState {
  /// 帳戶清單
  final List<Account> accounts;

  const AccountsLoaded(this.accounts);

  @override
  List<Object?> get props => [accounts];
}

/// 載入失敗
class AccountsError extends AccountsState {
  /// 錯誤訊息
  final String message;

  const AccountsError(this.message);

  @override
  List<Object?> get props => [message];
}
