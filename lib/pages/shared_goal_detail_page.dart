import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/data/repositories/shared_goal_repository.dart';
import 'package:my_money/pages/invite_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';
import 'package:my_money/widgets/member_progress.dart';

/// 共同儲蓄詳情頁
/// 頂部目標名稱 + emoji + 總進度、成員列表、邀請/存入按鈕
class SharedGoalDetailPage extends StatefulWidget {
  /// 共同儲蓄目標資料
  final SharedGoalWithMembers goal;

  const SharedGoalDetailPage({super.key, required this.goal});

  @override
  State<SharedGoalDetailPage> createState() => _SharedGoalDetailPageState();
}

class _SharedGoalDetailPageState extends State<SharedGoalDetailPage> {
  late SharedGoalWithMembers _goal;
  late SharedGoalRepository _repo;

  @override
  void initState() {
    super.initState();
    _goal = widget.goal;
    _repo = SharedGoalRepository(context.read<AuthService>());
  }

  /// 重新載入目標資料
  Future<void> _refresh() async {
    final updated = await _repo.getSharedGoal(_goal.id);
    if (!mounted) return;
    if (updated != null) {
      setState(() => _goal = updated);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final totalContributed = _goal.totalContributed;
    final totalProgress = _goal.progress;

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
        child: RefreshIndicator(
          onRefresh: _refresh,
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

              // ========== 邀請碼區塊 ==========
              if (_goal.inviteCode.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingMd,
                    ),
                    child: _buildInviteCodeCard(context, isDark),
                  ),
                ),

              if (_goal.inviteCode.isNotEmpty)
                const SliverToBoxAdapter(
                  child: SizedBox(height: AppTheme.sectionGap),
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
                      final member = _goal.members[index];
                      final memberProgress = _goal.targetAmount > Decimal.zero
                          ? (member.contributedAmount / _goal.targetAmount)
                              .toDouble()
                              .clamp(0.0, 1.0)
                          : 0.0;

                      return MemberProgress(
                        name: member.userName,
                        amount: _formatAmount(member.contributedAmount),
                        progress: memberProgress,
                      );
                    },
                    childCount: _goal.members.length,
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
                              vertical:
                                  AppTheme.spacingSm + AppTheme.spacingXs,
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
                            foregroundColor: isDark
                                ? AppColors.darkAccent
                                : AppColors.accent,
                            side: BorderSide(
                              color: (isDark
                                      ? AppColors.darkAccent
                                      : AppColors.accent)
                                  .withValues(alpha: 0.4),
                            ),
                            padding: const EdgeInsets.symmetric(
                              vertical:
                                  AppTheme.spacingSm + AppTheme.spacingXs,
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
      ),
    );
  }

  /// 邀請碼卡片
  Widget _buildInviteCodeCard(BuildContext context, bool isDark) {
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
      child: Row(
        children: [
          Icon(
            Icons.vpn_key_outlined,
            color: isDark ? AppColors.darkAccent : AppColors.accent,
            size: 20,
          ),
          const SizedBox(width: AppTheme.spacingSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '邀請碼',
                  style: AppTextStyles.caption(
                    color: isDark
                        ? AppColors.darkSecondaryText
                        : AppColors.secondaryText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _goal.inviteCode,
                  style: AppTextStyles.bodyBold(
                    color: isDark
                        ? AppColors.darkPrimaryText
                        : AppColors.primaryText,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: _goal.inviteCode));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('已複製邀請碼'),
                  backgroundColor:
                      isDark ? AppColors.darkSuccess : AppColors.success,
                ),
              );
            },
            icon: const Icon(Icons.copy, size: 20),
            tooltip: '複製邀請碼',
            color: isDark ? AppColors.darkAccent : AppColors.accent,
          ),
        ],
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
              Text(_goal.emoji, style: const TextStyle(fontSize: 28)),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: Text(_goal.name, style: AppTextStyles.cardTitle()),
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
                '/ \$${_formatAmount(_goal.targetAmount)}',
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
    final auth = context.read<AuthService>();
    final userId = auth.userId;

    // 找到目前使用者的成員資料
    final myMember = _goal.members.where((m) => m.userId == userId).toList();
    if (myMember.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('你不是此目標的成員'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final member = myMember.first;

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
              onPressed: () async {
                final amountText = controller.text.trim();
                if (amountText.isEmpty) return;

                Navigator.of(ctx).pop();

                try {
                  final depositAmount = Decimal.parse(amountText);
                  final newTotal = member.contributedAmount + depositAmount;

                  await _repo.updateContribution(
                    _goal.id,
                    member.id,
                    newTotal.toString(),
                  );

                  await _refresh();

                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('已存入 \$$amountText'),
                      backgroundColor:
                          isDark ? AppColors.darkSuccess : AppColors.success,
                    ),
                  );
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('存入失敗：$e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
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
