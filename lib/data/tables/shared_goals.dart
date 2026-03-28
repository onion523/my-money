import 'package:drift/drift.dart';

/// 共同儲蓄目標成員資料表 — 多人共同儲蓄的成員與貢獻紀錄
class SharedGoalMembers extends Table {
  /// 唯一識別碼（UUID）
  TextColumn get id => text()();

  /// 關聯的儲蓄目標 ID
  TextColumn get goalId => text()();

  /// 使用者 ID
  TextColumn get userId => text()();

  /// 使用者名稱
  TextColumn get userName => text()();

  /// 已貢獻金額（Decimal 字串）
  TextColumn get contributedAmount => text()();

  /// 加入時間
  DateTimeColumn get joinedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
