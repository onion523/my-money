import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/balance_calculator.dart';

void main() {
  group('BalanceCalculator', () {
    final today = DateTime(2026, 3, 28);

    group('calculateAvailableBalance — 正常路徑', () {
      test('單一銀行帳戶無其他負擔，可用餘額等於銀行餘額', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '台幣帳戶',
            type: 'bank',
            balance: Decimal.parse('50000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        expect(result.available, equals(Decimal.parse('50000')));
      });

      test('銀行餘額扣除信用卡已出帳和未出帳', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '台幣帳戶',
            type: 'bank',
            balance: Decimal.parse('100000'),
          ),
          AccountData(
            id: '2',
            name: '信用卡A',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('15000'),
            unbilledAmount: Decimal.parse('5000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        // 100000 - 15000 - 5000 = 80000
        expect(result.available, equals(Decimal.parse('80000')));
      });

      test('完整情境：銀行 - 信用卡 - 固定支出預留 - 儲蓄', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '台幣帳戶',
            type: 'bank',
            balance: Decimal.parse('200000'),
          ),
          AccountData(
            id: '2',
            name: '信用卡',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('20000'),
            unbilledAmount: Decimal.parse('8000'),
          ),
        ];

        final fixedExpenses = [
          FixedExpenseData(
            id: '1',
            name: '房租',
            amount: Decimal.parse('12000'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('6000'),
          ),
        ];

        final savingsGoals = [
          SavingsGoalData(
            id: '1',
            name: '旅遊基金',
            targetAmount: Decimal.parse('60000'),
            currentAmount: Decimal.parse('10000'),
            monthlyReserve: Decimal.parse('5000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: fixedExpenses,
          savingsGoals: savingsGoals,
          today: today,
        );

        // 第一層：200000 - 20000 - 8000 - 6000 - 10000 = 156000
        expect(result.available, equals(Decimal.parse('156000')));

        // 待攤提：房租月攤提 12000 - 已預留 6000 = 6000，儲蓄 5000 => 共 11000
        expect(result.pendingAllocation, equals(Decimal.parse('11000')));

        // 第二層：156000 - 11000 = 145000
        expect(result.afterAllocation, equals(Decimal.parse('145000')));
      });

      test('多個銀行帳戶和多張信用卡', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶A',
            type: 'bank',
            balance: Decimal.parse('80000'),
          ),
          AccountData(
            id: '2',
            name: '帳戶B',
            type: 'bank',
            balance: Decimal.parse('30000'),
          ),
          AccountData(
            id: '3',
            name: '卡A',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('10000'),
            unbilledAmount: Decimal.parse('3000'),
          ),
          AccountData(
            id: '4',
            name: '卡B',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('5000'),
            unbilledAmount: Decimal.parse('2000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        // (80000 + 30000) - (10000 + 5000) - (3000 + 2000) = 90000
        expect(result.available, equals(Decimal.parse('90000')));
      });
    });

    group('calculateAvailableBalance — 空輸入', () {
      test('無帳戶、無支出、無目標', () {
        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: [],
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        expect(result.available, equals(Decimal.zero));
        expect(result.afterAllocation, equals(Decimal.zero));
        expect(result.pendingAllocation, equals(Decimal.zero));
      });

      test('有帳戶但無信用卡、支出、目標', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('50000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        expect(result.available, equals(Decimal.parse('50000')));
        expect(result.pendingAllocation, equals(Decimal.zero));
        expect(result.afterAllocation, equals(Decimal.parse('50000')));
      });
    });

    group('calculateAvailableBalance — 邊界值', () {
      test('餘額剛好等於所有扣除額', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('10000'),
          ),
          AccountData(
            id: '2',
            name: '卡',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('5000'),
            unbilledAmount: Decimal.parse('5000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        expect(result.available, equals(Decimal.zero));
      });

      test('信用卡無已出帳和未出帳金額（null）', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('50000'),
          ),
          AccountData(
            id: '2',
            name: '卡',
            type: 'credit_card',
            balance: Decimal.parse('0'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        // null 值視為 0
        expect(result.available, equals(Decimal.parse('50000')));
      });

      test('固定支出已預留超過月攤提額，待攤提為零', () {
        final fixedExpenses = [
          FixedExpenseData(
            id: '1',
            name: '保險',
            amount: Decimal.parse('12000'),
            cycle: 'annual',
            dueDate: DateTime(2027, 1, 1),
            reservedAmount: Decimal.parse('2000'), // 月攤提 1000，已超額預留
          ),
        ];

        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('50000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: fixedExpenses,
          savingsGoals: [],
          today: today,
        );

        // 已預留 2000，月攤提 1000，待攤提 = 0（不回補）
        expect(result.pendingAllocation, equals(Decimal.zero));
      });
    });

    group('calculateAvailableBalance — 負數情境', () {
      test('銀行餘額不足以覆蓋信用卡，可用餘額為負', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('5000'),
          ),
          AccountData(
            id: '2',
            name: '卡',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('8000'),
            unbilledAmount: Decimal.parse('2000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        // 5000 - 8000 - 2000 = -5000
        expect(result.available, equals(Decimal.parse('-5000')));
      });

      test('銀行帳戶為負餘額（透支）', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('-1000'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        expect(result.available, equals(Decimal.parse('-1000')));
      });
    });

    group('calculateAvailableBalance — Decimal 精度', () {
      test('小數點精確運算', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('100000.50'),
          ),
          AccountData(
            id: '2',
            name: '卡',
            type: 'credit_card',
            balance: Decimal.parse('0'),
            billedAmount: Decimal.parse('33333.17'),
            unbilledAmount: Decimal.parse('16666.83'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        // 100000.50 - 33333.17 - 16666.83 = 50000.50
        expect(result.available, equals(Decimal.parse('50000.50')));
      });

      test('極小金額精度', () {
        final accounts = [
          AccountData(
            id: '1',
            name: '帳戶',
            type: 'bank',
            balance: Decimal.parse('0.01'),
          ),
        ];

        final result = BalanceCalculator.calculateAvailableBalance(
          accounts: accounts,
          fixedExpenses: [],
          savingsGoals: [],
          today: today,
        );

        expect(result.available, equals(Decimal.parse('0.01')));
      });
    });
  });

  group('BalanceResult', () {
    test('Equatable 相等比較', () {
      final a = BalanceResult(
        available: Decimal.parse('1000'),
        afterAllocation: Decimal.parse('500'),
        pendingAllocation: Decimal.parse('500'),
      );
      final b = BalanceResult(
        available: Decimal.parse('1000'),
        afterAllocation: Decimal.parse('500'),
        pendingAllocation: Decimal.parse('500'),
      );

      expect(a, equals(b));
    });

    test('Equatable 不相等比較', () {
      final a = BalanceResult(
        available: Decimal.parse('1000'),
        afterAllocation: Decimal.parse('500'),
        pendingAllocation: Decimal.parse('500'),
      );
      final b = BalanceResult(
        available: Decimal.parse('2000'),
        afterAllocation: Decimal.parse('500'),
        pendingAllocation: Decimal.parse('500'),
      );

      expect(a, isNot(equals(b)));
    });
  });
}
