import 'package:drift/drift.dart';

import '../database.dart';

/// 固定支出資料存取層 — 定期扣款項目的 CRUD 操作
class FixedExpenseRepository {
  final AppDatabase _db;

  FixedExpenseRepository(this._db);

  /// 取得所有固定支出
  Future<List<FixedExpense>> getAll() =>
      _db.select(_db.fixedExpenses).get();

  /// 監聽所有固定支出變動
  Stream<List<FixedExpense>> watchAll() =>
      _db.select(_db.fixedExpenses).watch();

  /// 根據 ID 取得單一固定支出
  Future<FixedExpense?> getById(String id) =>
      (_db.select(_db.fixedExpenses)..where((t) => t.id.equals(id)))
          .getSingleOrNull();

  /// 根據週期篩選固定支出
  Future<List<FixedExpense>> getByCycle(String cycle) =>
      (_db.select(_db.fixedExpenses)..where((t) => t.cycle.equals(cycle)))
          .get();

  /// 新增固定支出
  Future<void> insert(FixedExpensesCompanion entry) =>
      _db.into(_db.fixedExpenses).insert(entry);

  /// 更新固定支出
  Future<bool> update(FixedExpense entry) =>
      _db.update(_db.fixedExpenses).replace(entry);

  /// 根據 ID 刪除固定支出
  Future<int> delete(String id) =>
      (_db.delete(_db.fixedExpenses)..where((t) => t.id.equals(id))).go();

  /// 刪除所有固定支出
  Future<int> deleteAll() => _db.delete(_db.fixedExpenses).go();
}
