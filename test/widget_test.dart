import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/theme/app_theme.dart';

void main() {
  testWidgets('App 主題載入冒煙測試', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const Scaffold(
          body: Center(child: Text('My Money')),
        ),
      ),
    );

    expect(find.text('My Money'), findsOneWidget);
  });
}
