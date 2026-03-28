import 'package:decimal/decimal.dart';

/// 支援的幣別
enum Currency {
  /// 新台幣
  twd,

  /// 日圓
  jpy,

  /// 泰銖
  thb,

  /// 美元
  usd,

  /// 歐元
  eur,
}

/// 幣別工具 — 將 enum 轉為代碼字串
extension CurrencyExtension on Currency {
  /// 幣別代碼（大寫）
  String get code {
    switch (this) {
      case Currency.twd:
        return 'TWD';
      case Currency.jpy:
        return 'JPY';
      case Currency.thb:
        return 'THB';
      case Currency.usd:
        return 'USD';
      case Currency.eur:
        return 'EUR';
    }
  }

  /// 幣別中文名稱
  String get displayName {
    switch (this) {
      case Currency.twd:
        return '新台幣';
      case Currency.jpy:
        return '日圓';
      case Currency.thb:
        return '泰銖';
      case Currency.usd:
        return '美元';
      case Currency.eur:
        return '歐元';
    }
  }
}

/// 匯率快取項目
class _CacheEntry {
  final Map<String, Decimal> rates;
  final DateTime fetchedAt;

  _CacheEntry({required this.rates, required this.fetchedAt});

  /// 是否在有效期內（24 小時）
  bool isValid(DateTime now) {
    return now.difference(fetchedAt).inHours < 24;
  }
}

/// 多幣別轉換引擎 — 使用 Decimal 精確運算
///
/// 支援 TWD, JPY, THB, USD, EUR
/// 快取邏輯：24 小時內有效
class CurrencyConverter {
  /// 匯率快取（以基礎幣別為 key）
  final Map<String, _CacheEntry> _cache = {};

  /// 幣別轉換
  ///
  /// [amount] 原始金額
  /// [from] 來源幣別
  /// [to] 目標幣別
  /// [rate] 匯率（from → to）
  ///
  /// 相同幣別 → 回傳原值
  /// 匯率為零 → 拋出 ArgumentError
  static Decimal convert({
    required Decimal amount,
    required Currency from,
    required Currency to,
    required Decimal rate,
  }) {
    // 相同幣別 → 直接回傳原值
    if (from == to) return amount;

    // 匯率為零 → 無法轉換
    if (rate == Decimal.zero) {
      throw ArgumentError('匯率不可為零');
    }

    // 精確計算：金額 × 匯率
    return amount * rate;
  }

  /// 從匯率 API 取得匯率
  ///
  /// [baseCurrency] 基礎幣別
  ///
  /// 目前使用 mock 資料，正式環境改接免費匯率 API
  /// 快取 24 小時內有效，不重複請求
  Future<Map<String, Decimal>> fetchRates(Currency baseCurrency) async {
    final cacheKey = baseCurrency.code;
    final now = DateTime.now();

    // 檢查快取是否有效
    if (_cache.containsKey(cacheKey) && _cache[cacheKey]!.isValid(now)) {
      return _cache[cacheKey]!.rates;
    }

    // TODO: 正式環境改接免費匯率 API（如 exchangerate.host）
    final rates = _getMockRates(baseCurrency);

    // 存入快取
    _cache[cacheKey] = _CacheEntry(rates: rates, fetchedAt: now);

    return rates;
  }

  /// 清除快取
  void clearCache() => _cache.clear();

  /// 檢查快取是否有效
  bool isCacheValid(Currency baseCurrency) {
    final cacheKey = baseCurrency.code;
    if (!_cache.containsKey(cacheKey)) return false;
    return _cache[cacheKey]!.isValid(DateTime.now());
  }

  /// Mock 匯率資料（以 TWD 為基礎計算）
  ///
  /// 參考匯率（概略值）：
  /// 1 TWD ≈ 4.54 JPY
  /// 1 TWD ≈ 1.10 THB
  /// 1 TWD ≈ 0.031 USD
  /// 1 TWD ≈ 0.029 EUR
  static Map<String, Decimal> _getMockRates(Currency base) {
    // 以 TWD 為中間值的匯率表
    final twdRates = {
      'TWD': Decimal.one,
      'JPY': Decimal.parse('4.54'),
      'THB': Decimal.parse('1.10'),
      'USD': Decimal.parse('0.031'),
      'EUR': Decimal.parse('0.029'),
    };

    if (base == Currency.twd) return twdRates;

    // 以其他幣別為基礎，透過 TWD 交叉換算
    final baseToTwd = twdRates[base.code]!;
    final rates = <String, Decimal>{};

    for (final entry in twdRates.entries) {
      if (entry.key == base.code) {
        rates[entry.key] = Decimal.one;
      } else {
        // 目標幣別相對於基礎幣別的匯率
        rates[entry.key] = (entry.value / baseToTwd).toDecimal(
          scaleOnInfinitePrecision: 10,
        );
      }
    }

    return rates;
  }
}
