import 'package:decimal/decimal.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/core/currency_converter.dart';

void main() {
  group('CurrencyConverter', () {
    group('convert — 正常轉換', () {
      test('TWD → JPY 正常轉換', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('1000'),
          from: Currency.twd,
          to: Currency.jpy,
          rate: Decimal.parse('4.54'),
        );

        // 1000 * 4.54 = 4540
        expect(result, equals(Decimal.parse('4540')));
      });

      test('TWD → USD 正常轉換', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('32000'),
          from: Currency.twd,
          to: Currency.usd,
          rate: Decimal.parse('0.031'),
        );

        // 32000 * 0.031 = 992
        expect(result, equals(Decimal.parse('992')));
      });

      test('USD → TWD 正常轉換', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('100'),
          from: Currency.usd,
          to: Currency.twd,
          rate: Decimal.parse('32.26'),
        );

        // 100 * 32.26 = 3226
        expect(result, equals(Decimal.parse('3226')));
      });

      test('JPY → THB 正常轉換', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('10000'),
          from: Currency.jpy,
          to: Currency.thb,
          rate: Decimal.parse('0.242'),
        );

        // 10000 * 0.242 = 2420
        expect(result, equals(Decimal.parse('2420')));
      });
    });

    group('convert — 相同幣別', () {
      test('相同幣別 → 回傳原值', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('5000'),
          from: Currency.twd,
          to: Currency.twd,
          rate: Decimal.parse('1'),
        );

        expect(result, equals(Decimal.parse('5000')));
      });

      test('相同幣別（JPY → JPY）→ 回傳原值，忽略匯率', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('10000'),
          from: Currency.jpy,
          to: Currency.jpy,
          rate: Decimal.parse('999'), // 匯率不影響結果
        );

        expect(result, equals(Decimal.parse('10000')));
      });
    });

    group('convert — Decimal 精度', () {
      test('小數精確運算不丟失精度', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('1234.56'),
          from: Currency.twd,
          to: Currency.usd,
          rate: Decimal.parse('0.031'),
        );

        // 1234.56 * 0.031 = 38.27136
        expect(result, equals(Decimal.parse('38.27136')));
      });

      test('極小金額轉換保持精度', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('0.01'),
          from: Currency.usd,
          to: Currency.twd,
          rate: Decimal.parse('32.26'),
        );

        // 0.01 * 32.26 = 0.3226
        expect(result, equals(Decimal.parse('0.3226')));
      });

      test('大金額轉換保持精度', () {
        final result = CurrencyConverter.convert(
          amount: Decimal.parse('999999999'),
          from: Currency.twd,
          to: Currency.jpy,
          rate: Decimal.parse('4.54'),
        );

        // 999999999 * 4.54 = 4539999995.46
        expect(result, equals(Decimal.parse('4539999995.46')));
      });
    });

    group('convert — 匯率為零', () {
      test('匯率 = 0 → 拋出 ArgumentError', () {
        expect(
          () => CurrencyConverter.convert(
            amount: Decimal.parse('1000'),
            from: Currency.twd,
            to: Currency.jpy,
            rate: Decimal.zero,
          ),
          throwsA(isA<ArgumentError>()),
        );
      });
    });

    group('fetchRates — 快取邏輯', () {
      test('第一次呼叫取得匯率資料', () async {
        final converter = CurrencyConverter();
        final rates = await converter.fetchRates(Currency.twd);

        expect(rates, isNotEmpty);
        expect(rates.containsKey('JPY'), isTrue);
        expect(rates.containsKey('THB'), isTrue);
        expect(rates.containsKey('USD'), isTrue);
        expect(rates.containsKey('EUR'), isTrue);
        expect(rates['TWD'], equals(Decimal.one));
      });

      test('快取有效時不重新取得', () async {
        final converter = CurrencyConverter();

        // 第一次取得
        await converter.fetchRates(Currency.twd);
        expect(converter.isCacheValid(Currency.twd), isTrue);

        // 第二次應該使用快取
        final rates = await converter.fetchRates(Currency.twd);
        expect(rates, isNotEmpty);
      });

      test('清除快取後需重新取得', () async {
        final converter = CurrencyConverter();

        await converter.fetchRates(Currency.twd);
        expect(converter.isCacheValid(Currency.twd), isTrue);

        converter.clearCache();
        expect(converter.isCacheValid(Currency.twd), isFalse);
      });

      test('不同基礎幣別有各自的快取', () async {
        final converter = CurrencyConverter();

        await converter.fetchRates(Currency.twd);
        await converter.fetchRates(Currency.usd);

        expect(converter.isCacheValid(Currency.twd), isTrue);
        expect(converter.isCacheValid(Currency.usd), isTrue);
        expect(converter.isCacheValid(Currency.jpy), isFalse);
      });
    });

    group('Currency extension', () {
      test('幣別代碼正確', () {
        expect(Currency.twd.code, equals('TWD'));
        expect(Currency.jpy.code, equals('JPY'));
        expect(Currency.thb.code, equals('THB'));
        expect(Currency.usd.code, equals('USD'));
        expect(Currency.eur.code, equals('EUR'));
      });

      test('幣別中文名稱正確', () {
        expect(Currency.twd.displayName, equals('新台幣'));
        expect(Currency.jpy.displayName, equals('日圓'));
        expect(Currency.thb.displayName, equals('泰銖'));
        expect(Currency.usd.displayName, equals('美元'));
        expect(Currency.eur.displayName, equals('歐元'));
      });
    });
  });
}
