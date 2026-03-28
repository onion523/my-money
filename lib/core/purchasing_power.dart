import 'package:decimal/decimal.dart';
import 'package:equatable/equatable.dart';

import 'balance_calculator.dart';
import 'cashflow_forecast.dart';

/// 購買力檢查結果
class PurchaseCheckResult extends Equatable {
  /// 是否可以負擔
  final bool canAfford;

  /// 購買後剩餘可用餘額
  final Decimal remainingBalance;

  /// 購買金額
  final Decimal purchaseAmount;

  /// 未來現金流是否安全（不會出現負餘額）
  final bool forecastSafe;

  /// 警告訊息（若有風險）
  final String? warning;

  const PurchaseCheckResult({
    required this.canAfford,
    required this.remainingBalance,
    required this.purchaseAmount,
    required this.forecastSafe,
    this.warning,
  });

  @override
  List<Object?> get props => [
        canAfford,
        remainingBalance,
        purchaseAmount,
        forecastSafe,
        warning,
      ];
}

/// 購買力分析引擎 — 評估一筆消費是否負擔得起
class PurchasingPower {
  /// 檢查是否能負擔一筆消費
  ///
  /// [amount] 消費金額
  /// [currentBalance] 目前可用餘額（攤提後）
  /// [goals] 儲蓄目標清單（用於判斷是否侵蝕儲蓄）
  /// [forecast] 未來現金流預測點
  static PurchaseCheckResult check({
    required Decimal amount,
    required Decimal currentBalance,
    required List<SavingsGoalData> goals,
    required List<CashflowPoint> forecast,
  }) {
    // 負數或零金額：無法購買
    if (amount <= Decimal.zero) {
      return PurchaseCheckResult(
        canAfford: false,
        remainingBalance: currentBalance,
        purchaseAmount: amount,
        forecastSafe: true,
        warning: '購買金額必須大於零',
      );
    }

    final remainingBalance = currentBalance - amount;
    final canAfford = remainingBalance >= Decimal.zero;

    // 檢查未來現金流：購買後是否會有任何一天餘額為負
    var forecastSafe = true;
    if (forecast.isNotEmpty) {
      // 模擬扣除購買金額後的現金流
      for (final point in forecast) {
        if ((point.balance - amount) < Decimal.zero) {
          forecastSafe = false;
          break;
        }
      }
    }

    // 產生警告
    String? warning;
    if (!canAfford) {
      warning = '餘額不足，缺少 ${(amount - currentBalance).toStringAsFixed(2)} 元';
    } else if (!forecastSafe) {
      warning = '雖然目前餘額足夠，但未來現金流可能出現不足';
    } else if (remainingBalance < _totalMonthlyReserve(goals)) {
      warning = '購買後剩餘餘額低於每月儲蓄目標預留額';
    }

    return PurchaseCheckResult(
      canAfford: canAfford,
      remainingBalance: remainingBalance,
      purchaseAmount: amount,
      forecastSafe: forecastSafe,
      warning: warning,
    );
  }

  /// 計算所有儲蓄目標的每月預留總額
  static Decimal _totalMonthlyReserve(List<SavingsGoalData> goals) {
    return goals.fold(
      Decimal.zero,
      (sum, g) => sum + g.monthlyReserve,
    );
  }
}
