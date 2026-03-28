import 'package:drift/drift.dart';
import 'package:my_money/data/database.dart';

/// 帳戶資料存取層 — 封裝 drift 資料庫操作
class AccountRepository {
  final AppDatabase _db;

  AccountRepository(this._db);

  /// 取得所有帳戶
  Future<List<Account>> getAllAccounts() {
    return _db.select(_db.accounts).get();
  }

  /// 監聽所有帳戶變更
  Stream<List<Account>> watchAllAccounts() {
    return _db.select(_db.accounts).watch();
  }

  /// 新增帳戶
  Future<void> addAccount(AccountsCompanion entry) {
    return _db.into(_db.accounts).insert(entry);
  }

  /// 更新帳戶
  Future<void> updateAccount(Account account) {
    return (_db.update(_db.accounts)
          ..where((t) => t.id.equals(account.id)))
        .write(
      AccountsCompanion(
        name: Value(account.name),
        type: Value(account.type),
        balance: Value(account.balance),
        billingDate: Value(account.billingDate),
        paymentDate: Value(account.paymentDate),
        billedAmount: Value(account.billedAmount),
        unbilledAmount: Value(account.unbilledAmount),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  /// 刪除帳戶
  Future<void> deleteAccount(String id) {
    return (_db.delete(_db.accounts)..where((t) => t.id.equals(id))).go();
  }
}
