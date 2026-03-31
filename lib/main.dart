import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/fixed_expenses/fixed_expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
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

  // 全域 error handler — 防止未捕獲的錯誤導致白畫面
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Uncaught error: $error');
    return true;
  };

  // 初始化 Auth 服務
  final authService = AuthService();
  await authService.init();

  // 建立所有 Repository（透過 AuthService 取得 ApiClient）
  final accountRepo = AccountRepository(authService);
  final fixedExpenseRepo = FixedExpenseRepository(authService);
  final savingsGoalRepo = SavingsGoalRepository(authService);
  final transactionRepo = TransactionRepository(authService);

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
    return RepositoryProvider<AuthService>.value(
      value: authService,
      child: MultiBlocProvider(
        providers: [
          // 餘額 BLoC
          BlocProvider<BalanceBloc>(
            create: (context) {
              final bloc = BalanceBloc(
                accountRepository: accountRepository,
                fixedExpenseRepository: fixedExpenseRepository,
                savingsGoalRepository: savingsGoalRepository,
                transactionRepository: transactionRepository,
              );
              if (authService.isLoggedIn) bloc.add(const LoadBalance());
              return bloc;
            },
          ),

          // 帳戶 BLoC
          BlocProvider<AccountsBloc>(
            create: (context) {
              final bloc = AccountsBloc(
                accountRepository: accountRepository,
              );
              if (authService.isLoggedIn) bloc.add(const LoadAccounts());
              return bloc;
            },
          ),

          // 儲蓄目標 BLoC（依賴 BalanceBloc）
          BlocProvider<GoalsBloc>(
            create: (context) {
              final bloc = GoalsBloc(
                savingsGoalRepository: savingsGoalRepository,
                balanceBloc: context.read<BalanceBloc>(),
              );
              if (authService.isLoggedIn) bloc.add(const LoadGoals());
              return bloc;
            },
          ),

          // 花費 BLoC
          BlocProvider<ExpensesBloc>(
            create: (context) {
              final bloc = ExpensesBloc(
                transactionRepository: transactionRepository,
              );
              if (authService.isLoggedIn) bloc.add(const LoadExpenses());
              return bloc;
            },
          ),

          // 現金流 BLoC
          BlocProvider<CashflowBloc>(
            create: (context) {
              final bloc = CashflowBloc(
                accountRepository: accountRepository,
                fixedExpenseRepository: fixedExpenseRepository,
                savingsGoalRepository: savingsGoalRepository,
              );
              if (authService.isLoggedIn) bloc.add(const LoadCashflow());
              return bloc;
            },
          ),

          // 固定收支 BLoC
          BlocProvider<FixedExpensesBloc>(
            create: (context) {
              final bloc = FixedExpensesBloc(
                repository: fixedExpenseRepository,
                cashflowBloc: context.read<CashflowBloc>(),
              );
              if (authService.isLoggedIn) {
                bloc.add(const LoadFixedExpenses());
              }
              return bloc;
            },
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
      ),
    );
  }
}
