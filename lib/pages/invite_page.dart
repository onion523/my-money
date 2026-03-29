import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 邀請頁面
/// 顯示邀請連結（可複製）、QR Code、LINE / Email 分享按鈕
class InvitePage extends StatelessWidget {
  const InvitePage({super.key});

  /// Mock 邀請連結
  static const _inviteUrl = 'https://my-money.app/invite/abc123xyz';

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        title: const Text('邀請朋友'),
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ========== 說明文字 ==========
              Text(
                '邀請朋友一起存錢，分享以下連結或 QR Code 即可加入共同儲蓄目標。',
                style: AppTextStyles.body(
                  color: isDark
                      ? AppColors.darkSecondaryText
                      : AppColors.secondaryText,
                ),
              ),

              const SizedBox(height: AppTheme.sectionGap),

              // ========== 邀請連結卡片 ==========
              _buildInviteLinkCard(context, isDark),

              const SizedBox(height: AppTheme.sectionGap),

              // ========== QR Code 區塊 ==========
              _buildQrCodeSection(isDark),

              const SizedBox(height: AppTheme.sectionGap),

              // ========== 分享按鈕區 ==========
              _buildShareButton(
                isDark: isDark,
                icon: Icons.chat_bubble_outline,
                label: '透過 LINE 分享',
                color: const Color(0xFF06C755),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('已開啟 LINE 分享')),
                  );
                },
              ),

              const SizedBox(height: AppTheme.cardGap),

              _buildShareButton(
                isDark: isDark,
                icon: Icons.email_outlined,
                label: '透過 Email 分享',
                color: AppColors.accentCool,
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('已開啟 Email 分享')),
                  );
                },
              ),

              const SizedBox(height: AppTheme.spacing2xl),
            ],
          ),
        ),
      ),
    );
  }

  /// 邀請連結卡片
  Widget _buildInviteLinkCard(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.link,
                color: isDark ? AppColors.darkAccent : AppColors.accent,
                size: 20,
              ),
              const SizedBox(width: AppTheme.spacingSm),
              Text(
                '邀請連結',
                style: AppTextStyles.bodyBold(
                  color: isDark
                      ? AppColors.darkPrimaryText
                      : AppColors.primaryText,
                ),
              ),
            ],
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // 連結文字
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingSm + AppTheme.spacingXs,
              vertical: AppTheme.spacingSm,
            ),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkBackground
                  : AppColors.background,
              borderRadius: BorderRadius.circular(AppTheme.inputRadius),
            ),
            child: Text(
              _inviteUrl,
              style: AppTextStyles.caption(
                color: isDark
                    ? AppColors.darkSecondaryText
                    : AppColors.secondaryText,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // 複製按鈕
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(const ClipboardData(text: _inviteUrl));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text('已複製邀請連結'),
                    backgroundColor:
                        isDark ? AppColors.darkSuccess : AppColors.success,
                  ),
                );
              },
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('複製連結'),
              style: OutlinedButton.styleFrom(
                foregroundColor:
                    isDark ? AppColors.darkAccent : AppColors.accent,
                side: BorderSide(
                  color: (isDark ? AppColors.darkAccent : AppColors.accent)
                      .withValues(alpha: 0.4),
                ),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppTheme.buttonRadius),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// QR Code 模擬區塊
  Widget _buildQrCodeSection(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            '掃描 QR Code 加入',
            style: AppTextStyles.bodyBold(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),

          const SizedBox(height: AppTheme.spacingMd),

          // 模擬 QR Code
          Center(
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppTheme.inputRadius),
                border: Border.all(
                  color: AppColors.secondaryText.withValues(alpha: 0.15),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(AppTheme.spacingSm),
                child: _buildMockQrCode(),
              ),
            ),
          ),

          const SizedBox(height: AppTheme.spacingSm),

          Text(
            '讓朋友掃描上方 QR Code',
            style: AppTextStyles.caption(
              color: isDark
                  ? AppColors.darkSecondaryText
                  : AppColors.secondaryText,
            ),
          ),
        ],
      ),
    );
  }

  /// 用 Container 模擬 QR Code 方塊圖案
  Widget _buildMockQrCode() {
    // 模擬 QR Code 的方塊圖案
    const pattern = [
      [1, 1, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 1, 0, 0, 1, 1, 0, 1],
      [1, 1, 1, 0, 1, 0, 1, 1, 1],
      [0, 0, 0, 1, 0, 1, 0, 0, 0],
      [1, 0, 1, 1, 1, 0, 1, 0, 1],
      [0, 1, 0, 0, 1, 1, 0, 1, 0],
      [1, 1, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 1, 1, 0, 0, 1, 0, 1],
      [1, 1, 1, 0, 1, 1, 1, 1, 1],
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final cellSize = constraints.maxWidth / pattern.length;
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: pattern.map((row) {
            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: row.map((cell) {
                return Container(
                  width: cellSize,
                  height: cellSize,
                  color: cell == 1 ? Colors.black87 : Colors.white,
                );
              }).toList(),
            );
          }).toList(),
        );
      },
    );
  }

  /// 分享按鈕
  Widget _buildShareButton({
    required bool isDark,
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            vertical: AppTheme.spacingSm + AppTheme.spacingXs,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
          ),
          elevation: 0,
        ),
      ),
    );
  }
}
