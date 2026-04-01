import 'package:decimal/decimal.dart';
import 'package:my_money/services/api_client.dart';
import 'package:my_money/services/auth_service.dart';

/// 共同儲蓄成員資料模型
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

/// 共同儲蓄目標（含成員列表）
class SharedGoalWithMembers {
  /// 唯一識別碼
  final String id;

  /// 建立者 ID
  final String creatorId;

  /// 目標名稱
  final String name;

  /// 目標金額
  final Decimal targetAmount;

  /// Emoji 圖示
  final String emoji;

  /// 邀請碼
  final String inviteCode;

  /// 成員列表
  final List<SharedGoalMember> members;

  /// 建立時間
  final DateTime createdAt;

  /// 更新時間
  final DateTime updatedAt;

  const SharedGoalWithMembers({
    required this.id,
    required this.creatorId,
    required this.name,
    required this.targetAmount,
    required this.emoji,
    required this.inviteCode,
    required this.members,
    required this.createdAt,
    required this.updatedAt,
  });

  /// 成員已貢獻總額
  Decimal get totalContributed => members.fold(
        Decimal.zero,
        (sum, m) => sum + m.contributedAmount,
      );

  /// 進度百分比（0.0 ~ 1.0）
  double get progress => targetAmount > Decimal.zero
      ? (totalContributed / targetAmount).toDouble().clamp(0.0, 1.0)
      : 0.0;
}

/// 共同儲蓄目標資料存取層 — 透過後端 API 操作
class SharedGoalRepository {
  final AuthService _auth;

  SharedGoalRepository(this._auth);

  ApiClient get _api {
    final client = _auth.apiClient;
    if (client == null) throw ApiException('未登入', statusCode: 401);
    return client;
  }

  /// 取得所有共同儲蓄目標（API 失敗時回傳空列表）
  Future<List<SharedGoalWithMembers>> getAllSharedGoals() async {
    try {
      final res = await _api.get('/api/shared-goals');
      final list = res['data'] as List<dynamic>;
      return list
          .map((json) => _fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// 取得單一共同儲蓄目標
  Future<SharedGoalWithMembers?> getSharedGoal(String id) async {
    try {
      final res = await _api.get('/api/shared-goals/$id');
      final data = res['data'] as Map<String, dynamic>;
      return _fromJson(data);
    } catch (_) {
      return null;
    }
  }

  /// 建立共同儲蓄目標
  Future<void> createSharedGoal({
    required String name,
    required String targetAmount,
    required String emoji,
    String? userName,
  }) async {
    await _api.post('/api/shared-goals', {
      'name': name,
      'target_amount': targetAmount,
      'emoji': emoji,
      if (userName != null) 'user_name': userName,
    });
  }

  /// 更新共同儲蓄目標
  Future<void> updateSharedGoal(
    String id, {
    String? name,
    String? targetAmount,
    String? emoji,
  }) async {
    await _api.put('/api/shared-goals/$id', {
      if (name != null) 'name': name,
      if (targetAmount != null) 'target_amount': targetAmount,
      if (emoji != null) 'emoji': emoji,
    });
  }

  /// 刪除共同儲蓄目標
  Future<void> deleteSharedGoal(String id) async {
    await _api.delete('/api/shared-goals/$id');
  }

  /// 透過邀請碼加入共同儲蓄目標
  Future<void> joinByInviteCode(
    String inviteCode,
    String userName,
  ) async {
    await _api.post('/api/shared-goals/join', {
      'invite_code': inviteCode,
      'user_name': userName,
    });
  }

  /// 更新成員貢獻金額
  Future<void> updateContribution(
    String goalId,
    String memberId,
    String amount,
  ) async {
    await _api.put('/api/shared-goals/$goalId/members/$memberId', {
      'contributed_amount': amount,
    });
  }

  /// 移除成員
  Future<void> removeMember(String goalId, String memberId) async {
    await _api.delete('/api/shared-goals/$goalId/members/$memberId');
  }

  SharedGoalWithMembers _fromJson(Map<String, dynamic> json) {
    final membersJson = json['members'] as List<dynamic>? ?? [];
    final goalId = json['id'] as String;

    return SharedGoalWithMembers(
      id: goalId,
      creatorId: json['creator_id'] as String? ?? '',
      name: json['name'] as String,
      targetAmount: Decimal.parse((json['target_amount'] ?? '0').toString()),
      emoji: json['emoji'] as String? ?? '\u{1F3AF}',
      inviteCode: json['invite_code'] as String? ?? '',
      members: membersJson
          .map((m) => _memberFromJson(m as Map<String, dynamic>, goalId))
          .toList(),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  SharedGoalMember _memberFromJson(Map<String, dynamic> json, String goalId) {
    return SharedGoalMember(
      id: json['id'] as String,
      goalId: json['goal_id'] as String? ?? goalId,
      userId: json['user_id'] as String? ?? '',
      userName: json['user_name'] as String? ?? '',
      contributedAmount:
          Decimal.parse((json['contributed_amount'] ?? '0').toString()),
      joinedAt: DateTime.tryParse(json['joined_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}
