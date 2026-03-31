import 'package:my_money/data/database.dart';
import 'package:my_money/services/api_client.dart';
import 'package:my_money/services/auth_service.dart';

/// 帳戶資料存取層 — 透過後端 API 操作
class AccountRepository {
  final AuthService _auth;

  AccountRepository(this._auth);

  ApiClient get _api {
    final client = _auth.apiClient;
    if (client == null) throw ApiException('未登入', statusCode: 401);
    return client;
  }

  /// 取得所有帳戶（API 失敗時回傳空列表）
  Future<List<Account>> getAllAccounts() async {
    try {
      final res = await _api.get('/api/accounts');
      final list = res['data'] as List<dynamic>;
      return list
          .map((json) => _fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// 監聽所有帳戶變更（API 不支援 watch，回傳單次值串流）
  Stream<List<Account>> watchAllAccounts() {
    return Stream.fromFuture(getAllAccounts());
  }

  /// 新增帳戶
  Future<void> addAccount(AccountsCompanion entry) async {
    await _api.post('/api/accounts', {
      'id': entry.id.value,
      'name': entry.name.value,
      'type': entry.type.value,
      'account_number':
          entry.accountNumber.present ? entry.accountNumber.value : '',
      'balance': entry.balance.value,
      'billing_date':
          entry.billingDate.present ? entry.billingDate.value : null,
      'payment_date':
          entry.paymentDate.present ? entry.paymentDate.value : null,
      'billed_amount':
          entry.billedAmount.present ? entry.billedAmount.value : null,
      'unbilled_amount':
          entry.unbilledAmount.present ? entry.unbilledAmount.value : null,
    });
  }

  /// 更新帳戶
  Future<void> updateAccount(Account account) async {
    await _api.put('/api/accounts/${account.id}', {
      'name': account.name,
      'type': account.type,
      'account_number': account.accountNumber,
      'balance': account.balance,
      'billing_date': account.billingDate,
      'payment_date': account.paymentDate,
      'billed_amount': account.billedAmount,
      'unbilled_amount': account.unbilledAmount,
    });
  }

  /// 刪除帳戶
  Future<void> deleteAccount(String id) async {
    await _api.delete('/api/accounts/$id');
  }

  Account _fromJson(Map<String, dynamic> json) {
    return Account(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String? ?? 'bank',
      accountNumber: json['account_number'] as String? ?? '',
      balance: (json['balance'] ?? '0').toString(),
      billingDate: json['billing_date'] as int?,
      paymentDate: json['payment_date'] as int?,
      billedAmount: json['billed_amount'] as String?,
      unbilledAmount: json['unbilled_amount'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}
