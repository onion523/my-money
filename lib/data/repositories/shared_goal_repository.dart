import 'package:decimal/decimal.dart';

/// 共同儲蓄成員資料模型（與資料庫解耦，方便 mock）
class SharedGoalMember {
  /// 唯一識別碼
  final String id;

  /// 關聯的儲蓄目標 ID
  final String goalId;

  /// 使用者 ID
  final String userId;

  /// 使用者名稱
  final String userName;

  /// 已貢獻金額
  final Decimal contributedAmount;

  /// 加入時間
  final DateTime joinedAt;

  const SharedGoalMember({
    required this.id,
    required this.goalId,
    required this.userId,
    required this.userName,
    required this.contributedAmount,
    required this.joinedAt,
  });
}

/// 共同儲蓄目標資料存取層 — 管理共同儲蓄的成員與貢獻
///
/// 目前使用 mock 資料，正式環境改接資料庫
class SharedGoalRepository {
  /// 取得目標的所有成員
  Future<List<SharedGoalMember>> getMembers(String goalId) async {
    // TODO: 正式環境改接 drift 資料庫查詢
    return _mockMembers
        .where((m) => m.goalId == goalId)
        .toList();
  }

  /// 新增成員
  Future<void> addMember(SharedGoalMember member) async {
    // TODO: 正式環境改接 drift 資料庫 insert
    _mockMembers.add(member);
  }

  /// 更新成員貢獻金額
  Future<void> updateContribution(
    String memberId,
    Decimal newAmount,
  ) async {
    // TODO: 正式環境改接 drift 資料庫 update
    final index = _mockMembers.indexWhere((m) => m.id == memberId);
    if (index >= 0) {
      final old = _mockMembers[index];
      _mockMembers[index] = SharedGoalMember(
        id: old.id,
        goalId: old.goalId,
        userId: old.userId,
        userName: old.userName,
        contributedAmount: newAmount,
        joinedAt: old.joinedAt,
      );
    }
  }

  /// 移除成員
  Future<void> removeMember(String memberId) async {
    // TODO: 正式環境改接 drift 資料庫 delete
    _mockMembers.removeWhere((m) => m.id == memberId);
  }

  /// Mock 資料：3 個成員
  final List<SharedGoalMember> _mockMembers = [
    SharedGoalMember(
      id: 'member-1',
      goalId: 'shared-goal-1',
      userId: 'user-me',
      userName: '你',
      contributedAmount: Decimal.parse('12000'),
      joinedAt: DateTime(2026, 1, 15),
    ),
    SharedGoalMember(
      id: 'member-2',
      goalId: 'shared-goal-1',
      userId: 'user-ming',
      userName: '小明',
      contributedAmount: Decimal.parse('8200'),
      joinedAt: DateTime(2026, 1, 20),
    ),
    SharedGoalMember(
      id: 'member-3',
      goalId: 'shared-goal-1',
      userId: 'user-mei',
      userName: '小美',
      contributedAmount: Decimal.parse('7000'),
      joinedAt: DateTime(2026, 2, 1),
    ),
  ];
}
