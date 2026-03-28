import 'package:equatable/equatable.dart';

/// 餘額 BLoC 事件
abstract class BalanceEvent extends Equatable {
  const BalanceEvent();

  @override
  List<Object?> get props => [];
}

/// 載入餘額
class LoadBalance extends BalanceEvent {
  const LoadBalance();
}

/// 重新整理餘額
class RefreshBalance extends BalanceEvent {
  const RefreshBalance();
}
