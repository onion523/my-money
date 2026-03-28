import 'package:decimal/decimal.dart';
import 'package:equatable/equatable.dart';

/// 現金流事件 — 某一天會發生的金額變動
class CashflowEvent {
  /// 事件發生日期
  final DateTime date;

  /// 事件描述
  final String description;

  /// 金額變動（正值為收入，負值為支出）
  final Decimal delta;

  const CashflowEvent({
    required this.date,
    required this.description,
    required this.delta,
  });
}

/// 現金流模擬結果中的單一時間點
class CashflowPoint extends Equatable {
  /// 日期
  final DateTime date;

  /// 描述
  final String description;

  /// 當日金額變動
  final Decimal delta;

  /// 當日結束餘額
  final Decimal balance;

  /// 餘額是否安全（大於零）
  final bool isSafe;

  const CashflowPoint({
    required this.date,
    required this.description,
    required this.delta,
    required this.balance,
    required this.isSafe,
  });

  @override
  List<Object?> get props => [date, description, delta, balance, isSafe];
}

/// 現金流預測引擎 — 逐日模擬未來現金流變化
class CashflowForecast {
  /// 從指定日期開始逐日模擬現金流
  ///
  /// [bankBalance] 起始銀行餘額
  /// [events] 未來現金流事件清單
  /// [days] 模擬天數
  ///
  /// 回傳每天的 [CashflowPoint]，第一筆為起始餘額
  static List<CashflowPoint> simulate({
    required Decimal bankBalance,
    required List<CashflowEvent> events,
    required int days,
  }) {
    if (days <= 0) return [];

    final today = DateTime.now();
    final startDate = DateTime(today.year, today.month, today.day);

    // 依日期分組事件
    final eventsByDate = <int, List<CashflowEvent>>{};
    for (final event in events) {
      final normalizedDate = DateTime(
        event.date.year,
        event.date.month,
        event.date.day,
      );
      final dayOffset = normalizedDate.difference(startDate).inDays;
      if (dayOffset >= 0 && dayOffset < days) {
        eventsByDate.putIfAbsent(dayOffset, () => []).add(event);
      }
    }

    final results = <CashflowPoint>[];
    var currentBalance = bankBalance;

    for (var i = 0; i < days; i++) {
      final currentDate = startDate.add(Duration(days: i));
      final dayEvents = eventsByDate[i];

      if (dayEvents != null && dayEvents.isNotEmpty) {
        // 該日有事件：每個事件產生一筆 CashflowPoint
        for (final event in dayEvents) {
          currentBalance += event.delta;
          results.add(CashflowPoint(
            date: currentDate,
            description: event.description,
            delta: event.delta,
            balance: currentBalance,
            isSafe: currentBalance >= Decimal.zero,
          ));
        }
      } else {
        // 該日無事件：記錄餘額不變
        results.add(CashflowPoint(
          date: currentDate,
          description: '無變動',
          delta: Decimal.zero,
          balance: currentBalance,
          isSafe: currentBalance >= Decimal.zero,
        ));
      }
    }

    return results;
  }

  /// 以自訂起始日期模擬（用於測試）
  static List<CashflowPoint> simulateFrom({
    required Decimal bankBalance,
    required List<CashflowEvent> events,
    required int days,
    required DateTime startDate,
  }) {
    if (days <= 0) return [];

    final normalizedStart = DateTime(
      startDate.year,
      startDate.month,
      startDate.day,
    );

    // 依日期分組事件
    final eventsByDate = <int, List<CashflowEvent>>{};
    for (final event in events) {
      final normalizedDate = DateTime(
        event.date.year,
        event.date.month,
        event.date.day,
      );
      final dayOffset = normalizedDate.difference(normalizedStart).inDays;
      if (dayOffset >= 0 && dayOffset < days) {
        eventsByDate.putIfAbsent(dayOffset, () => []).add(event);
      }
    }

    final results = <CashflowPoint>[];
    var currentBalance = bankBalance;

    for (var i = 0; i < days; i++) {
      final currentDate = normalizedStart.add(Duration(days: i));
      final dayEvents = eventsByDate[i];

      if (dayEvents != null && dayEvents.isNotEmpty) {
        for (final event in dayEvents) {
          currentBalance += event.delta;
          results.add(CashflowPoint(
            date: currentDate,
            description: event.description,
            delta: event.delta,
            balance: currentBalance,
            isSafe: currentBalance >= Decimal.zero,
          ));
        }
      } else {
        results.add(CashflowPoint(
          date: currentDate,
          description: '無變動',
          delta: Decimal.zero,
          balance: currentBalance,
          isSafe: currentBalance >= Decimal.zero,
        ));
      }
    }

    return results;
  }
}
