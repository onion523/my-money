import 'package:flutter/material.dart';
// TODO: import after pub get
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/theme/app_colors.dart';

/// 應用程式文字樣式
/// 標題使用 Zen Maru Gothic（圓潤可愛日系字型）
/// 內文使用 Noto Sans TC（繁體中文最佳可讀性）
class AppTextStyles {
  AppTextStyles._();

  // ========== 標題字型（Zen Maru Gothic） ==========

  /// 3xl: 32px — 餘額大數字
  static TextStyle hero({Color? color}) => GoogleFonts.zenMaruGothic(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: color ?? AppColors.primaryText,
    height: 1.2,
  );

  /// 2xl: 24px — 頁面標題
  static TextStyle pageTitle({Color? color}) => GoogleFonts.zenMaruGothic(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: color ?? AppColors.primaryText,
    height: 1.3,
  );

  /// xl: 20px — 卡片標題
  static TextStyle cardTitle({Color? color}) => GoogleFonts.zenMaruGothic(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: color ?? AppColors.primaryText,
    height: 1.3,
  );

  /// lg: 18px — 次標題
  static TextStyle subtitle({Color? color}) => GoogleFonts.zenMaruGothic(
    fontSize: 18,
    fontWeight: FontWeight.w500,
    color: color ?? AppColors.primaryText,
    height: 1.4,
  );

  // ========== 內文字型（Noto Sans TC） ==========

  /// md: 16px — 內文
  static TextStyle body({Color? color}) => GoogleFonts.notoSansTc(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: color ?? AppColors.primaryText,
    height: 1.5,
  );

  /// md: 16px — 內文粗體
  static TextStyle bodyBold({Color? color}) => GoogleFonts.notoSansTc(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: color ?? AppColors.primaryText,
    height: 1.5,
  );

  /// sm: 14px — 輔助文字
  static TextStyle caption({Color? color}) => GoogleFonts.notoSansTc(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: color ?? AppColors.secondaryText,
    height: 1.5,
  );

  /// xs: 12px — 標籤、時間戳
  static TextStyle label({Color? color}) => GoogleFonts.notoSansTc(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: color ?? AppColors.secondaryText,
    height: 1.5,
  );

  // ========== 數字專用（Noto Sans TC tabular-nums） ==========

  /// 大金額數字
  static TextStyle amountLarge({Color? color}) => GoogleFonts.zenMaruGothic(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: color ?? AppColors.primaryText,
    height: 1.2,
    fontFeatures: const [FontFeature.tabularFigures()],
  );

  /// 中金額數字
  static TextStyle amountMedium({Color? color}) => GoogleFonts.notoSansTc(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: color ?? AppColors.primaryText,
    height: 1.3,
    fontFeatures: const [FontFeature.tabularFigures()],
  );

  /// 小金額數字
  static TextStyle amountSmall({Color? color}) => GoogleFonts.notoSansTc(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    color: color ?? AppColors.primaryText,
    height: 1.4,
    fontFeatures: const [FontFeature.tabularFigures()],
  );
}
