import 'package:equatable/equatable.dart';
import 'package:my_money/data/database.dart';

/// 帳戶 BLoC 事件
abstract class AccountsEvent extends Equatable {
  const AccountsEvent();

  @override
  List<Object?> get props => [];
}

/// 載入帳戶列表
class LoadAccounts extends AccountsEvent {
  const LoadAccounts();
}

/// 新增帳戶
class AddAccount extends AccountsEvent {
  final AccountsCompanion account;

  const AddAccount(this.account);

  @override
  List<Object?> get props => [account];
}

/// 更新帳戶
class UpdateAccount extends AccountsEvent {
  final Account account;

  const UpdateAccount(this.account);

  @override
  List<Object?> get props => [account];
}

/// 刪除帳戶
class DeleteAccount extends AccountsEvent {
  final String id;

  const DeleteAccount(this.id);

  @override
  List<Object?> get props => [id];
}
