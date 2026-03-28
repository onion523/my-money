import { Env } from '../types';

/**
 * TODO: 實作真正的身份驗證
 * 目前為 pass-through，從 header 取得 user_id；
 * 正式上線時應改用 JWT / Cloudflare Access 驗證。
 */
export function authenticate(request: Request, _env: Env): string | null {
  // TODO: 驗證 Authorization header（JWT / API Key）
  // 暫時從自訂 header 取得 user_id，方便開發測試
  const userId = request.headers.get('X-User-Id');

  if (!userId) {
    return null;
  }

  return userId;
}

/** 驗證失敗時回傳 401 回應 */
export function unauthorizedResponse(): Response {
  return Response.json(
    { ok: false, error: '未授權：缺少 X-User-Id header' },
    { status: 401 }
  );
}
