import 'package:flutter/material.dart';
// TODO: import after pub get
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/theme/app_colors.dart';

/// 應用程式主題設定
/// 柔和水彩風格 — 日系、活潑、可愛、溫暖
/// 遵循 iOS HIG 設計規範
class AppTheme {
  AppTheme._();

  /// 圓角常數
  static const double cardRadius = 16.0;
  static const double buttonRadius = 8.0;
  static const double inputRadius = 12.0;
  static const double modalRadius = 24.0;

  /// 間距常數
  static const double spacing2xs = 2.0;
  static const double spacingXs = 4.0;
  static const double spacingSm = 8.0;
  static const double spacingMd = 16.0;
  static const double spacingLg = 24.0;
  static const double spacingXl = 32.0;
  static const double spacing2xl = 48.0;
  static const double spacing3xl = 64.0;

  /// 卡片間距
  static const double cardPadding = 16.0;
  static const double cardGap = 12.0;
  static const double sectionGap = 24.0;

  // ========== 亮色主題 ==========
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.light(
        primary: AppColors.accent,
        onPrimary: Colors.white,
        secondary: AppColors.accentWarm,
        onSecondary: AppColors.primaryText,
        tertiary: AppColors.accentCool,
        surface: AppColors.surface,
        onSurface: AppColors.primaryText,
        error: AppColors.error,
        onError: Colors.white,
      ),

      // 應用程式列
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.primaryText,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: GoogleFonts.zenMaruGothic(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: AppColors.primaryText,
        ),
      ),

      // 卡片
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
        margin: const EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: cardGap / 2,
        ),
      ),

      // 按鈕
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingLg,
            vertical: spacingSm + spacingXs,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          textStyle: GoogleFonts.notoSansTc(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // 文字按鈕
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accent,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingMd,
            vertical: spacingSm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          textStyle: GoogleFonts.notoSansTc(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // 輸入框
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: spacingSm + spacingXs,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(inputRadius),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(inputRadius),
          borderSide: BorderSide(
            color: AppColors.secondaryText.withValues(alpha: 0.2),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(inputRadius),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        hintStyle: GoogleFonts.notoSansTc(
          fontSize: 14,
          color: AppColors.secondaryText.withValues(alpha: 0.5),
        ),
      ),

      // 底部導覽列
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.accent,
        unselectedItemColor: AppColors.secondaryText,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 12),
      ),

      // 浮動按鈕
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: CircleBorder(),
      ),

      // 分隔線
      dividerTheme: DividerThemeData(
        color: AppColors.secondaryText.withValues(alpha: 0.1),
        thickness: 0.5,
        space: 0,
      ),

      // 文字主題
      textTheme: TextTheme(
        headlineLarge: GoogleFonts.zenMaruGothic(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: AppColors.primaryText,
        ),
        headlineMedium: GoogleFonts.zenMaruGothic(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: AppColors.primaryText,
        ),
        headlineSmall: GoogleFonts.zenMaruGothic(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: AppColors.primaryText,
        ),
        titleLarge: GoogleFonts.zenMaruGothic(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: AppColors.primaryText,
        ),
        bodyLarge: GoogleFonts.notoSansTc(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: AppColors.primaryText,
        ),
        bodyMedium: GoogleFonts.notoSansTc(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: AppColors.primaryText,
        ),
        bodySmall: GoogleFonts.notoSansTc(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.secondaryText,
        ),
        labelLarge: GoogleFonts.notoSansTc(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.primaryText,
        ),
        labelSmall: GoogleFonts.notoSansTc(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.secondaryText,
        ),
      ),
    );
  }

  // ========== 暗色主題 ==========
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.darkAccent,
        onPrimary: AppColors.darkBackground,
        secondary: AppColors.accentWarm,
        onSecondary: AppColors.darkPrimaryText,
        tertiary: AppColors.accentCool,
        surface: AppColors.darkSurface,
        onSurface: AppColors.darkPrimaryText,
        error: AppColors.darkError,
        onError: Colors.white,
      ),

      // 應用程式列
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.darkBackground,
        foregroundColor: AppColors.darkPrimaryText,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: GoogleFonts.zenMaruGothic(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: AppColors.darkPrimaryText,
        ),
      ),

      // 卡片
      cardTheme: CardThemeData(
        color: AppColors.darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
        margin: const EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: cardGap / 2,
        ),
      ),

      // 按鈕
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.darkAccent,
          foregroundColor: AppColors.darkBackground,
          elevation: 0,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingLg,
            vertical: spacingSm + spacingXs,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          textStyle: GoogleFonts.notoSansTc(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // 文字按鈕
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.darkAccent,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingMd,
            vertical: spacingSm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          textStyle: GoogleFonts.notoSansTc(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // 輸入框
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkSurface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: spacingSm + spacingXs,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(inputRadius),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(inputRadius),
          borderSide: BorderSide(
            color: AppColors.darkSecondaryText.withValues(alpha: 0.2),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(inputRadius),
          borderSide: const BorderSide(
            color: AppColors.darkAccent,
            width: 1.5,
          ),
        ),
        hintStyle: GoogleFonts.notoSansTc(
          fontSize: 14,
          color: AppColors.darkSecondaryText.withValues(alpha: 0.5),
        ),
      ),

      // 底部導覽列
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.darkSurface,
        selectedItemColor: AppColors.darkAccent,
        unselectedItemColor: AppColors.darkSecondaryText,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 12),
      ),

      // 浮動按鈕
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.darkAccent,
        foregroundColor: AppColors.darkBackground,
        elevation: 4,
        shape: CircleBorder(),
      ),

      // 分隔線
      dividerTheme: DividerThemeData(
        color: AppColors.darkSecondaryText.withValues(alpha: 0.1),
        thickness: 0.5,
        space: 0,
      ),

      // 文字主題
      textTheme: TextTheme(
        headlineLarge: GoogleFonts.zenMaruGothic(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: AppColors.darkPrimaryText,
        ),
        headlineMedium: GoogleFonts.zenMaruGothic(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: AppColors.darkPrimaryText,
        ),
        headlineSmall: GoogleFonts.zenMaruGothic(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: AppColors.darkPrimaryText,
        ),
        titleLarge: GoogleFonts.zenMaruGothic(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: AppColors.darkPrimaryText,
        ),
        bodyLarge: GoogleFonts.notoSansTc(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: AppColors.darkPrimaryText,
        ),
        bodyMedium: GoogleFonts.notoSansTc(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: AppColors.darkPrimaryText,
        ),
        bodySmall: GoogleFonts.notoSansTc(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.darkSecondaryText,
        ),
        labelLarge: GoogleFonts.notoSansTc(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.darkPrimaryText,
        ),
        labelSmall: GoogleFonts.notoSansTc(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.darkSecondaryText,
        ),
      ),
    );
  }
}
