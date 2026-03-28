import 'package:drift/drift.dart';

import '../database.dart';

/// 交易紀錄資料存取層 — 收支轉帳的 CRUD 操作
class TransactionRepository {
  final AppDatabase _db;

  TransactionRepository(this._db);

  /// 取得所有交易紀錄
  Future<List<Transaction>> getAll() =>
      _db.select(_db.transactions).get();

  /// 監聽所有交易紀錄變動
  Stream<List<Transaction>> watchAll() =>
      _db.select(_db.transactions).watch();

  /// 根據 ID 取得單一交易紀錄
  Future<Transaction?> getById(String id) =>
      (_db.select(_db.transactions)..where((t) => t.id.equals(id)))
          .getSingleOrNull();

  /// 根據類型篩選交易紀錄（income / expense / transfer）
  Future<List<Transaction>> getByType(String type) =>
      (_db.select(_db.transactions)..where((t) => t.type.equals(type))).get();

  /// 根據帳戶 ID 篩選交易紀錄
  Future<List<Transaction>> getByAccountId(String accountId) =>
      (_db.select(_db.transactions)
            ..where((t) => t.accountId.equals(accountId)))
          .get();

  /// 根據日期範圍篩選交易紀錄
  Future<List<Transaction>> getByDateRange(DateTime start, DateTime end) =>
      (_db.select(_db.transactions)
            ..where((t) =>
                t.date.isBiggerOrEqualValue(start) &
                t.date.isSmallerOrEqualValue(end)))
          .get();

  /// 新增交易紀錄
  Future<void> insert(TransactionsCompanion entry) =>
      _db.into(_db.transactions).insert(entry);

  /// 更新交易紀錄
  Future<bool> update(Transaction entry) =>
      _db.update(_db.transactions).replace(entry);

  /// 根據 ID 刪除交易紀錄
  Future<int> delete(String id) =>
      (_db.delete(_db.transactions)..where((t) => t.id.equals(id))).go();

  /// 刪除所有交易紀錄
  Future<int> deleteAll() => _db.delete(_db.transactions).go();
}
