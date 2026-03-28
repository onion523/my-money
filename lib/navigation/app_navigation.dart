import 'package:flutter/material.dart';
import 'package:my_money/pages/accounts_page.dart';
import 'package:my_money/pages/expenses_page.dart';
import 'package:my_money/pages/goals_page.dart';
import 'package:my_money/pages/home_page.dart';
import 'package:my_money/widgets/fab_menu.dart';

/// 底部導覽列 — 4 個 tab
/// 首頁 / 帳戶 / 儲蓄 / 花費
class AppNavigation extends StatefulWidget {
  const AppNavigation({super.key});

  @override
  State<AppNavigation> createState() => _AppNavigationState();
}

class _AppNavigationState extends State<AppNavigation> {
  /// 目前選中的 tab 索引
  int _currentIndex = 0;

  /// 各 tab 對應的頁面
  static const List<Widget> _pages = [
    HomePage(),
    AccountsPage(),
    GoalsPage(),
    ExpensesPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),

      // 底部導覽列
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() => _currentIndex = index);
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
          // TODO: 開啟記花費頁面
        },
        onAddSaving: () {
          // TODO: 開啟存儲蓄頁面
        },
        onUpdateBalance: () {
          // TODO: 開啟更新餘額頁面
        },
      ),
    );
  }
}
