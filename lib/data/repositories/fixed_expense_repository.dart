import 'package:my_money/data/database.dart';

/// 固定支出資料存取層 — 封裝 drift 資料庫操作
class FixedExpenseRepository {
  final AppDatabase _db;

  FixedExpenseRepository(this._db);

  /// 取得所有固定支出
  Future<List<FixedExpense>> getAllFixedExpenses() {
    return _db.select(_db.fixedExpenses).get();
  }

  /// 監聽所有固定支出變更
  Stream<List<FixedExpense>> watchAllFixedExpenses() {
    return _db.select(_db.fixedExpenses).watch();
  }
}
