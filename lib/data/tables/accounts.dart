import 'package:drift/drift.dart';

/// 帳戶資料表 — 銀行帳戶與信用卡
class Accounts extends Table {
  /// 唯一識別碼（UUID）
  TextColumn get id => text()();

  /// 帳戶名稱
  TextColumn get name => text()();

  /// 帳戶類型：bank（銀行）或 credit_card（信用卡）
  TextColumn get type => text()();

  /// 餘額（Decimal 字串）
  TextColumn get balance => text()();

  /// 信用卡帳單結帳日（日期中的天數，僅信用卡適用）
  IntColumn get billingDate => integer().nullable()();

  /// 信用卡繳款截止日（日期中的天數，僅信用卡適用）
  IntColumn get paymentDate => integer().nullable()();

  /// 已出帳金額（Decimal 字串，僅信用卡適用）
  TextColumn get billedAmount => text().nullable()();

  /// 未出帳金額（Decimal 字串，僅信用卡適用）
  TextColumn get unbilledAmount => text().nullable()();

  /// 建立時間
  DateTimeColumn get createdAt => dateTime()();

  /// 更新時間
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
