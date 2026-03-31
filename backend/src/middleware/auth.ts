import { Env } from '../types';
import { verifyToken } from '../handlers/auth';

/**
 * 身份驗證 middleware
 * 支援兩種方式：
 * 1. Authorization: Bearer <JWT> （正式）
 * 2. X-User-Id header （開發向下相容）
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<string | null> {
  // 優先使用 JWT
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, env);
    if (payload) {
      return payload.sub;
    }
    return null;
  }

  // 向下相容：X-User-Id header（開發用）
  const userId = request.headers.get('X-User-Id');
  return userId || null;
}

/** 驗證失敗時回傳 401 回應 */
export function unauthorizedResponse(): Response {
  return Response.json(
    { ok: false, error: '未授權：請先登入' },
    { status: 401 }
  );
}
