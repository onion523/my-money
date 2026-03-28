import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:my_money/main.dart';

void main() {
  testWidgets('App 啟動冒煙測試', (WidgetTester tester) async {
    // 建立應用程式並觸發一幀
    await tester.pumpWidget(const MyMoneyApp());

    // 確認首頁標題出現
    expect(find.text('我的錢錢'), findsOneWidget);

    // 確認底部導覽列存在
    expect(find.byType(BottomNavigationBar), findsOneWidget);
  });
}
