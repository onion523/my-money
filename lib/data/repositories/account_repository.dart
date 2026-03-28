import 'package:drift/drift.dart';

import '../database.dart';

/// 帳戶資料存取層 — 銀行帳戶與信用卡的 CRUD 操作
class AccountRepository {
  final AppDatabase _db;

  AccountRepository(this._db);

  /// 取得所有帳戶
  Future<List<Account>> getAll() => _db.select(_db.accounts).get();

  /// 監聽所有帳戶變動
  Stream<List<Account>> watchAll() => _db.select(_db.accounts).watch();

  /// 根據 ID 取得單一帳戶
  Future<Account?> getById(String id) =>
      (_db.select(_db.accounts)..where((t) => t.id.equals(id)))
          .getSingleOrNull();

  /// 根據類型篩選帳戶（bank 或 credit_card）
  Future<List<Account>> getByType(String type) =>
      (_db.select(_db.accounts)..where((t) => t.type.equals(type))).get();

  /// 新增帳戶
  Future<void> insert(AccountsCompanion entry) =>
      _db.into(_db.accounts).insert(entry);

  /// 更新帳戶
  Future<bool> update(Account entry) =>
      _db.update(_db.accounts).replace(entry);

  /// 根據 ID 刪除帳戶
  Future<int> delete(String id) =>
      (_db.delete(_db.accounts)..where((t) => t.id.equals(id))).go();

  /// 刪除所有帳戶
  Future<int> deleteAll() => _db.delete(_db.accounts).go();
}
