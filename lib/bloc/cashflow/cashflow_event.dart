import 'package:decimal/decimal.dart';
import 'package:equatable/equatable.dart';

/// 現金流 BLoC 事件
abstract class CashflowEvent extends Equatable {
  const CashflowEvent();

  @override
  List<Object?> get props => [];
}

/// 載入現金流預測
class LoadCashflow extends CashflowEvent {
  const LoadCashflow();
}

/// 檢查購買力
class CheckPurchasingPower extends CashflowEvent {
  /// 購買金額
  final Decimal amount;

  const CheckPurchasingPower(this.amount);

  @override
  List<Object?> get props => [amount];
}
