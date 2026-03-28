import 'package:drift/drift.dart';

/// 固定支出資料表 — 定期扣款項目
class FixedExpenses extends Table {
  /// 唯一識別碼（UUID）
  TextColumn get id => text()();

  /// 支出名稱
  TextColumn get name => text()();

  /// 金額（Decimal 字串）
  TextColumn get amount => text()();

  /// 週期：monthly / bimonthly / quarterly / semi_annual / annual
  TextColumn get cycle => text()();

  /// 到期日
  DateTimeColumn get dueDate => dateTime()();

  /// 付款方式（關聯帳戶名稱或描述）
  TextColumn get paymentMethod => text()();

  /// 已預留金額（Decimal 字串）
  TextColumn get reservedAmount => text()();

  /// 建立時間
  DateTimeColumn get createdAt => dateTime()();

  /// 更新時間
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
