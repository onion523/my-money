import 'package:drift/drift.dart';
import 'package:my_money/data/database.dart';

/// 儲蓄目標資料存取層 — 封裝 drift 資料庫操作
class SavingsGoalRepository {
  final AppDatabase _db;

  SavingsGoalRepository(this._db);

  /// 取得所有儲蓄目標
  Future<List<SavingsGoal>> getAllGoals() {
    return _db.select(_db.savingsGoals).get();
  }

  /// 監聯所有儲蓄目標變更
  Stream<List<SavingsGoal>> watchAllGoals() {
    return _db.select(_db.savingsGoals).watch();
  }

  /// 新增儲蓄目標
  Future<void> addGoal(SavingsGoalsCompanion entry) {
    return _db.into(_db.savingsGoals).insert(entry);
  }

  /// 更新儲蓄目標
  Future<void> updateGoal(SavingsGoal goal) {
    return (_db.update(_db.savingsGoals)
          ..where((t) => t.id.equals(goal.id)))
        .write(
      SavingsGoalsCompanion(
        name: Value(goal.name),
        targetAmount: Value(goal.targetAmount),
        currentAmount: Value(goal.currentAmount),
        category: Value(goal.category),
        deadline: Value(goal.deadline),
        monthlyReserve: Value(goal.monthlyReserve),
        emoji: Value(goal.emoji),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  /// 存入金額到儲蓄目標
  Future<void> depositToGoal(String goalId, String newCurrentAmount) {
    return (_db.update(_db.savingsGoals)
          ..where((t) => t.id.equals(goalId)))
        .write(
      SavingsGoalsCompanion(
        currentAmount: Value(newCurrentAmount),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  /// 刪除儲蓄目標
  Future<void> deleteGoal(String id) {
    return (_db.delete(_db.savingsGoals)..where((t) => t.id.equals(id))).go();
  }
}
