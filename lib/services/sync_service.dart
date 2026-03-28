import 'dart:convert';
import 'package:http/http.dart' as http;

/// 同步服務
///
/// 負責本地資料與遠端伺服器之間的雙向同步，包含：
/// - 全量同步（收集本地變更並推送，拉取遠端變更）
/// - 推送本地變更到伺服器
/// - 拉取伺服器新變更
/// - LWW（Last-Writer-Wins）衝突解決策略
class SyncService {
  final http.Client _client;
  final String _baseUrl;
  final String _userId;

  /// 需要同步的資料表清單
  static const List<String> syncTables = [
    'accounts',
    'fixed_expenses',
    'savings_goals',
    'transactions',
  ];

  SyncService({
    required String baseUrl,
    required String userId,
    http.Client? client,
  })  : _baseUrl = baseUrl,
        _userId = userId,
        _client = client ?? http.Client();

  /// 執行全量同步
  ///
  /// 收集本地所有待同步的變更，POST 到 /api/sync，
  /// 並處理伺服器回傳的變更（server_wins）。
  ///
  /// [getLocalChanges] 回呼函式，根據表名回傳待同步的本地紀錄
  ///
  /// 回傳伺服器端較新的紀錄（需由呼叫端寫入本地資料庫）
  Future<Map<String, List<Map<String, dynamic>>>> syncAll({
    required Future<List<Map<String, dynamic>>> Function(String table)
        getLocalChanges,
  }) async {
    final serverChanges = <String, List<Map<String, dynamic>>>{};

    for (final table in syncTables) {
      final localRecords = await getLocalChanges(table);

      if (localRecords.isNotEmpty) {
        // 推送本地變更並取得伺服器端較新的紀錄
        final result = await pushChanges(table, localRecords);
        if (result.isNotEmpty) {
          serverChanges[table] = result;
        }
      }
    }

    // 拉取伺服器上的最新變更
    final pulled = await pullChanges();
    for (final entry in pulled.entries) {
      serverChanges.putIfAbsent(entry.key, () => []).addAll(entry.value);
    }

    return serverChanges;
  }

  /// 推送本地變更到伺服器
  ///
  /// [table] 資料表名稱
  /// [records] 待推送的紀錄清單
  ///
  /// 回傳伺服器端較新的紀錄（server_wins）
  Future<List<Map<String, dynamic>>> pushChanges(
    String table,
    List<Map<String, dynamic>> records,
  ) async {
    final uri = Uri.parse('$_baseUrl/api/sync');

    final response = await _client.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': _userId,
      },
      body: jsonEncode({
        'table': table,
        'records': records,
      }),
    );

    if (response.statusCode != 200) {
      throw SyncException(
        '推送變更失敗：HTTP ${response.statusCode}',
        statusCode: response.statusCode,
      );
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final serverWins = body['server_wins'] as List<dynamic>? ?? [];

    return serverWins
        .map((r) => Map<String, dynamic>.from(r as Map))
        .toList();
  }

  /// 拉取伺服器上的最新變更
  ///
  /// 向伺服器請求所有表的最新資料
  ///
  /// 回傳按表名分組的伺服器紀錄
  Future<Map<String, List<Map<String, dynamic>>>> pullChanges() async {
    final result = <String, List<Map<String, dynamic>>>{};

    for (final table in syncTables) {
      final uri = Uri.parse('$_baseUrl/api/$table');

      final response = await _client.get(
        uri,
        headers: {
          'X-User-Id': _userId,
        },
      );

      if (response.statusCode != 200) {
        throw SyncException(
          '拉取 $table 失敗：HTTP ${response.statusCode}',
          statusCode: response.statusCode,
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final data = body['data'] as List<dynamic>? ?? [];
      result[table] =
          data.map((r) => Map<String, dynamic>.from(r as Map)).toList();
    }

    return result;
  }

  /// LWW（Last-Writer-Wins）衝突解決
  ///
  /// 比較 local 與 remote 的 updated_at 時間戳記，
  /// 選擇較新的那一方。若時間相同，以 remote 為準。
  ///
  /// [local] 本地紀錄，需包含 `updated_at` (String, ISO 8601)
  /// [remote] 遠端紀錄，需包含 `updated_at` (String, ISO 8601)
  ///
  /// 回傳勝出的紀錄
  Map<String, dynamic> handleConflict(
    Map<String, dynamic> local,
    Map<String, dynamic> remote,
  ) {
    final localTime = DateTime.parse(local['updated_at'] as String);
    final remoteTime = DateTime.parse(remote['updated_at'] as String);

    // local 嚴格較新時使用 local，否則使用 remote（含相同時間戳記）
    if (localTime.isAfter(remoteTime)) {
      return local;
    }
    return remote;
  }

  /// 釋放 HTTP 客戶端資源
  void dispose() {
    _client.close();
  }
}

/// 同步操作例外
class SyncException implements Exception {
  final String message;
  final int? statusCode;

  SyncException(this.message, {this.statusCode});

  @override
  String toString() => 'SyncException: $message';
}
