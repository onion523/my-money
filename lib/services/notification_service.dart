import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// 通知插件抽象介面（方便測試時替換）
abstract class NotificationPluginWrapper {
  /// 初始化通知插件
  Future<bool?> initialize(InitializationSettings settings);

  /// 顯示通知
  Future<void> show(
    int id,
    String? title,
    String? body,
    NotificationDetails? details,
  );
}

/// 正式環境使用的通知插件包裝，委派給 FlutterLocalNotificationsPlugin
class RealNotificationPlugin implements NotificationPluginWrapper {
  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  @override
  Future<bool?> initialize(InitializationSettings settings) {
    return _plugin.initialize(settings);
  }

  @override
  Future<void> show(
    int id,
    String? title,
    String? body,
    NotificationDetails? details,
  ) {
    return _plugin.show(id, title, body, details);
  }
}

/// 推撥通知服務
///
/// 負責排程與發送本地通知，包含：
/// - 固定支出扣款提醒
/// - 餘額低於安全水位警告
/// - 儲蓄目標達成通知
/// - 月底摘要通知
class NotificationService {
  final NotificationPluginWrapper _plugin;

  /// 通知頻道 ID 常數
  static const String _channelId = 'my_money_notifications';
  static const String _channelName = '記帳提醒';
  static const String _channelDescription = 'My Money 記帳應用程式通知';

  /// 通知 ID 分段，避免衝突
  static const int _deductionBaseId = 1000;
  static const int _lowBalanceId = 2000;
  static const int _goalAchievedBaseId = 3000;
  static const int _monthlySummaryId = 4000;

  NotificationService({NotificationPluginWrapper? plugin})
      : _plugin = plugin ?? RealNotificationPlugin();

  /// 初始化通知套件
  Future<void> initialize() async {
    // Android 初始化設定
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    // iOS 初始化設定
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(initSettings);
  }

  /// 掃描明天有扣款的固定支出項目，排程本地通知
  ///
  /// [fixedExpenses] 固定支出清單，每筆需包含：
  ///   - `name` (String): 項目名稱
  ///   - `amount` (num): 金額
  ///   - `due_day` (int): 每月扣款日（1-31）
  ///   - `is_active` (bool): 是否啟用
  ///   - `account_id` (String): 關聯帳戶 ID
  /// [accounts] 帳戶清單，每筆需包含：
  ///   - `id` (String): 帳戶 ID
  ///   - `name` (String): 帳戶名稱
  ///
  /// 回傳已排程的通知數量
  Future<int> scheduleDeductionReminder(
    List<Map<String, dynamic>> fixedExpenses,
    List<Map<String, dynamic>> accounts,
  ) async {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final tomorrowDay = tomorrow.day;

    // 建立帳戶 ID → 名稱對照表
    final accountNames = <String, String>{};
    for (final account in accounts) {
      accountNames[account['id'] as String] = account['name'] as String;
    }

    // 篩選明天要扣款且啟用中的項目
    final dueExpenses = fixedExpenses.where((expense) {
      final dueDay = expense['due_day'] as int;
      final isActive = expense['is_active'] as bool;
      return isActive && dueDay == tomorrowDay;
    }).toList();

    // 為每筆到期項目排程通知
    for (var i = 0; i < dueExpenses.length; i++) {
      final expense = dueExpenses[i];
      final name = expense['name'] as String;
      final amount = expense['amount'] as num;
      final accountId = expense['account_id'] as String;
      final accountName = accountNames[accountId] ?? '未知帳戶';

      await _plugin.show(
        _deductionBaseId + i,
        '明日扣款提醒',
        '$name 將於明天從「$accountName」扣款 \$${amount.toStringAsFixed(0)}',
        _buildNotificationDetails(),
      );
    }

    return dueExpenses.length;
  }

  /// 檢查餘額是否低於安全水位，若低於則發送警告通知
  ///
  /// [availableBalance] 目前可用餘額
  /// [threshold] 安全水位門檻值
  ///
  /// 回傳是否已發送通知
  Future<bool> checkLowBalance(num availableBalance, num threshold) async {
    if (availableBalance >= threshold) {
      return false;
    }

    await _plugin.show(
      _lowBalanceId,
      '餘額不足警告',
      '目前可用餘額 \$${availableBalance.toStringAsFixed(0)}，'
          '已低於安全水位 \$${threshold.toStringAsFixed(0)}',
      _buildNotificationDetails(),
    );

    return true;
  }

  /// 儲蓄目標達成時發送祝賀通知
  ///
  /// [goal] 儲蓄目標資料，需包含：
  ///   - `name` (String): 目標名稱
  ///   - `target_amount` (num): 目標金額
  Future<void> notifyGoalAchieved(Map<String, dynamic> goal) async {
    final name = goal['name'] as String;
    final targetAmount = goal['target_amount'] as num;

    await _plugin.show(
      _goalAchievedBaseId + name.hashCode.abs() % 1000,
      '儲蓄目標達成！',
      '恭喜！「$name」已達成目標金額 \$${targetAmount.toStringAsFixed(0)}',
      _buildNotificationDetails(),
    );
  }

  /// 月底產生摘要通知
  ///
  /// [balance] 當月結餘
  /// [expenses] 當月總支出
  Future<void> monthlySummary(num balance, num expenses) async {
    final now = DateTime.now();
    final month = now.month;

    await _plugin.show(
      _monthlySummaryId,
      '$month 月份摘要',
      '本月支出 \$${expenses.toStringAsFixed(0)}，'
          '結餘 \$${balance.toStringAsFixed(0)}',
      _buildNotificationDetails(),
    );
  }

  /// 建立通知顯示細節（Android + iOS 共用）
  NotificationDetails _buildNotificationDetails() {
    const androidDetails = AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDescription,
      importance: Importance.high,
      priority: Priority.high,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    return const NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
  }
}
