import 'package:flutter_test/flutter_test.dart';
import 'package:my_money/services/sync_service.dart';

void main() {
  late SyncService service;

  setUp(() {
    service = SyncService(
      baseUrl: 'http://localhost:8787',
      userId: 'test-user',
    );
  });

  tearDown(() {
    service.dispose();
  });

  group('handleConflict - LWW 衝突解決', () {
    test('local 較新 → 用 local', () {
      // 安排：local 時間較新
      final local = {
        'id': 'rec-1',
        'name': '本地版本',
        'updated_at': '2026-03-28T12:00:00Z',
      };
      final remote = {
        'id': 'rec-1',
        'name': '遠端版本',
        'updated_at': '2026-03-28T10:00:00Z',
      };

      // 執行
      final winner = service.handleConflict(local, remote);

      // 驗證：應使用 local
      expect(winner['name'], '本地版本');
      expect(winner['updated_at'], '2026-03-28T12:00:00Z');
    });

    test('remote 較新 → 用 remote', () {
      // 安排：remote 時間較新
      final local = {
        'id': 'rec-1',
        'name': '本地版本',
        'updated_at': '2026-03-28T08:00:00Z',
      };
      final remote = {
        'id': 'rec-1',
        'name': '遠端版本',
        'updated_at': '2026-03-28T15:00:00Z',
      };

      // 執行
      final winner = service.handleConflict(local, remote);

      // 驗證：應使用 remote
      expect(winner['name'], '遠端版本');
      expect(winner['updated_at'], '2026-03-28T15:00:00Z');
    });

    test('同 timestamp → 用 remote', () {
      // 安排：兩邊時間完全相同
      final local = {
        'id': 'rec-1',
        'name': '本地版本',
        'updated_at': '2026-03-28T10:00:00Z',
      };
      final remote = {
        'id': 'rec-1',
        'name': '遠端版本',
        'updated_at': '2026-03-28T10:00:00Z',
      };

      // 執行
      final winner = service.handleConflict(local, remote);

      // 驗證：時間相同時以 remote 為準
      expect(winner['name'], '遠端版本');
      expect(winner['updated_at'], '2026-03-28T10:00:00Z');
    });
  });
}
