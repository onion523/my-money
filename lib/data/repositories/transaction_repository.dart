import 'package:drift/drift.dart';
import 'package:my_money/data/database.dart';

/// 交易紀錄資料存取層 — 封裝 drift 資料庫操作
class TransactionRepository {
  final AppDatabase _db;

  TransactionRepository(this._db);

  /// 取得所有交易紀錄（依日期降序）
  Future<List<Transaction>> getAllTransactions() {
    return (_db.select(_db.transactions)
          ..orderBy([
            (t) => OrderingTerm(
                  expression: t.date,
                  mode: OrderingMode.desc,
                ),
          ]))
        .get();
  }

  /// 監聽所有交易紀錄變更
  Stream<List<Transaction>> watchAllTransactions() {
    return (_db.select(_db.transactions)
          ..orderBy([
            (t) => OrderingTerm(
                  expression: t.date,
                  mode: OrderingMode.desc,
                ),
          ]))
        .watch();
  }

  /// 取得指定月份的交易紀錄
  Future<List<Transaction>> getTransactionsByMonth(int year, int month) async {
    final start = DateTime(year, month, 1);
    final end = DateTime(year, month + 1, 1);
    return (_db.select(_db.transactions)
          ..where((t) =>
              t.date.isBiggerOrEqualValue(start) &
              t.date.isSmallerThanValue(end))
          ..orderBy([
            (t) => OrderingTerm(
                  expression: t.date,
                  mode: OrderingMode.desc,
                ),
          ]))
        .get();
  }

  /// 取得指定分類的交易紀錄
  Future<List<Transaction>> getTransactionsByCategory(String category) {
    return (_db.select(_db.transactions)
          ..where((t) => t.category.equals(category))
          ..orderBy([
            (t) => OrderingTerm(
                  expression: t.date,
                  mode: OrderingMode.desc,
                ),
          ]))
        .get();
  }

  /// 新增交易紀錄
  Future<void> addTransaction(TransactionsCompanion entry) {
    return _db.into(_db.transactions).insert(entry);
  }

  /// 刪除交易紀錄
  Future<void> deleteTransaction(String id) {
    return (_db.delete(_db.transactions)..where((t) => t.id.equals(id))).go();
  }
}
