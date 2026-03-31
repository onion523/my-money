import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/pages/accounts_page.dart';
import 'package:my_money/pages/auth/login_page.dart';
import 'package:my_money/pages/expenses_page.dart';
import 'package:my_money/pages/goals_page.dart';
import 'package:my_money/pages/home_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/widgets/fab_menu.dart';
import 'package:my_money/widgets/dialogs/add_transaction_dialog.dart';
import 'package:my_money/widgets/dialogs/add_saving_dialog.dart';
import 'package:my_money/widgets/dialogs/update_balance_dialog.dart';

/// 底部導覽列 — 4 個 tab
/// 首頁 / 帳戶 / 儲蓄 / 花費
class AppNavigation extends StatefulWidget {
  const AppNavigation({super.key});

  @override
  State<AppNavigation> createState() => AppNavigationState();
}

class AppNavigationState extends State<AppNavigation> {
  /// 目前選中的 tab 索引
  int _currentIndex = 0;

  /// 外部切換 tab
  void switchToTab(int index) {
    setState(() => _currentIndex = index);
  }

  /// 各 tab 對應的頁面
  static const List<Widget> _pages = [
    HomePage(),
    AccountsPage(),
    GoalsPage(),
    ExpensesPage(),
  ];

  /// 登出
  Future<void> _logout() async {
    final authService = context.read<AuthService>();
    await authService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => LoginPage(authService: authService),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.secondaryText),
            tooltip: '登出',
            onPressed: _logout,
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),

      // 底部導覽列
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() => _currentIndex = index);
          if (index == 0) {
            // 切回首頁時刷新所有資料
            context.read<BalanceBloc>().add(const LoadBalance());
            context.read<CashflowBloc>().add(const LoadCashflow());
            context.read<ExpensesBloc>().add(const LoadExpenses());
            context.read<GoalsBloc>().add(const LoadGoals());
          }
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: '首頁',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_outlined),
            activeIcon: Icon(Icons.account_balance),
            label: '帳戶',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.savings_outlined),
            activeIcon: Icon(Icons.savings),
            label: '儲蓄',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_outlined),
            activeIcon: Icon(Icons.receipt_long),
            label: '花費',
          ),
        ],
      ),

      // 浮動 + 按鈕
      floatingActionButton: FabMenu(
        onAddExpense: () {
          showDialog(
            context: context,
            builder: (_) => const AddTransactionDialog(),
          );
        },
        onAddSaving: () {
          showDialog(
            context: context,
            builder: (_) => const AddSavingDialog(),
          );
        },
        onUpdateBalance: () {
          showDialog(
            context: context,
            builder: (_) => const UpdateBalanceDialog(),
          );
        },
      ),
    );
  }
}
