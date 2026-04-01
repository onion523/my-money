import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/ai_suggestion_card.dart';
import 'package:my_money/widgets/member_progress.dart';

/// 共同儲蓄目標成員資料（頁面用）
class _MemberData {
  final String name;
  final Decimal contributed;

  const _MemberData({required this.name, required this.contributed});
}

/// 共同儲蓄目標頁面
/// 顯示成員列表、個人/總進度、AI 建議、邀請連結
/// 使用 mock 資料：你 $12,000、小明 $8,200、小美 $7,000
class SharedGoalPage extends StatelessWidget {
  const SharedGoalPage({super.key});

  /// 目標名稱
  static const _goalName = '泰國旅遊基金';

  /// 目標金額
  static final _targetAmount = Decimal.parse('50000');

  /// Mock 成員資料
  static final _members = [
    _MemberData(name: '你', contributed: Decimal.parse('12000')),
    _MemberData(name: '小明', contributed: Decimal.parse('8200')),
    _MemberData(name: '小美', contributed: Decimal.parse('7000')),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // 計算總進度
    final totalContributed = _members.fold(
      Decimal.zero,
      (sum, m) => sum + m.contributed,
    );
    final totalProgress =
        (totalContributed / _targetAmount).toDouble().clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        title: Text(_goalName),
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        elevation: 0,
      ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ========== 總進度卡片 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppTheme.spacingMd,
                  AppTheme.spacingSm,
                  AppTheme.spacingMd,
                  AppTheme.spacingMd,
                ),
                child: _buildTotalProgressCard(
                  isDark,
                  totalContributed,
                  totalProgress,
                ),
              ),
            ),

            // ========== 成員進度區 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMd,
                ),
                child: Row(
                  children: [
                    const Text('\u{1F46B}', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: AppTheme.spacingSm),
                    Text('成員進度', style: AppTextStyles.cardTitle()),
                  ],
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final member = _members[index];
                    // 個人進度 = 個人貢獻 / 目標金額
                    final memberProgress =
                        (member.contributed / _targetAmount)
                            .toDouble()
                            .clamp(0.0, 1.0);

                    return MemberProgress(
                      name: member.name,
                      amount: _formatAmount(member.contributed),
                      progress: memberProgress,
                    );
                  },
                  childCount: _members.length,
                ),
              ),
            ),

            const SliverToBoxAdapter(
              child: SizedBox(height: AppTheme.sectionGap),
            ),

            // ========== AI 建議區 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMd,
                ),
                child: Row(
                  children: [
                    const Text('\u{1F4A1}', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: AppTheme.spacingSm),
                    Text('AI 建議', style: AppTextStyles.cardTitle()),
                  ],
                ),
              ),
            ),

            const SliverToBoxAdapter(
              child: SizedBox(height: AppTheme.spacingSm),
            ),

            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const AiSuggestionCard(
                    text: '每週少喝 2 杯咖啡（省 \$300），泰國旅費可提早 1 個月存滿',
                    impactAmount: '\$300',
                  ),
                  const SizedBox(height: AppTheme.cardGap),
                  const AiSuggestionCard(
                    text: '照目前速度，泰國旅遊基金預計 8 月中能存滿',
                    icon: Icons.timeline,
                    iconColor: AppColors.accentCool,
                  ),
                ]),
              ),
            ),

            const SliverToBoxAdapter(
              child: SizedBox(height: AppTheme.sectionGap),
            ),

            // ========== 邀請連結 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMd,
                ),
                child: _buildInviteButton(isDark),
              ),
            ),

            const SliverToBoxAdapter(
              child: SizedBox(height: AppTheme.spacing2xl),
            ),
          ],
        ),
      ),
    );
  }

  /// 總進度卡片
  Widget _buildTotalProgressCard(
    bool isDark,
    Decimal totalContributed,
    double totalProgress,
  ) {
    final progressColor = _getProgressColor(totalProgress);

    return Container(
      padding: const EdgeInsets.all(AppTheme.cardPadding + AppTheme.spacingXs),
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
          // 目標名稱 + emoji
          Row(
            children: [
              const Text('\u{2708}\u{FE0F}', style: TextStyle(fontSize: 28)),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: Text(_goalName, style: AppTextStyles.cardTitle()),
              ),
              Text(
                '${(totalProgress * 100).toInt()}%',
                style: AppTextStyles.bodyBold(color: progressColor),
              ),
            ],
          ),

          const SizedBox(height: AppTheme.spacingSm + AppTheme.spacingXs),

          // 總進度條
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: totalProgress,
              backgroundColor: progressColor.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              minHeight: 10,
            ),
          ),

          const SizedBox(height: AppTheme.spacingSm),

          // 金額
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '\$${_formatAmount(totalContributed)}',
                style: AppTextStyles.amountMedium(
                  color: isDark
                      ? AppColors.darkPrimaryText
                      : AppColors.primaryText,
                ),
              ),
              Text(
                '/ \$${_formatAmount(_targetAmount)}',
                style: AppTextStyles.caption(
                  color: isDark
                      ? AppColors.darkSecondaryText
                      : AppColors.secondaryText,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 邀請連結按鈕
  Widget _buildInviteButton(bool isDark) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () {
          // TODO: 實作邀請連結功能
        },
        icon: const Icon(Icons.link),
        label: const Text('複製邀請連結'),
        style: OutlinedButton.styleFrom(
          foregroundColor: isDark ? AppColors.darkAccent : AppColors.accent,
          side: BorderSide(
            color: (isDark ? AppColors.darkAccent : AppColors.accent)
                .withValues(alpha: 0.4),
          ),
          padding: const EdgeInsets.symmetric(
            vertical: AppTheme.spacingSm + AppTheme.spacingXs,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.buttonRadius),
          ),
        ),
      ),
    );
  }

  /// 根據進度回傳對應顏色
  Color _getProgressColor(double progress) {
    if (progress >= 0.7) return AppColors.success;
    if (progress >= 0.4) return AppColors.warning;
    return AppColors.accent;
  }

  /// 格式化金額（加入千分位逗號）
  static String _formatAmount(Decimal amount) {
    final intPart = amount.toBigInt().toString();
    final buffer = StringBuffer();

    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(intPart[i]);
    }

    return buffer.toString();
  }
}
