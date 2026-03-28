import 'package:equatable/equatable.dart';
import 'package:my_money/core/cashflow_forecast.dart';
import 'package:my_money/core/purchasing_power.dart' as core;

/// 現金流 BLoC 狀態
abstract class CashflowState extends Equatable {
  const CashflowState();

  @override
  List<Object?> get props => [];
}

/// 初始狀態
class CashflowInitial extends CashflowState {
  const CashflowInitial();
}

/// 載入中
class CashflowLoading extends CashflowState {
  const CashflowLoading();
}

/// 載入完成 — 包含現金流預測與最低點
class CashflowLoaded extends CashflowState {
  /// 現金流預測時間軸
  final List<CashflowPoint> forecast;

  /// 最低餘額點
  final CashflowPoint? minimumPoint;

  const CashflowLoaded({
    required this.forecast,
    this.minimumPoint,
  });

  @override
  List<Object?> get props => [forecast, minimumPoint];
}

/// 購買力檢查結果
class PurchaseCheckResultState extends CashflowState {
  /// 核心引擎的檢查結果
  final core.PurchaseCheckResult result;

  const PurchaseCheckResultState(this.result);

  @override
  List<Object?> get props => [result];
}

/// 載入失敗
class CashflowError extends CashflowState {
  /// 錯誤訊息
  final String message;

  const CashflowError(this.message);

  @override
  List<Object?> get props => [message];
}
