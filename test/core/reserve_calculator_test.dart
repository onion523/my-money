import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/balance_calculator.dart';

void main() {
  group('ReserveCalculator', () {
    final today = DateTime(2026, 3, 28);

    group('calculateMonthlyAllocation — 正常路徑', () {
      test('monthly 週期：月攤提等於全額', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '房租',
          amount: Decimal.parse('12000'),
          cycle: 'monthly',
          dueDate: DateTime(2026, 4, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        expect(result, equals(Decimal.parse('12000')));
      });

      test('bimonthly 週期：月攤提為半額', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '雙月繳費',
          amount: Decimal.parse('6000'),
          cycle: 'bimonthly',
          dueDate: DateTime(2026, 5, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        expect(result, equals(Decimal.parse('3000')));
      });

      test('quarterly 週期：月攤提為三分之一', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '季繳保險',
          amount: Decimal.parse('9000'),
          cycle: 'quarterly',
          dueDate: DateTime(2026, 6, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        expect(result, equals(Decimal.parse('3000')));
      });

      test('semi_annual 週期：月攤提為六分之一', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '半年費',
          amount: Decimal.parse('18000'),
          cycle: 'semi_annual',
          dueDate: DateTime(2026, 9, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        expect(result, equals(Decimal.parse('3000')));
      });

      test('annual 週期：月攤提為十二分之一', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '年繳保險',
          amount: Decimal.parse('36000'),
          cycle: 'annual',
          dueDate: DateTime(2027, 3, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        expect(result, equals(Decimal.parse('3000')));
      });
    });

    group('calculateMonthlyAllocation — Decimal 精度', () {
      test('無法整除的月攤提', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '季繳',
          amount: Decimal.parse('10000'),
          cycle: 'quarterly',
          dueDate: DateTime(2026, 6, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        // 10000 / 3 = 3333.3333333333
        expect(
          result,
          equals(Decimal.parse('3333.3333333333')),
        );
      });

      test('極小金額的月攤提', () {
        final expense = FixedExpenseData(
          id: '1',
          name: '小額',
          amount: Decimal.parse('0.01'),
          cycle: 'annual',
          dueDate: DateTime(2027, 1, 1),
          reservedAmount: Decimal.zero,
        );

        final result = ReserveCalculator.calculateMonthlyAllocation(
          expense: expense,
          today: today,
        );

        // 0.01 / 12
        expect(result > Decimal.zero, isTrue);
      });
    });

    group('calculatePendingAllocation — 正常路徑', () {
      test('多筆固定支出的待攤提總額', () {
        final expenses = [
          FixedExpenseData(
            id: '1',
            name: '房租',
            amount: Decimal.parse('12000'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('4000'),
          ),
          FixedExpenseData(
            id: '2',
            name: '保險',
            amount: Decimal.parse('36000'),
            cycle: 'annual',
            dueDate: DateTime(2027, 3, 1),
            reservedAmount: Decimal.parse('1000'),
          ),
        ];

        final result = ReserveCalculator.calculatePendingAllocation(
          expenses: expenses,
          today: today,
        );

        // 房租：12000 - 4000 = 8000
        // 保險：36000/12 - 1000 = 3000 - 1000 = 2000
        expect(result, equals(Decimal.parse('10000')));
      });
    });

    group('calculatePendingAllocation — 空輸入', () {
      test('無固定支出，待攤提為零', () {
        final result = ReserveCalculator.calculatePendingAllocation(
          expenses: [],
          today: today,
        );

        expect(result, equals(Decimal.zero));
      });
    });

    group('calculatePendingAllocation — 邊界值', () {
      test('已預留等於月攤提，待攤提為零', () {
        final expenses = [
          FixedExpenseData(
            id: '1',
            name: '費用',
            amount: Decimal.parse('12000'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('12000'),
          ),
        ];

        final result = ReserveCalculator.calculatePendingAllocation(
          expenses: expenses,
          today: today,
        );

        expect(result, equals(Decimal.zero));
      });

      test('已預留超過月攤提，待攤提為零（不回補）', () {
        final expenses = [
          FixedExpenseData(
            id: '1',
            name: '費用',
            amount: Decimal.parse('12000'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('15000'),
          ),
        ];

        final result = ReserveCalculator.calculatePendingAllocation(
          expenses: expenses,
          today: today,
        );

        expect(result, equals(Decimal.zero));
      });
    });

    group('calculateTotalReserved — 正常路徑', () {
      test('計算所有已預留總額', () {
        final expenses = [
          FixedExpenseData(
            id: '1',
            name: '房租',
            amount: Decimal.parse('12000'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('6000'),
          ),
          FixedExpenseData(
            id: '2',
            name: '保險',
            amount: Decimal.parse('36000'),
            cycle: 'annual',
            dueDate: DateTime(2027, 3, 1),
            reservedAmount: Decimal.parse('9000'),
          ),
        ];

        final result = ReserveCalculator.calculateTotalReserved(expenses);

        expect(result, equals(Decimal.parse('15000')));
      });
    });

    group('calculateTotalReserved — 空輸入', () {
      test('無固定支出，已預留為零', () {
        final result = ReserveCalculator.calculateTotalReserved([]);
        expect(result, equals(Decimal.zero));
      });
    });

    group('calculateTotalReserved — 負數', () {
      test('預留金額為負（異常資料），仍正確加總', () {
        final expenses = [
          FixedExpenseData(
            id: '1',
            name: '費用',
            amount: Decimal.parse('1000'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('-500'),
          ),
        ];

        final result = ReserveCalculator.calculateTotalReserved(expenses);

        expect(result, equals(Decimal.parse('-500')));
      });
    });

    group('calculateTotalReserved — Decimal 精度', () {
      test('小數金額加總精確', () {
        final expenses = [
          FixedExpenseData(
            id: '1',
            name: 'A',
            amount: Decimal.parse('100'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('33.33'),
          ),
          FixedExpenseData(
            id: '2',
            name: 'B',
            amount: Decimal.parse('200'),
            cycle: 'monthly',
            dueDate: DateTime(2026, 4, 1),
            reservedAmount: Decimal.parse('66.67'),
          ),
        ];

        final result = ReserveCalculator.calculateTotalReserved(expenses);

        expect(result, equals(Decimal.parse('100.00')));
      });
    });
  });
}
