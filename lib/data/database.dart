import 'package:drift/drift.dart';

import 'tables/accounts.dart';
import 'tables/fixed_expenses.dart';
import 'tables/savings_goals.dart';
import 'tables/transactions.dart';

part 'database.g.dart';

/// 應用程式主資料庫 — 使用 drift 管理 SQLite
@DriftDatabase(tables: [Accounts, FixedExpenses, SavingsGoals, Transactions])
class AppDatabase extends _$AppDatabase {
  AppDatabase(QueryExecutor e) : super(e);

  @override
  int get schemaVersion => 1;
}
