import 'package:shared_preferences/shared_preferences.dart';

/// 使用者資料模型
class User {
  /// 使用者 Email
  final String email;

  /// 使用者名稱
  final String name;

  const User({required this.email, required this.name});
}

/// 認證服務 — 管理登入、註冊、登出
/// TODO: 整合 better-auth JWT，目前使用 SharedPreferences 模擬
class AuthService {
  static const String _keyEmail = 'auth_email';
  static const String _keyName = 'auth_name';
  static const String _keyLoggedIn = 'auth_logged_in';

  User? _currentUser;

  /// 目前登入的使用者
  User? get currentUser => _currentUser;

  /// 是否已登入
  bool get isLoggedIn => _currentUser != null;

  /// 初始化 — 從 SharedPreferences 還原登入狀態
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final loggedIn = prefs.getBool(_keyLoggedIn) ?? false;
    if (loggedIn) {
      final email = prefs.getString(_keyEmail) ?? '';
      final name = prefs.getString(_keyName) ?? '';
      if (email.isNotEmpty) {
        _currentUser = User(email: email, name: name);
      }
    }
  }

  /// 登入
  /// TODO: 整合 better-auth JWT，目前僅驗證 email/password 非空
  Future<bool> login(String email, String password) async {
    // 模擬網路延遲
    await Future.delayed(const Duration(milliseconds: 500));

    // 簡單驗證（正式環境應呼叫後端 API）
    if (email.isEmpty || password.isEmpty) {
      return false;
    }

    // 儲存登入狀態
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyEmail, email);
    await prefs.setBool(_keyLoggedIn, true);

    // 嘗試讀取先前註冊的名稱，若無則用 email 前綴
    final savedName = prefs.getString(_keyName) ?? email.split('@').first;
    _currentUser = User(email: email, name: savedName);

    return true;
  }

  /// 註冊
  /// TODO: 整合 better-auth JWT，目前僅本地儲存
  Future<bool> register(String email, String password, String name) async {
    // 模擬網路延遲
    await Future.delayed(const Duration(milliseconds: 500));

    // 簡單驗證
    if (email.isEmpty || password.isEmpty || name.isEmpty) {
      return false;
    }

    // 儲存使用者資料
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyEmail, email);
    await prefs.setString(_keyName, name);
    await prefs.setBool(_keyLoggedIn, true);

    _currentUser = User(email: email, name: name);

    return true;
  }

  /// 登出
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyLoggedIn, false);
    _currentUser = null;
  }
}
