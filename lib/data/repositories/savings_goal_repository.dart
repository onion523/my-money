import 'package:drift/drift.dart';

import '../database.dart';

/// 儲蓄目標資料存取層 — 存錢計畫的 CRUD 操作
class SavingsGoalRepository {
  final AppDatabase _db;

  SavingsGoalRepository(this._db);

  /// 取得所有儲蓄目標
  Future<List<SavingsGoal>> getAll() =>
      _db.select(_db.savingsGoals).get();

  /// 監聽所有儲蓄目標變動
  Stream<List<SavingsGoal>> watchAll() =>
      _db.select(_db.savingsGoals).watch();

  /// 根據 ID 取得單一儲蓄目標
  Future<SavingsGoal?> getById(String id) =>
      (_db.select(_db.savingsGoals)..where((t) => t.id.equals(id)))
          .getSingleOrNull();

  /// 根據分類篩選儲蓄目標
  Future<List<SavingsGoal>> getByCategory(String category) =>
      (_db.select(_db.savingsGoals)
            ..where((t) => t.category.equals(category)))
          .get();

  /// 新增儲蓄目標
  Future<void> insert(SavingsGoalsCompanion entry) =>
      _db.into(_db.savingsGoals).insert(entry);

  /// 更新儲蓄目標
  Future<bool> update(SavingsGoal entry) =>
      _db.update(_db.savingsGoals).replace(entry);

  /// 根據 ID 刪除儲蓄目標
  Future<int> delete(String id) =>
      (_db.delete(_db.savingsGoals)..where((t) => t.id.equals(id))).go();

  /// 刪除所有儲蓄目標
  Future<int> deleteAll() => _db.delete(_db.savingsGoals).go();
}
