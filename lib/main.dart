import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/data/database.dart';
import 'package:my_money/data/connection/connection.dart' as connection;
import 'package:my_money/data/repositories/account_repository.dart';
import 'package:my_money/data/repositories/fixed_expense_repository.dart';
import 'package:my_money/data/repositories/savings_goal_repository.dart';
import 'package:my_money/data/repositories/transaction_repository.dart';
import 'package:my_money/navigation/app_navigation.dart';
import 'package:my_money/pages/auth/login_page.dart';
import 'package:my_money/pages/onboarding/welcome_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_theme.dart';

/// 應用程式入口
/// 柔和水彩風格的個人財務管理 App
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 初始化 Auth 服務
  final authService = AuthService();
  await authService.init();

  // 初始化資料庫
  final database = AppDatabase(connection.openConnection());

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
    authService: authService,
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

  /// Auth 服務
  final AuthService authService;

  const MyMoneyApp({
    super.key,
    required this.accountRepository,
    required this.fixedExpenseRepository,
    required this.savingsGoalRepository,
    required this.transactionRepository,
    required this.authService,
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

        // 強制亮色模式，不受瀏覽器深色模式影響
        themeMode: ThemeMode.light,

        // 根據登入狀態決定首頁
        home: authService.isLoggedIn
            ? const AppNavigation()
            : LoginPage(authService: authService),
        routes: {
          '/login': (context) => LoginPage(authService: authService),
          '/onboarding': (context) => WelcomePage(authService: authService),
          '/home': (context) => const AppNavigation(),
        },
      ),
    );
  }
}
