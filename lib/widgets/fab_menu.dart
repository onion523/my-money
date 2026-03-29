import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 浮動 + 按鈕選單
/// 點擊展開三個選項：記花費 / 存儲蓄 / 更新餘額
class FabMenu extends StatefulWidget {
  /// 記花費回調
  final VoidCallback? onAddExpense;

  /// 存儲蓄回調
  final VoidCallback? onAddSaving;

  /// 更新餘額回調
  final VoidCallback? onUpdateBalance;

  const FabMenu({
    super.key,
    this.onAddExpense,
    this.onAddSaving,
    this.onUpdateBalance,
  });

  @override
  State<FabMenu> createState() => _FabMenuState();
}

class _FabMenuState extends State<FabMenu> with SingleTickerProviderStateMixin {
  /// 是否展開
  bool _isOpen = false;

  /// 動畫控制器
  late final AnimationController _controller;
  late final Animation<double> _scaleAnimation;
  late final Animation<double> _rotateAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 250),
      vsync: this,
    );
    _scaleAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutBack,
    );
    _rotateAnimation = Tween<double>(begin: 0, end: 0.375).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() {
      _isOpen = !_isOpen;
      if (_isOpen) {
        _controller.forward();
      } else {
        _controller.reverse();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      height: 280,
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          // 背景遮罩
          if (_isOpen)
            Positioned.fill(
              child: GestureDetector(
                onTap: _toggle,
                child: const SizedBox.expand(),
              ),
            ),

          // 選項按鈕
          _buildMenuItem(
            index: 2,
            icon: Icons.account_balance_wallet_outlined,
            label: '更新餘額',
            onTap: () {
              _toggle();
              widget.onUpdateBalance?.call();
            },
          ),
          _buildMenuItem(
            index: 1,
            icon: Icons.savings_outlined,
            label: '存儲蓄',
            onTap: () {
              _toggle();
              widget.onAddSaving?.call();
            },
          ),
          _buildMenuItem(
            index: 0,
            icon: Icons.receipt_long_outlined,
            label: '記帳',
            onTap: () {
              _toggle();
              widget.onAddExpense?.call();
            },
          ),

          // 主按鈕
          Positioned(
            bottom: 0,
            right: 0,
            child: RotationTransition(
              turns: _rotateAnimation,
              child: FloatingActionButton(
                onPressed: _toggle,
                elevation: _isOpen ? 8 : 4,
                child: const Icon(Icons.add, size: 28),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 建立選單項目
  Widget _buildMenuItem({
    required int index,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // 每個選項間隔 64px
    final bottomOffset = 64.0 + (index * 56.0);

    return Positioned(
      bottom: bottomOffset,
      right: 0,
      child: ScaleTransition(
        scale: _scaleAnimation,
        alignment: Alignment.bottomRight,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 標籤
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingSm + AppTheme.spacingXs,
                vertical: AppTheme.spacingXs + 2,
              ),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(label, style: AppTextStyles.caption()),
            ),
            const SizedBox(width: AppTheme.spacingSm),

            // 圓形按鈕
            SizedBox(
              width: 44,
              height: 44,
              child: FloatingActionButton.small(
                heroTag: 'fab_$index',
                onPressed: onTap,
                elevation: 2,
                backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
                foregroundColor: isDark ? AppColors.darkAccent : AppColors.accent,
                child: Icon(icon, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
