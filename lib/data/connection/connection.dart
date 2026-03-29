// 平台條件匯入 — 自動選擇原生或 Web 的資料庫連線
export 'unsupported.dart'
    if (dart.library.ffi) 'native.dart'
    if (dart.library.js_interop) 'web.dart';
