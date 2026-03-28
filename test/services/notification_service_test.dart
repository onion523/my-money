import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:my_money/services/notification_service.dart';

/// 模擬通知插件，記錄所有 show 呼叫以供驗證
class MockNotificationPlugin implements NotificationPluginWrapper {
  final List<MockNotificationCall> calls = [];

  @override
  Future<bool?> initialize(InitializationSettings settings) async {
    return true;
  }

  @override
  Future<void> show(
    int id,
    String? title,
    String? body,
    NotificationDetails? details,
  ) async {
    calls.add(MockNotificationCall(
      id: id,
      title: title,
      body: body,
    ));
  }
}

/// 記錄單次通知呼叫的資料
class MockNotificationCall {
  final int id;
  final String? title;
  final String? body;

  MockNotificationCall({
    required this.id,
    this.title,
    this.body,
  });
}

void main() {
  late MockNotificationPlugin mockPlugin;
  late NotificationService service;

  setUp(() {
    mockPlugin = MockNotificationPlugin();
    service = NotificationService(plugin: mockPlugin);
  });

  group('scheduleDeductionReminder', () {
    /// 建立測試用固定支出資料
    List<Map<String, dynamic>> buildExpenses(int dueDay,
        {bool isActive = true}) {
      return [
        {
          'name': 'Netflix',
          'amount': 390,
          'due_day': dueDay,
          'is_active': isActive,
          'account_id': 'acc-1',
        },
      ];
    }

    final accounts = [
      {'id': 'acc-1', 'name': '台新銀行'},
    ];

    test('明天有扣款 → 排程通知', () async {
      // 安排：設定扣款日為明天
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      final expenses = buildExpenses(tomorrow.day);

      // 執行
      final count =
          await service.scheduleDeductionReminder(expenses, accounts);

      // 驗證：應排程 1 則通知
      expect(count, 1);
      expect(mockPlugin.calls.length, 1);
      expect(mockPlugin.calls.first.title, '明日扣款提醒');
      expect(mockPlugin.calls.first.body, contains('Netflix'));
      expect(mockPlugin.calls.first.body, contains('台新銀行'));
    });

    test('明天無扣款 → 不排程', () async {
      // 安排：設定扣款日為非明天的日期
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      // 確保 otherDay 不等於明天
      final otherDay = tomorrow.day == 1 ? 28 : 1;
      final expenses = buildExpenses(otherDay);

      // 執行
      final count =
          await service.scheduleDeductionReminder(expenses, accounts);

      // 驗證：不應排程任何通知
      expect(count, 0);
      expect(mockPlugin.calls.length, 0);
    });
  });

  group('checkLowBalance', () {
    test('餘額低於水位 → 通知', () async {
      // 執行：餘額 3000 低於門檻 5000
      final notified = await service.checkLowBalance(3000, 5000);

      // 驗證
      expect(notified, true);
      expect(mockPlugin.calls.length, 1);
      expect(mockPlugin.calls.first.title, '餘額不足警告');
      expect(mockPlugin.calls.first.body, contains('3000'));
      expect(mockPlugin.calls.first.body, contains('5000'));
    });

    test('餘額安全 → 不通知', () async {
      // 執行：餘額 10000 高於門檻 5000
      final notified = await service.checkLowBalance(10000, 5000);

      // 驗證
      expect(notified, false);
      expect(mockPlugin.calls.length, 0);
    });
  });

  group('notifyGoalAchieved', () {
    test('目標達成 → 通知', () async {
      // 安排
      final goal = {
        'name': '旅遊基金',
        'target_amount': 50000,
      };

      // 執行
      await service.notifyGoalAchieved(goal);

      // 驗證
      expect(mockPlugin.calls.length, 1);
      expect(mockPlugin.calls.first.title, '儲蓄目標達成！');
      expect(mockPlugin.calls.first.body, contains('旅遊基金'));
      expect(mockPlugin.calls.first.body, contains('50000'));
    });
  });
}
