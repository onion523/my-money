import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/pages/onboarding/setup_account_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 歡迎頁面 — 3 頁介紹 + 開始設定按鈕
class WelcomePage extends StatefulWidget {
  /// 認證服務
  final AuthService authService;

  const WelcomePage({super.key, required this.authService});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  /// 介紹頁面內容
  static const List<_IntroContent> _introPages = [
    _IntroContent(
      icon: Icons.account_balance_wallet_rounded,
      title: '即時掌握',
      subtitle: '隨時知道你真正可以花的錢',
      gradientColors: [Color(0xFFFFD4D4), Color(0xFFFFB3B3)],
    ),
    _IntroContent(
      icon: Icons.savings_rounded,
      title: '聰明儲蓄',
      subtitle: '為夢想設定目標，自動追蹤進度',
      gradientColors: [Color(0xFFFFE4C4), Color(0xFFFFD4A0)],
    ),
    _IntroContent(
      icon: Icons.shield_rounded,
      title: '安心生活',
      subtitle: '現金流預測，確保不會透支',
      gradientColors: [Color(0xFFC4E4F0), Color(0xFFA8D8EA)],
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingLg,
          ),
          child: Column(
            children: [
              const SizedBox(height: AppTheme.spacing2xl),

              // 大標題
              _buildHeader(),

              const SizedBox(height: AppTheme.spacingXl),

              // PageView 介紹頁
              Expanded(child: _buildPageView()),

              // 頁面指示器
              _buildPageIndicator(),

              const SizedBox(height: AppTheme.spacingLg),

              // 開始設定按鈕
              _buildStartButton(),

              const SizedBox(height: AppTheme.spacing2xl),
            ],
          ),
        ),
      ),
    );
  }

  /// 建構標題區塊
  Widget _buildHeader() {
    return Column(
      children: [
        Text(
          '歡迎來到我的錢錢',
          style: GoogleFonts.zenMaruGothic(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: AppColors.primaryText,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          '輕鬆掌握你的每一分錢',
          style: AppTextStyles.body(color: AppColors.secondaryText),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  /// 建構 PageView 介紹頁
  Widget _buildPageView() {
    return PageView.builder(
      controller: _pageController,
      itemCount: _introPages.length,
      onPageChanged: (index) {
        setState(() => _currentPage = index);
      },
      itemBuilder: (context, index) {
        final page = _introPages[index];
        return _buildIntroPage(page);
      },
    );
  }

  /// 建構單一介紹頁
  Widget _buildIntroPage(_IntroContent content) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // 水彩風格圓形背景 + 圖示
          Container(
            width: 140,
            height: 140,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: content.gradientColors,
              ),
              boxShadow: [
                BoxShadow(
                  color: content.gradientColors.last.withValues(alpha: 0.3),
                  blurRadius: 32,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Icon(
              content.icon,
              size: 64,
              color: Colors.white,
            ),
          ),

          const SizedBox(height: AppTheme.spacingXl),

          // 標題
          Text(
            content.title,
            style: GoogleFonts.zenMaruGothic(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryText,
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // 副標題
          Text(
            content.subtitle,
            style: AppTextStyles.body(color: AppColors.secondaryText),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// 建構頁面指示器
  Widget _buildPageIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        _introPages.length,
        (index) => AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: _currentPage == index ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: _currentPage == index
                ? AppColors.accent
                : AppColors.accent.withValues(alpha: 0.25),
          ),
        ),
      ),
    );
  }

  /// 建構開始設定按鈕
  Widget _buildStartButton() {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const SetupAccountPage(),
            ),
          );
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.inputRadius),
          ),
          elevation: 0,
        ),
        child: Text(
          '開始設定',
          style: AppTextStyles.bodyBold(color: Colors.white),
        ),
      ),
    );
  }
}

/// 介紹頁面內容資料
class _IntroContent {
  /// 圖示
  final IconData icon;

  /// 標題
  final String title;

  /// 副標題
  final String subtitle;

  /// 漸層顏色
  final List<Color> gradientColors;

  const _IntroContent({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradientColors,
  });
}
