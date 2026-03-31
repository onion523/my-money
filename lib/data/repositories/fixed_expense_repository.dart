import 'package:my_money/data/database.dart';
import 'package:my_money/services/api_client.dart';
import 'package:my_money/services/auth_service.dart';

/// 固定收支資料存取層 — 透過後端 API 操作
class FixedExpenseRepository {
  final AuthService _auth;

  FixedExpenseRepository(this._auth);

  ApiClient get _api {
    final client = _auth.apiClient;
    if (client == null) throw ApiException('未登入', statusCode: 401);
    return client;
  }

  /// 取得所有固定收支
  Future<List<FixedExpense>> getAllFixedExpenses() async {
    try {
      final res = await _api.get('/api/fixed-expenses');
      final list = res['data'] as List<dynamic>;
      return list.map((json) => _fromJson(json as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  /// 監聽所有固定收支變更
  Stream<List<FixedExpense>> watchAllFixedExpenses() {
    return Stream.fromFuture(getAllFixedExpenses());
  }

  /// 新增固定收支
  Future<void> createFixedExpense(FixedExpensesCompanion entry) async {
    await _api.post('/api/fixed-expenses', _toJson(entry));
  }

  /// 更新固定收支
  Future<void> updateFixedExpense(FixedExpense item) async {
    await _api.put('/api/fixed-expenses/${item.id}', {
      'name': item.name,
      'type': item.type,
      'amount': item.amount,
      'cycle': item.cycle,
      'due_date': item.dueDate.toIso8601String(),
      'due_day': item.dueDate.day,
      'payment_method': item.paymentMethod,
      'reserved_amount': item.reservedAmount,
    });
  }

  /// 刪除固定收支
  Future<void> deleteFixedExpense(String id) async {
    await _api.delete('/api/fixed-expenses/$id');
  }

  FixedExpense _fromJson(Map<String, dynamic> json) {
    return FixedExpense(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String? ?? 'expense',
      amount: (json['amount'] ?? '0').toString(),
      cycle: json['cycle'] as String? ?? 'monthly',
      dueDate: DateTime.tryParse(json['due_date'] as String? ?? '') ?? DateTime.now(),
      paymentMethod: json['payment_method'] as String? ?? '',
      reservedAmount: (json['reserved_amount'] ?? '0').toString(),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> _toJson(FixedExpensesCompanion entry) {
    return {
      'id': entry.id.value,
      'name': entry.name.value,
      'type': entry.type.value,
      'amount': entry.amount.value,
      'cycle': entry.cycle.value,
      'due_date': entry.dueDate.value.toIso8601String(),
      'due_day': entry.dueDate.value.day,
      'payment_method': entry.paymentMethod.value,
      'reserved_amount': entry.reservedAmount.value,
    };
  }
}
