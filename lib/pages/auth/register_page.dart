import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:my_money/pages/onboarding/welcome_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 註冊頁面 — 柔和水彩風格
class RegisterPage extends StatefulWidget {
  /// 認證服務
  final AuthService authService;

  const RegisterPage({super.key, required this.authService});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  /// 執行註冊
  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final result = await widget.authService.register(
      _emailController.text.trim(),
      _passwordController.text,
      _nameController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => WelcomePage(authService: widget.authService),
        ),
        (route) => false,
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.error ?? '註冊失敗，請稍後再試',
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
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
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
                    // 標題
                    _buildHeader(),

                    const SizedBox(height: AppTheme.spacingXl),

                    // 名稱輸入框
                    _buildNameField(),

                    const SizedBox(height: AppTheme.spacingMd),

                    // Email 輸入框
                    _buildEmailField(),

                    const SizedBox(height: AppTheme.spacingMd),

                    // 密碼輸入框
                    _buildPasswordField(),

                    const SizedBox(height: AppTheme.spacingMd),

                    // 確認密碼輸入框
                    _buildConfirmPasswordField(),

                    const SizedBox(height: AppTheme.spacingLg),

                    // 註冊按鈕
                    _buildRegisterButton(),

                    const SizedBox(height: AppTheme.spacingMd),

                    // 登入連結
                    _buildLoginLink(),

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

  /// 建構標題區塊
  Widget _buildHeader() {
    return Column(
      children: [
        // 水彩風格圓形背景 + 圖示
        Container(
          width: 80,
          height: 80,
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
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Icon(
            Icons.person_add_rounded,
            size: 40,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppTheme.spacingMd),
        Text(
          '建立帳號',
          style: GoogleFonts.zenMaruGothic(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: AppColors.primaryText,
          ),
        ),
        const SizedBox(height: AppTheme.spacingXs),
        Text(
          '開始你的理財之旅',
          style: AppTextStyles.caption(),
        ),
      ],
    );
  }

  /// 建構名稱輸入框
  Widget _buildNameField() {
    return TextFormField(
      controller: _nameController,
      textInputAction: TextInputAction.next,
      style: AppTextStyles.body(),
      decoration: const InputDecoration(
        labelText: '名稱',
        hintText: '請輸入你的名稱',
        prefixIcon:
            Icon(Icons.person_outline_rounded, color: AppColors.secondaryText),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return '請輸入名稱';
        }
        return null;
      },
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
      textInputAction: TextInputAction.next,
      style: AppTextStyles.body(),
      decoration: InputDecoration(
        labelText: '密碼',
        hintText: '請設定密碼（至少 6 個字元）',
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
    );
  }

  /// 建構確認密碼輸入框
  Widget _buildConfirmPasswordField() {
    return TextFormField(
      controller: _confirmPasswordController,
      obscureText: _obscureConfirm,
      textInputAction: TextInputAction.done,
      style: AppTextStyles.body(),
      decoration: InputDecoration(
        labelText: '確認密碼',
        hintText: '請再輸入一次密碼',
        prefixIcon:
            const Icon(Icons.lock_outline, color: AppColors.secondaryText),
        suffixIcon: IconButton(
          icon: Icon(
            _obscureConfirm ? Icons.visibility_off : Icons.visibility,
            color: AppColors.secondaryText,
          ),
          onPressed: () {
            setState(() => _obscureConfirm = !_obscureConfirm);
          },
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return '請確認密碼';
        }
        if (value != _passwordController.text) {
          return '兩次密碼不一致';
        }
        return null;
      },
      onFieldSubmitted: (_) => _handleRegister(),
    );
  }

  /// 建構註冊按鈕
  Widget _buildRegisterButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleRegister,
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
                '註冊',
                style: AppTextStyles.bodyBold(color: Colors.white),
              ),
      ),
    );
  }

  /// 建構登入連結
  Widget _buildLoginLink() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('已有帳號？', style: AppTextStyles.caption()),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            '登入',
            style: AppTextStyles.caption(color: AppColors.accent).copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
