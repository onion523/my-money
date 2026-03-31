import 'package:my_money/data/database.dart';
import 'package:my_money/services/api_client.dart';
import 'package:my_money/services/auth_service.dart';

/// 儲蓄目標資料存取層 — 透過後端 API 操作
class SavingsGoalRepository {
  final AuthService _auth;

  SavingsGoalRepository(this._auth);

  ApiClient get _api {
    final client = _auth.apiClient;
    if (client == null) throw ApiException('未登入', statusCode: 401);
    return client;
  }

  /// 取得所有儲蓄目標（API 失敗時回傳空列表）
  Future<List<SavingsGoal>> getAllGoals() async {
    try {
      final res = await _api.get('/api/savings-goals');
      final list = res['data'] as List<dynamic>;
      return list.map((json) => _fromJson(json as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  /// 監聽所有儲蓄目標變更（API 不支援 watch，回傳單次值串流）
  Stream<List<SavingsGoal>> watchAllGoals() {
    return Stream.fromFuture(getAllGoals());
  }

  /// 新增儲蓄目標
  Future<void> addGoal(SavingsGoalsCompanion entry) async {
    await _api.post('/api/savings-goals', {
      'id': entry.id.value,
      'name': entry.name.value,
      'target_amount': entry.targetAmount.value,
      'current_amount': entry.currentAmount.value,
      'category': entry.category.value,
      'deadline': entry.deadline.present && entry.deadline.value != null
          ? entry.deadline.value!.toIso8601String()
          : null,
      'monthly_reserve': entry.monthlyReserve.value,
      'emoji': entry.emoji.value,
    });
  }

  /// 更新儲蓄目標
  Future<void> updateGoal(SavingsGoal goal) async {
    await _api.put('/api/savings-goals/${goal.id}', {
      'name': goal.name,
      'target_amount': goal.targetAmount,
      'current_amount': goal.currentAmount,
      'category': goal.category,
      'deadline': goal.deadline?.toIso8601String(),
      'monthly_reserve': goal.monthlyReserve,
      'emoji': goal.emoji,
    });
  }

  /// 存入金額到儲蓄目標
  Future<void> depositToGoal(String goalId, String newCurrentAmount) async {
    await _api.put('/api/savings-goals/$goalId', {
      'current_amount': newCurrentAmount,
    });
  }

  /// 刪除儲蓄目標
  Future<void> deleteGoal(String id) async {
    await _api.delete('/api/savings-goals/$id');
  }

  SavingsGoal _fromJson(Map<String, dynamic> json) {
    return SavingsGoal(
      id: json['id'] as String,
      name: json['name'] as String,
      targetAmount: (json['target_amount'] ?? '0').toString(),
      currentAmount: (json['current_amount'] ?? '0').toString(),
      category: json['category'] as String? ?? '',
      deadline: json['deadline'] != null ? DateTime.tryParse(json['deadline'] as String) : null,
      monthlyReserve: (json['monthly_reserve'] ?? '0').toString(),
      emoji: json['emoji'] as String? ?? '🎯',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
