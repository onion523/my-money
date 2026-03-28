import 'package:flutter/material.dart';
import 'package:my_money/navigation/app_navigation.dart';
import 'package:my_money/theme/app_theme.dart';

/// 應用程式入口
/// 柔和水彩風格的個人財務管理 App
void main() {
  runApp(const MyMoneyApp());
}

/// 根元件 — 套用主題並啟動底部導覽
class MyMoneyApp extends StatelessWidget {
  const MyMoneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
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
    );
  }
}
