import 'package:drift/drift.dart';

/// 儲蓄目標資料表 — 存錢計畫與進度
class SavingsGoals extends Table {
  /// 唯一識別碼（UUID）
  TextColumn get id => text()();

  /// 目標名稱
  TextColumn get name => text()();

  /// 目標金額（Decimal 字串）
  TextColumn get targetAmount => text()();

  /// 目前已存金額（Decimal 字串）
  TextColumn get currentAmount => text()();

  /// 分類
  TextColumn get category => text()();

  /// 目標期限（可為空）
  DateTimeColumn get deadline => dateTime().nullable()();

  /// 每月預留金額（Decimal 字串）
  TextColumn get monthlyReserve => text()();

  /// 表情符號（用於顯示）
  TextColumn get emoji => text()();

  /// 建立時間
  DateTimeColumn get createdAt => dateTime()();

  /// 更新時間
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
