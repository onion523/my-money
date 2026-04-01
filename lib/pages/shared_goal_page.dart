import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_money/data/repositories/shared_goal_repository.dart';
import 'package:my_money/pages/shared_goal_detail_page.dart';
import 'package:my_money/services/auth_service.dart';
import 'package:my_money/theme/app_colors.dart';
import 'package:my_money/theme/app_text_styles.dart';
import 'package:my_money/theme/app_theme.dart';

/// 共同儲蓄目標列表頁面
/// 顯示所有共同目標、空狀態、建立/加入按鈕
class SharedGoalPage extends StatefulWidget {
  const SharedGoalPage({super.key});

  @override
  State<SharedGoalPage> createState() => _SharedGoalPageState();
}

class _SharedGoalPageState extends State<SharedGoalPage> {
  late final SharedGoalRepository _repo;
  List<SharedGoalWithMembers> _goals = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _repo = SharedGoalRepository(context.read<AuthService>());
    _loadGoals();
  }

  Future<void> _loadGoals() async {
    setState(() => _loading = true);
    final goals = await _repo.getAllSharedGoals();
    if (!mounted) return;
    setState(() {
      _goals = goals;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        title: const Text('共同儲蓄'),
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: () => _showJoinDialog(context),
            icon: const Icon(Icons.group_add_outlined),
            tooltip: '加入共同目標',
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _goals.isEmpty
                ? _buildEmptyState(context, isDark)
                : RefreshIndicator(
                    onRefresh: _loadGoals,
                    child: ListView.builder(
                      padding: const EdgeInsets.all(AppTheme.spacingMd),
                      itemCount: _goals.length,
                      itemBuilder: (ctx, index) {
                        final goal = _goals[index];
                        return Padding(
                          padding: EdgeInsets.only(
                            bottom: index < _goals.length - 1
                                ? AppTheme.cardGap
                                : 0,
                          ),
                          child: _buildGoalCard(ctx, goal, isDark),
                        );
                      },
                    ),
                  ),
      ),
      floatingActionButton: _goals.isNotEmpty
          ? FloatingActionButton(
              onPressed: () => _showCreateDialog(context),
              backgroundColor:
                  isDark ? AppColors.darkAccent : AppColors.accent,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  /// 空狀態
  Widget _buildEmptyState(BuildContext context, bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.group_outlined,
                size: 40,
                color: AppColors.accent,
              ),
            ),
            const SizedBox(height: 24),
            Text('還沒有共同儲蓄目標', style: AppTextStyles.cardTitle()),
            const SizedBox(height: 8),
            Text(
              '和朋友一起存錢，達成共同目標',
              style: AppTextStyles.body(color: AppColors.secondaryText),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _showCreateDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('建立共同目標'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => _showJoinDialog(context),
              icon: const Icon(Icons.group_add_outlined),
              label: const Text('加入共同目標'),
              style: OutlinedButton.styleFrom(
                foregroundColor:
                    isDark ? AppColors.darkAccent : AppColors.accent,
                side: BorderSide(
                  color: (isDark ? AppColors.darkAccent : AppColors.accent)
                      .withValues(alpha: 0.4),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 目標卡片
  Widget _buildGoalCard(
    BuildContext context,
    SharedGoalWithMembers goal,
    bool isDark,
  ) {
    final progressColor = _getProgressColor(goal.progress);

    return GestureDetector(
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SharedGoalDetailPage(goal: goal),
          ),
        );
        // 返回時重新載入
        _loadGoals();
      },
      child: Container(
        padding:
            const EdgeInsets.all(AppTheme.cardPadding + AppTheme.spacingXs),
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
                Text(goal.emoji, style: const TextStyle(fontSize: 28)),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(goal.name, style: AppTextStyles.cardTitle()),
                ),
                Text(
                  '${(goal.progress * 100).toInt()}%',
                  style: AppTextStyles.bodyBold(color: progressColor),
                ),
              ],
            ),

            const SizedBox(height: AppTheme.spacingSm + AppTheme.spacingXs),

            // 進度條
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: goal.progress,
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
                  '\$${_formatAmount(goal.totalContributed)}',
                  style: AppTextStyles.amountMedium(
                    color: isDark
                        ? AppColors.darkPrimaryText
                        : AppColors.primaryText,
                  ),
                ),
                Text(
                  '/ \$${_formatAmount(goal.targetAmount)}',
                  style: AppTextStyles.caption(
                    color: isDark
                        ? AppColors.darkSecondaryText
                        : AppColors.secondaryText,
                  ),
                ),
              ],
            ),

            const SizedBox(height: AppTheme.spacingSm),

            // 成員頭像列
            Row(
              children: [
                Icon(
                  Icons.people_outline,
                  size: 16,
                  color: isDark
                      ? AppColors.darkSecondaryText
                      : AppColors.secondaryText,
                ),
                const SizedBox(width: 4),
                Text(
                  '${goal.members.length} 位成員',
                  style: AppTextStyles.caption(
                    color: isDark
                        ? AppColors.darkSecondaryText
                        : AppColors.secondaryText,
                  ),
                ),
                const Spacer(),
                const Icon(
                  Icons.chevron_right,
                  size: 20,
                  color: AppColors.secondaryText,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// 顯示建立共同目標 Dialog
  void _showCreateDialog(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final nameController = TextEditingController();
    final amountController = TextEditingController();
    String selectedEmoji = '\u{1F3AF}';

    final emojiOptions = [
      '\u{1F3AF}', // target
      '\u{2708}\u{FE0F}', // airplane
      '\u{1F3E0}', // house
      '\u{1F697}', // car
      '\u{1F381}', // gift
      '\u{1F389}', // party
      '\u{1F4B0}', // money bag
      '\u{1F30E}', // globe
    ];

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor:
                  isDark ? AppColors.darkSurface : AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTheme.modalRadius),
              ),
              title: Text(
                '建立共同目標',
                style: AppTextStyles.cardTitle(
                  color: isDark
                      ? AppColors.darkPrimaryText
                      : AppColors.primaryText,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Emoji 選擇
                    Text(
                      '選擇圖示',
                      style: AppTextStyles.caption(
                        color: isDark
                            ? AppColors.darkSecondaryText
                            : AppColors.secondaryText,
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    Wrap(
                      spacing: 8,
                      children: emojiOptions.map((emoji) {
                        final isSelected = emoji == selectedEmoji;
                        return GestureDetector(
                          onTap: () {
                            setDialogState(() => selectedEmoji = emoji);
                          },
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (isDark
                                          ? AppColors.darkAccent
                                          : AppColors.accent)
                                      .withValues(alpha: 0.2)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                              border: isSelected
                                  ? Border.all(
                                      color: isDark
                                          ? AppColors.darkAccent
                                          : AppColors.accent,
                                    )
                                  : null,
                            ),
                            alignment: Alignment.center,
                            child:
                                Text(emoji, style: const TextStyle(fontSize: 24)),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: AppTheme.spacingMd),
                    TextField(
                      controller: nameController,
                      decoration: const InputDecoration(
                        hintText: '目標名稱',
                        prefixIcon: Icon(Icons.edit_outlined),
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    TextField(
                      controller: amountController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        hintText: '目標金額',
                        prefixText: '\$ ',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('取消'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final name = nameController.text.trim();
                    final amount = amountController.text.trim();
                    if (name.isEmpty || amount.isEmpty) return;

                    Navigator.of(ctx).pop();
                    try {
                      final auth = context.read<AuthService>();
                      await _repo.createSharedGoal(
                        name: name,
                        targetAmount: amount,
                        emoji: selectedEmoji,
                        userName: auth.currentUser?.name,
                      );
                      _loadGoals();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('已建立：$name'),
                          backgroundColor:
                              isDark ? AppColors.darkSuccess : AppColors.success,
                        ),
                      );
                    } catch (e) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('建立失敗：$e'),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  },
                  child: const Text('建立'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  /// 顯示加入共同目標 Dialog
  void _showJoinDialog(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final codeController = TextEditingController();
    final auth = context.read<AuthService>();
    final userName = auth.currentUser?.name ?? '';

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.modalRadius),
          ),
          title: Text(
            '加入共同目標',
            style: AppTextStyles.cardTitle(
              color:
                  isDark ? AppColors.darkPrimaryText : AppColors.primaryText,
            ),
          ),
          content: TextField(
            controller: codeController,
            decoration: const InputDecoration(
              hintText: '輸入邀請碼',
              prefixIcon: Icon(Icons.vpn_key_outlined),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () async {
                final code = codeController.text.trim();
                if (code.isEmpty) return;

                Navigator.of(ctx).pop();
                try {
                  await _repo.joinByInviteCode(code, userName);
                  _loadGoals();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text('已成功加入共同目標'),
                      backgroundColor:
                          isDark ? AppColors.darkSuccess : AppColors.success,
                    ),
                  );
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('加入失敗：$e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              },
              child: const Text('加入'),
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
