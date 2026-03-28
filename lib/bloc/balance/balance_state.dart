import 'package:decimal/decimal.dart';
import 'package:equatable/equatable.dart';

/// 餘額 BLoC 狀態
abstract class BalanceState extends Equatable {
  const BalanceState();

  @override
  List<Object?> get props => [];
}

/// 初始狀態
class BalanceInitial extends BalanceState {
  const BalanceInitial();
}

/// 載入中
class BalanceLoading extends BalanceState {
  const BalanceLoading();
}

/// 載入完成 — 包含即時可用、攤提後可自由花用、待攤提金額
class BalanceLoaded extends BalanceState {
  /// 即時可用餘額
  final Decimal available;

  /// 攤提後可自由花用
  final Decimal afterAllocation;

  /// 待攤提金額
  final Decimal pending;

  const BalanceLoaded({
    required this.available,
    required this.afterAllocation,
    required this.pending,
  });

  @override
  List<Object?> get props => [available, afterAllocation, pending];
}

/// 載入失敗
class BalanceError extends BalanceState {
  /// 錯誤訊息
  final String message;

  const BalanceError(this.message);

  @override
  List<Object?> get props => [message];
}
