import 'package:flutter/material.dart';

/// 應用程式色彩常數
/// 柔和水彩風格的色彩系統
class AppColors {
  AppColors._();

  // ========== 亮色模式 ==========

  /// 背景色：淡粉暖白
  static const Color background = Color(0xFFFFF5F5);

  /// 卡片/表面色：純白
  static const Color surface = Color(0xFFFFFFFF);

  /// 主要文字色
  static const Color primaryText = Color(0xFF2D3436);

  /// 次要文字色
  static const Color secondaryText = Color(0xFF636E72);

  /// 主重點色：柔和粉紅
  static const Color accent = Color(0xFFFF8A8A);

  /// 暖黃強調色：次要強調、儲蓄進度
  static const Color accentWarm = Color(0xFFFFD4A0);

  /// 淺藍強調色：資訊性標記
  static const Color accentCool = Color(0xFFA8D8EA);

  // ========== 語意色彩 ==========

  /// 安全綠：進度正常、充裕
  static const Color success = Color(0xFF55C595);

  /// 警告橙：需加油、注意
  static const Color warning = Color(0xFFFFB347);

  /// 危險紅：超支、錯誤
  static const Color error = Color(0xFFFF6B6B);

  /// 資訊藍
  static const Color info = Color(0xFFA8D8EA);

  // ========== 暗色模式 ==========

  /// 暗色背景
  static const Color darkBackground = Color(0xFF1A1A2E);

  /// 暗色卡片/表面
  static const Color darkSurface = Color(0xFF252540);

  /// 暗色主要文字
  static const Color darkPrimaryText = Color(0xFFF0F0F0);

  /// 暗色次要文字
  static const Color darkSecondaryText = Color(0xFFA0A0B8);

  /// 暗色主重點色：淡化粉紅
  static const Color darkAccent = Color(0xFFFF9E9E);

  /// 暗色安全綠（降低飽和度）
  static const Color darkSuccess = Color(0xFF4DB585);

  /// 暗色警告橙（降低飽和度）
  static const Color darkWarning = Color(0xFFE6A040);

  /// 暗色危險紅（降低飽和度）
  static const Color darkError = Color(0xFFE66060);

  // ========== 漸層色 ==========

  /// 餘額卡片漸層
  static const LinearGradient balanceGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFF5F5), Color(0xFFFFE8E8)],
  );

  /// 粉紅按鈕漸層
  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFF8A8A), Color(0xFFFF6B6B)],
  );

  /// 暗色餘額卡片漸層
  static const LinearGradient darkBalanceGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF252540), Color(0xFF2A2A4A)],
  );
}
