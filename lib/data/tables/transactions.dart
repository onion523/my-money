import 'package:drift/drift.dart';

/// 交易紀錄資料表 — 收入、支出、轉帳
class Transactions extends Table {
  /// 唯一識別碼（UUID）
  TextColumn get id => text()();

  /// 交易類型：income（收入）/ expense（支出）/ transfer（轉帳）
  TextColumn get type => text()();

  /// 金額（Decimal 字串）
  TextColumn get amount => text()();

  /// 交易日期
  DateTimeColumn get date => dateTime()();

  /// 備註
  TextColumn get note => text()();

  /// 分類
  TextColumn get category => text()();

  /// 關聯帳戶 ID（可為空）
  TextColumn get accountId => text().nullable()();

  /// 建立時間
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
