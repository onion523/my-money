import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:my_money/pages/invite_page.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/member_progress.dart';

/// 共同儲蓄目標成員資料
class _MemberData {
  final String name;
  final Decimal contributed;

  const _MemberData({required this.name, required this.contributed});
}

/// 共同儲蓄詳情頁
/// 頂部目標名稱 + emoji + 總進度、成員列表、邀請/存入按鈕
class SharedGoalDetailPage extends StatefulWidget {
  const SharedGoalDetailPage({super.key});

  @override
  State<SharedGoalDetailPage> createState() => _SharedGoalDetailPageState();
}

class _SharedGoalDetailPageState extends State<SharedGoalDetailPage> {
  /// 目標名稱
  static const _goalName = '日本旅遊基金';

  /// 目標 emoji
  static const _goalEmoji = '\u{1F1EF}\u{1F1F5}';

  /// 目標金額
  static final _targetAmount = Decimal.parse('40000');

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
        title: const Text('共同儲蓄詳情'),
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        elevation: 0,
      ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ========== 目標名稱 + emoji + 總進度 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppTheme.spacingMd,
                  AppTheme.spacingSm,
                  AppTheme.spacingMd,
                  AppTheme.spacingMd,
                ),
                child: _buildGoalHeader(
                  isDark,
                  totalContributed,
                  totalProgress,
                ),
              ),
            ),

            // ========== 成員列表標題 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMd,
                ),
                child: Row(
                  children: [
                    const Text('\u{1F46B}', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: AppTheme.spacingSm),
                    Text('成員貢獻', style: AppTextStyles.cardTitle()),
                  ],
                ),
              ),
            ),

            const SliverToBoxAdapter(
              child: SizedBox(height: AppTheme.spacingSm),
            ),

            // ========== 成員列表 ==========
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
              ),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final member = _members[index];
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

            // ========== 操作按鈕區 ==========
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMd,
                ),
                child: Column(
                  children: [
                    // 存入按鈕
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => _showDepositDialog(context, isDark),
                        icon: const Icon(Icons.savings_outlined),
                        label: const Text('存入'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              isDark ? AppColors.darkAccent : AppColors.accent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            vertical: AppTheme.spacingSm + AppTheme.spacingXs,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.buttonRadius),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: AppTheme.cardGap),

                    // 邀請朋友按鈕
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const InvitePage(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.person_add_outlined),
                        label: const Text('邀請朋友'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor:
                              isDark ? AppColors.darkAccent : AppColors.accent,
                          side: BorderSide(
                            color:
                                (isDark ? AppColors.darkAccent : AppColors.accent)
                                    .withValues(alpha: 0.4),
                          ),
                          padding: const EdgeInsets.symmetric(
                            vertical: AppTheme.spacingSm + AppTheme.spacingXs,
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

  /// 目標標頭卡片：名稱 + emoji + 總進度條 + 金額
  Widget _buildGoalHeader(
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
          // 目標名稱 + emoji + 百分比
          Row(
            children: [
              const Text(_goalEmoji, style: TextStyle(fontSize: 28)),
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

          // 已存 / 目標金額
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

  /// 顯示存入金額 Dialog
  void _showDepositDialog(BuildContext context, bool isDark) {
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.modalRadius),
          ),
          title: Text(
            '存入貢獻',
            style: AppTextStyles.cardTitle(
              color: isDark
                  ? AppColors.darkPrimaryText
                  : AppColors.primaryText,
            ),
          ),
          content: TextField(
            controller: controller,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              hintText: '輸入存入金額',
              prefixText: '\$ ',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () {
                // Mock：關閉 dialog 即可
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      '已存入 \$${controller.text}',
                    ),
                    backgroundColor:
                        isDark ? AppColors.darkSuccess : AppColors.success,
                  ),
                );
              },
              child: const Text('確認存入'),
            ),
          ],
        );
      },
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
