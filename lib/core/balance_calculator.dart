import 'package:decimal/decimal.dart';
import 'package:equatable/equatable.dart';

/// 餘額計算結果
class BalanceResult extends Equatable {
  /// 即時可用餘額（銀行總額 - 信用卡已出帳 - 未入帳 - 月繳剩餘 - 預留已標記 - 儲蓄已標記）
  final Decimal available;

  /// 攤提後可自由花用（即時可用 - 待攤提）
  final Decimal afterAllocation;

  /// 待攤提金額
  final Decimal pendingAllocation;

  const BalanceResult({
    required this.available,
    required this.afterAllocation,
    required this.pendingAllocation,
  });

  @override
  List<Object?> get props => [available, afterAllocation, pendingAllocation];
}

/// 帳戶資料（計算用，與資料庫模型解耦）
class AccountData {
  final String id;
  final String name;

  /// bank 或 credit_card
  final String type;

  /// 餘額（Decimal 字串）
  final Decimal balance;

  /// 已出帳金額（僅信用卡）
  final Decimal? billedAmount;

  /// 未出帳金額（僅信用卡）
  final Decimal? unbilledAmount;

  const AccountData({
    required this.id,
    required this.name,
    required this.type,
    required this.balance,
    this.billedAmount,
    this.unbilledAmount,
  });
}

/// 固定支出資料（計算用）
class FixedExpenseData {
  final String id;
  final String name;
  final Decimal amount;

  /// monthly / bimonthly / quarterly / semi_annual / annual
  final String cycle;
  final DateTime dueDate;

  /// 已預留金額
  final Decimal reservedAmount;

  const FixedExpenseData({
    required this.id,
    required this.name,
    required this.amount,
    required this.cycle,
    required this.dueDate,
    required this.reservedAmount,
  });
}

/// 儲蓄目標資料（計算用）
class SavingsGoalData {
  final String id;
  final String name;
  final Decimal targetAmount;
  final Decimal currentAmount;

  /// 每月預留金額
  final Decimal monthlyReserve;

  const SavingsGoalData({
    required this.id,
    required this.name,
    required this.targetAmount,
    required this.currentAmount,
    required this.monthlyReserve,
  });
}

/// 餘額計算引擎 — 計算即時可用餘額與攤提後可自由花用金額
///
/// 第一層：銀行總額 - 信用卡已出帳 - 未入帳 - 月繳剩餘（固定支出預留） - 儲蓄已標記 = 即時可用
/// 第二層：即時可用 - 待攤提 = 攤提後可自由花用
class BalanceCalculator {
  /// 計算可用餘額
  ///
  /// [accounts] 所有帳戶清單
  /// [fixedExpenses] 所有固定支出清單
  /// [savingsGoals] 所有儲蓄目標清單
  /// [today] 計算基準日期
  static BalanceResult calculateAvailableBalance({
    required List<AccountData> accounts,
    required List<FixedExpenseData> fixedExpenses,
    required List<SavingsGoalData> savingsGoals,
    required DateTime today,
  }) {
    // 銀行帳戶總額
    final bankTotal = accounts
        .where((a) => a.type == 'bank')
        .fold(Decimal.zero, (sum, a) => sum + a.balance);

    // 信用卡已出帳總額
    final billedTotal = accounts
        .where((a) => a.type == 'credit_card')
        .fold(
          Decimal.zero,
          (sum, a) => sum + (a.billedAmount ?? Decimal.zero),
        );

    // 信用卡未出帳總額
    final unbilledTotal = accounts
        .where((a) => a.type == 'credit_card')
        .fold(
          Decimal.zero,
          (sum, a) => sum + (a.unbilledAmount ?? Decimal.zero),
        );

    // 固定支出已預留總額
    final reservedTotal = fixedExpenses.fold(
      Decimal.zero,
      (sum, e) => sum + e.reservedAmount,
    );

    // 儲蓄目標已存總額（以每月預留累計為「已標記」）
    final savingsReservedTotal = savingsGoals.fold(
      Decimal.zero,
      (sum, g) => sum + g.currentAmount,
    );

    // 第一層：即時可用 = 銀行總額 - 已出帳 - 未出帳 - 固定支出預留 - 儲蓄已標記
    final available =
        bankTotal - billedTotal - unbilledTotal - reservedTotal - savingsReservedTotal;

    // 計算待攤提：本月還需要為固定支出和儲蓄目標預留的金額
    final pendingFixedAllocation = _calculatePendingFixedAllocation(
      fixedExpenses,
      today,
    );
    final pendingSavingsAllocation = savingsGoals.fold(
      Decimal.zero,
      (sum, g) => sum + g.monthlyReserve,
    );
    final pendingAllocation = pendingFixedAllocation + pendingSavingsAllocation;

    // 第二層：攤提後可自由花用 = 即時可用 - 待攤提
    final afterAllocation = available - pendingAllocation;

    return BalanceResult(
      available: available,
      afterAllocation: afterAllocation,
      pendingAllocation: pendingAllocation,
    );
  }

  /// 計算固定支出本月待攤提金額
  ///
  /// 每筆固定支出的月攤提額 - 已預留額 = 本月還需存的
  static Decimal _calculatePendingFixedAllocation(
    List<FixedExpenseData> expenses,
    DateTime today,
  ) {
    return expenses.fold(Decimal.zero, (sum, expense) {
      final monthlyAmount = ReserveCalculator.calculateMonthlyAllocation(
        expense: expense,
        today: today,
      );
      // 本月尚需攤提 = 月攤提額 - 已預留
      final pending = monthlyAmount - expense.reservedAmount;
      // 若已預留超過月攤提額，待攤提為零（不回補）
      return sum + (pending > Decimal.zero ? pending : Decimal.zero);
    });
  }
}

/// 預留攤提計算引擎 — 根據週期計算每月應攤提金額
class ReserveCalculator {
  /// 根據週期和到期日計算每月應攤提金額
  ///
  /// [expense] 固定支出資料
  /// [today] 計算基準日期
  static Decimal calculateMonthlyAllocation({
    required FixedExpenseData expense,
    required DateTime today,
  }) {
    final months = _cycleToMonths(expense.cycle);
    if (months <= 0) return Decimal.zero;

    // 每月應攤提 = 總額 / 週期月數
    return (expense.amount / Decimal.fromInt(months)).toDecimal(
      scaleOnInfinitePrecision: 10,
    );
  }

  /// 計算所有固定支出本月還需預留的總金額
  ///
  /// [expenses] 固定支出清單
  /// [today] 計算基準日期
  static Decimal calculatePendingAllocation({
    required List<FixedExpenseData> expenses,
    required DateTime today,
  }) {
    return expenses.fold(Decimal.zero, (sum, expense) {
      final monthly = calculateMonthlyAllocation(
        expense: expense,
        today: today,
      );
      final pending = monthly - expense.reservedAmount;
      return sum + (pending > Decimal.zero ? pending : Decimal.zero);
    });
  }

  /// 計算所有固定支出已預留的總金額
  static Decimal calculateTotalReserved(List<FixedExpenseData> expenses) {
    return expenses.fold(
      Decimal.zero,
      (sum, e) => sum + e.reservedAmount,
    );
  }

  /// 將週期轉換為月數
  static int _cycleToMonths(String cycle) {
    switch (cycle) {
      case 'monthly':
        return 1;
      case 'bimonthly':
        return 2;
      case 'quarterly':
        return 3;
      case 'semi_annual':
        return 6;
      case 'annual':
        return 12;
      default:
        return 1;
    }
  }
}
