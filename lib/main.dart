import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/data/repositories/account_repository.dart';
import 'package:my_money/data/repositories/fixed_expense_repository.dart';
import 'package:my_money/data/repositories/savings_goal_repository.dart';
import 'package:my_money/data/repositories/transaction_repository.dart';
import 'package:my_money/navigation/app_navigation.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

/// 建立資料庫連線 — 使用檔案型 SQLite
LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'my_money.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

/// 應用程式入口
/// 柔和水彩風格的個人財務管理 App
void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // 初始化資料庫
  final database = AppDatabase(_openConnection());

  // 建立所有 Repository
  final accountRepo = AccountRepository(database);
  final fixedExpenseRepo = FixedExpenseRepository(database);
  final savingsGoalRepo = SavingsGoalRepository(database);
  final transactionRepo = TransactionRepository(database);

  runApp(MyMoneyApp(
    accountRepository: accountRepo,
    fixedExpenseRepository: fixedExpenseRepo,
    savingsGoalRepository: savingsGoalRepo,
    transactionRepository: transactionRepo,
  ));
}

/// 根元件 — 套用主題並啟動底部導覽
class MyMoneyApp extends StatelessWidget {
  /// 帳戶 Repository
  final AccountRepository accountRepository;

  /// 固定支出 Repository
  final FixedExpenseRepository fixedExpenseRepository;

  /// 儲蓄目標 Repository
  final SavingsGoalRepository savingsGoalRepository;

  /// 交易紀錄 Repository
  final TransactionRepository transactionRepository;

  const MyMoneyApp({
    super.key,
    required this.accountRepository,
    required this.fixedExpenseRepository,
    required this.savingsGoalRepository,
    required this.transactionRepository,
  });

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        // 餘額 BLoC
        BlocProvider<BalanceBloc>(
          create: (context) => BalanceBloc(
            accountRepository: accountRepository,
            fixedExpenseRepository: fixedExpenseRepository,
            savingsGoalRepository: savingsGoalRepository,
          )..add(const LoadBalance()),
        ),

        // 帳戶 BLoC
        BlocProvider<AccountsBloc>(
          create: (context) => AccountsBloc(
            accountRepository: accountRepository,
          )..add(const LoadAccounts()),
        ),

        // 儲蓄目標 BLoC（依賴 BalanceBloc）
        BlocProvider<GoalsBloc>(
          create: (context) => GoalsBloc(
            savingsGoalRepository: savingsGoalRepository,
            balanceBloc: context.read<BalanceBloc>(),
          )..add(const LoadGoals()),
        ),

        // 花費 BLoC
        BlocProvider<ExpensesBloc>(
          create: (context) => ExpensesBloc(
            transactionRepository: transactionRepository,
          )..add(const LoadExpenses()),
        ),

        // 現金流 BLoC
        BlocProvider<CashflowBloc>(
          create: (context) => CashflowBloc(
            accountRepository: accountRepository,
            fixedExpenseRepository: fixedExpenseRepository,
            savingsGoalRepository: savingsGoalRepository,
          )..add(const LoadCashflow()),
        ),
      ],
      child: MaterialApp(
        title: '我的錢錢',
        debugShowCheckedModeBanner: false,

        // 亮色主題
        theme: AppTheme.lightTheme,

        // 暗色主題
        darkTheme: AppTheme.darkTheme,

        // 跟隨系統設定
        themeMode: ThemeMode.system,

        // 啟動時顯示底部導覽（首頁）
        home: const AppNavigation(),
      ),
    );
  }
}
