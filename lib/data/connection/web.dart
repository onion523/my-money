import 'package:drift/drift.dart';
import 'package:drift/web.dart';

/// Web 平台的資料庫連線 — 使用 IndexedDB 儲存
QueryExecutor openConnection() {
  return WebDatabase('my_money');
}
