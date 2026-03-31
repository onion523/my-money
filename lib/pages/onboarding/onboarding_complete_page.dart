import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/navigation/app_navigation.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// Onboarding 完成頁面 — 慶祝插圖 + 進入首頁
class OnboardingCompletePage extends StatefulWidget {
  const OnboardingCompletePage({super.key});

  @override
  State<OnboardingCompletePage> createState() => _OnboardingCompletePageState();
}

class _OnboardingCompletePageState extends State<OnboardingCompletePage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _scaleAnimation;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _scaleAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.elasticOut,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeIn,
    );

    // 進場動畫
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  /// 進入首頁並關閉所有 onboarding 路由
  void _goToHome() {
    // 重新載入所有 BLoC 資料（資料已透過 API 寫入後端）
    context.read<AccountsBloc>().add(const LoadAccounts());
    context.read<GoalsBloc>().add(const LoadGoals());
    context.read<BalanceBloc>().add(const LoadBalance());
    context.read<ExpensesBloc>().add(const LoadExpenses());
    context.read<CashflowBloc>().add(const LoadCashflow());

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AppNavigation()),
      (route) => false,
    );
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
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(flex: 2),

              // 慶祝插圖
              _buildCelebration(),

              const SizedBox(height: AppTheme.spacingXl),

              // 標題
              FadeTransition(
                opacity: _fadeAnimation,
                child: Text(
                  '準備好了！',
                  style: GoogleFonts.zenMaruGothic(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryText,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // 副標題
              FadeTransition(
                opacity: _fadeAnimation,
                child: Text(
                  '一切設定完成，開始管理你的錢錢吧',
                  style: AppTextStyles.body(color: AppColors.secondaryText),
                  textAlign: TextAlign.center,
                ),
              ),

              const Spacer(flex: 3),

              // 進入首頁按鈕
              _buildEnterButton(),

              const SizedBox(height: AppTheme.spacing2xl),
            ],
          ),
        ),
      ),
    );
  }

  /// 建構慶祝插圖 — 水彩風格同心圓 + 圖示
  Widget _buildCelebration() {
    return ScaleTransition(
      scale: _scaleAnimation,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 外圈光暈
          Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppColors.accent.withValues(alpha: 0.15),
                  AppColors.accent.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
          // 中圈
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFFE8E8),
                  Color(0xFFFFD4D4),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.accent.withValues(alpha: 0.2),
                  blurRadius: 32,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
          ),
          // 內圈
          Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFFD4D4),
                  Color(0xFFFFB3B3),
                ],
              ),
            ),
            child: const Icon(
              Icons.celebration_rounded,
              size: 52,
              color: Colors.white,
            ),
          ),
          // 裝飾小點 — 左上
          Positioned(
            top: 16,
            left: 24,
            child: _buildDot(AppColors.accentWarm, 12),
          ),
          // 裝飾小點 — 右上
          Positioned(
            top: 8,
            right: 36,
            child: _buildDot(AppColors.accentCool, 10),
          ),
          // 裝飾小點 — 左下
          Positioned(
            bottom: 20,
            left: 32,
            child: _buildDot(AppColors.accentCool, 8),
          ),
          // 裝飾小點 — 右下
          Positioned(
            bottom: 12,
            right: 24,
            child: _buildDot(AppColors.accentWarm, 14),
          ),
          // 裝飾小點 — 右側
          Positioned(
            top: 60,
            right: 8,
            child: _buildDot(AppColors.accent, 6),
          ),
        ],
      ),
    );
  }

  /// 建構裝飾小點
  Widget _buildDot(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withValues(alpha: 0.6),
      ),
    );
  }

  /// 建構進入首頁按鈕
  Widget _buildEnterButton() {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _goToHome,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.accent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTheme.inputRadius),
            ),
            elevation: 0,
          ),
          child: Text(
            '進入首頁',
            style: AppTextStyles.bodyBold(color: Colors.white),
          ),
        ),
      ),
    );
  }
}
