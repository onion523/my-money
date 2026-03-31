import 'package:my_money/data/database.dart';
import 'package:my_money/services/api_client.dart';
import 'package:my_money/services/auth_service.dart';

/// 交易紀錄資料存取層 — 透過後端 API 操作
class TransactionRepository {
  final AuthService _auth;

  TransactionRepository(this._auth);

  ApiClient get _api {
    final client = _auth.apiClient;
    if (client == null) throw ApiException('未登入', statusCode: 401);
    return client;
  }

  /// 取得所有交易紀錄（API 失敗時回傳空列表）
  Future<List<Transaction>> getAllTransactions() async {
    try {
      final res = await _api.get('/api/transactions');
      final list = res['data'] as List<dynamic>;
      final transactions = list.map((json) => _fromJson(json as Map<String, dynamic>)).toList();
      transactions.sort((a, b) => b.date.compareTo(a.date));
      return transactions;
    } catch (_) {
      return [];
    }
  }

  /// 監聽所有交易紀錄變更（API 不支援 watch，回傳單次值串流）
  Stream<List<Transaction>> watchAllTransactions() {
    return Stream.fromFuture(getAllTransactions());
  }

  /// 取得指定月份的交易紀錄
  Future<List<Transaction>> getTransactionsByMonth(int year, int month) async {
    final all = await getAllTransactions();
    return all.where((t) => t.date.year == year && t.date.month == month).toList();
  }

  /// 取得指定分類的交易紀錄
  Future<List<Transaction>> getTransactionsByCategory(String category) async {
    final all = await getAllTransactions();
    return all.where((t) => t.category == category).toList();
  }

  /// 新增交易紀錄
  Future<void> addTransaction(TransactionsCompanion entry) async {
    await _api.post('/api/transactions', {
      'id': entry.id.value,
      'type': entry.type.value,
      'amount': entry.amount.value,
      'date': entry.date.value.toIso8601String().split('T').first,
      'note': entry.note.value,
      'category': entry.category.value,
      'account_id': entry.accountId.present ? entry.accountId.value : null,
    });
  }

  /// 更新交易紀錄
  Future<void> updateTransaction(Transaction tx) async {
    await _api.put('/api/transactions/${tx.id}', {
      'type': tx.type,
      'amount': tx.amount,
      'date': tx.date.toIso8601String().split('T').first,
      'note': tx.note,
      'category': tx.category,
      'account_id': tx.accountId,
    });
  }

  /// 刪除交易紀錄
  Future<void> deleteTransaction(String id) async {
    await _api.delete('/api/transactions/$id');
  }

  Transaction _fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      type: json['type'] as String? ?? 'expense',
      amount: (json['amount'] ?? '0').toString(),
      date: DateTime.tryParse(json['date'] as String? ?? '') ?? DateTime.now(),
      note: json['note'] as String? ?? '',
      category: json['category'] as String? ?? '',
      accountId: json['account_id'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
