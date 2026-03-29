import 'package:drift/drift.dart';

/// 不支援的平台 — 拋出錯誤
QueryExecutor openConnection() {
  throw UnsupportedError('此平台不支援資料庫連線');
}
