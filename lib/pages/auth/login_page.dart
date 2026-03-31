import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/bloc/accounts/accounts_bloc.dart';
import 'package:my_money/bloc/balance/balance_bloc.dart';
import 'package:my_money/bloc/cashflow/cashflow_bloc.dart';
import 'package:my_money/bloc/expenses/expenses_bloc.dart';
import 'package:my_money/bloc/goals/goals_bloc.dart';
import 'package:my_money/navigation/app_navigation.dart';
import 'package:my_money/pages/auth/register_page.dart';
import 'package:my_money/pages/onboarding/welcome_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 登入頁面 — 柔和水彩風格
class LoginPage extends StatefulWidget {
  /// 認證服務
  final AuthService authService;

  const LoginPage({super.key, required this.authService});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// 執行登入
  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final result = await widget.authService.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      // 檢查是否已有帳戶（判斷是否需要 onboarding）
      final accounts = await widget.authService.apiClient?.get('/api/accounts');
      final hasAccounts = accounts != null &&
          (accounts['data'] as List<dynamic>?)?.isNotEmpty == true;

      if (!mounted) return;

      if (hasAccounts) {
        // 已有資料，直接進首頁
        context.read<AccountsBloc>().add(const LoadAccounts());
        context.read<GoalsBloc>().add(const LoadGoals());
        context.read<BalanceBloc>().add(const LoadBalance());
        context.read<ExpensesBloc>().add(const LoadExpenses());
        context.read<CashflowBloc>().add(const LoadCashflow());
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AppNavigation()),
          (route) => false,
        );
      } else {
        // 第一次登入，進 onboarding
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => WelcomePage(authService: widget.authService),
          ),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.error ?? '登入失敗，請檢查帳號密碼',
            style: AppTextStyles.caption(color: Colors.white),
          ),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingLg,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: AppTheme.spacing2xl),

                    // Logo / App 名稱
                    _buildLogo(),

                    const SizedBox(height: AppTheme.spacing2xl),

                    // Email 輸入框
                    _buildEmailField(),

                    const SizedBox(height: AppTheme.spacingMd),

                    // 密碼輸入框
                    _buildPasswordField(),

                    const SizedBox(height: AppTheme.spacingLg),

                    // 登入按鈕
                    _buildLoginButton(),

                    const SizedBox(height: AppTheme.spacingMd),

                    // 註冊連結
                    _buildRegisterLink(),

                    const SizedBox(height: AppTheme.spacing2xl),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 建構 Logo 區塊
  Widget _buildLogo() {
    return Column(
      children: [
        // 水彩風格圓形背景 + 圖示
        Container(
          width: 96,
          height: 96,
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
            boxShadow: [
              BoxShadow(
                color: AppColors.accent.withValues(alpha: 0.2),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.savings_rounded,
            size: 48,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppTheme.spacingMd),
        Text(
          '我的錢錢',
          style: GoogleFonts.zenMaruGothic(
            fontSize: 32,
            fontWeight: FontWeight.w700,
            color: AppColors.primaryText,
          ),
        ),
        const SizedBox(height: AppTheme.spacingXs),
        Text(
          '輕鬆掌握你的每一分錢',
          style: AppTextStyles.caption(),
        ),
      ],
    );
  }

  /// 建構 Email 輸入框
  Widget _buildEmailField() {
    return TextFormField(
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.next,
      style: AppTextStyles.body(),
      decoration: const InputDecoration(
        labelText: 'Email',
        hintText: '請輸入電子郵件',
        prefixIcon: Icon(Icons.email_outlined, color: AppColors.secondaryText),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return '請輸入電子郵件';
        }
        if (!RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(value.trim())) {
          return '請輸入有效的電子郵件格式';
        }
        return null;
      },
    );
  }

  /// 建構密碼輸入框
  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordController,
      obscureText: _obscurePassword,
      textInputAction: TextInputAction.done,
      style: AppTextStyles.body(),
      decoration: InputDecoration(
        labelText: '密碼',
        hintText: '請輸入密碼',
        prefixIcon:
            const Icon(Icons.lock_outline, color: AppColors.secondaryText),
        suffixIcon: IconButton(
          icon: Icon(
            _obscurePassword ? Icons.visibility_off : Icons.visibility,
            color: AppColors.secondaryText,
          ),
          onPressed: () {
            setState(() => _obscurePassword = !_obscurePassword);
          },
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return '請輸入密碼';
        }
        if (value.length < 6) {
          return '密碼至少需要 6 個字元';
        }
        return null;
      },
      onFieldSubmitted: (_) => _handleLogin(),
    );
  }

  /// 建構登入按鈕
  Widget _buildLoginButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleLogin,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.inputRadius),
          ),
          elevation: 0,
        ),
        child: _isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Text(
                '登入',
                style: AppTextStyles.bodyBold(color: Colors.white),
              ),
      ),
    );
  }

  /// 建構註冊連結
  Widget _buildRegisterLink() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('還沒有帳號？', style: AppTextStyles.caption()),
        TextButton(
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) =>
                    RegisterPage(authService: widget.authService),
              ),
            );
          },
          child: Text(
            '註冊',
            style: AppTextStyles.caption(color: AppColors.accent).copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
