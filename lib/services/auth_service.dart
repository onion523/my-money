import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:my_money/services/api_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 使用者資料模型
class User {
  /// 使用者 ID
  final String id;

  /// 使用者 Email
  final String email;

  /// 使用者名稱
  final String name;

  const User({required this.id, required this.email, required this.name});
}

/// 認證服務 — 管理登入、註冊、登出
/// 透過後端 API 進行真正的身份驗證
class AuthService {
  static const String _keyUserId = 'auth_user_id';
  static const String _keyEmail = 'auth_email';
  static const String _keyName = 'auth_name';
  static const String _keyToken = 'auth_token';
  static const String _keyLoggedIn = 'auth_logged_in';

  /// 後端 API 基礎 URL
  /// 後端 API 基礎 URL（正式環境用 Cloudflare Workers）
  static const String _baseUrl = 'https://my-money-api.onion523.workers.dev';

  User? _currentUser;
  String? _token;
  ApiClient? _apiClient;

  /// 目前登入的使用者
  User? get currentUser => _currentUser;

  /// 是否已登入
  bool get isLoggedIn => _currentUser != null;

  /// JWT Token
  String? get token => _token;

  /// 使用者 ID
  String? get userId => _currentUser?.id;

  /// API 基礎 URL
  String get baseUrl => _baseUrl;

  /// 取得 ApiClient（根據目前登入狀態自動建立）
  ApiClient? get apiClient {
    if (_currentUser == null || _token == null) return null;
    _apiClient ??= ApiClient(
      baseUrl: _baseUrl,
      userId: _currentUser!.id,
      token: _token,
    );
    return _apiClient;
  }

  /// 初始化 — 從 SharedPreferences 還原登入狀態
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final loggedIn = prefs.getBool(_keyLoggedIn) ?? false;
    if (loggedIn) {
      final id = prefs.getString(_keyUserId) ?? '';
      final email = prefs.getString(_keyEmail) ?? '';
      final name = prefs.getString(_keyName) ?? '';
      final token = prefs.getString(_keyToken) ?? '';
      if (id.isNotEmpty && email.isNotEmpty && token.isNotEmpty) {
        _currentUser = User(id: id, email: email, name: name);
        _token = token;
      }
    }
  }

  /// 登入
  Future<({bool success, String? error})> login(
    String email,
    String password,
  ) async {
    if (email.isEmpty || password.isEmpty) {
      return (success: false, error: '請輸入電子郵件和密碼');
    }

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      final body = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 && body['ok'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        await _saveSession(data);
        return (success: true, error: null);
      }

      return (
        success: false,
        error: body['error'] as String? ?? '登入失敗',
      );
    } catch (e) {
      return (success: false, error: '無法連線到伺服器：$e');
    }
  }

  /// 註冊
  Future<({bool success, String? error})> register(
    String email,
    String password,
    String name,
  ) async {
    if (email.isEmpty || password.isEmpty || name.isEmpty) {
      return (success: false, error: '請填寫所有欄位');
    }

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          'name': name,
        }),
      );

      final body = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 && body['ok'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        await _saveSession(data);
        return (success: true, error: null);
      }

      return (
        success: false,
        error: body['error'] as String? ?? '註冊失敗',
      );
    } catch (e) {
      return (success: false, error: '無法連線到伺服器：$e');
    }
  }

  /// 儲存登入 session
  Future<void> _saveSession(Map<String, dynamic> data) async {
    final id = data['user_id'] as String;
    final email = data['email'] as String;
    final name = data['name'] as String;
    final token = data['token'] as String;

    _currentUser = User(id: id, email: email, name: name);
    _token = token;
    _apiClient?.dispose();
    _apiClient = null; // 重新登入時重建 ApiClient

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserId, id);
    await prefs.setString(_keyEmail, email);
    await prefs.setString(_keyName, name);
    await prefs.setString(_keyToken, token);
    await prefs.setBool(_keyLoggedIn, true);
  }

  /// 登出
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyLoggedIn, false);
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserId);
    _apiClient?.dispose();
    _apiClient = null;
    _currentUser = null;
    _token = null;
  }
}
