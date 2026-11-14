import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';
import { hashPassword } from '../src/middleware/jwt';

describe('Auth & OAuth 2.1 (#194)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.dispose();
  });

  describe('#195 PBKDF2 password hashing & legacy migration', () => {
    it('registers new accounts with versioned PBKDF2-SHA256 hash and allows login', async () => {
      const regRes = await h.request('/auth/register', {
        method: 'POST',
        body: { email: 'pbkdf2-new@x.com', password: 'secret-password', name: 'NewUser' },
      });
      expect(regRes.status).toBe(201);
      expect(regRes.json.success).toBe(true);
      expect(regRes.json.data.token).toBeTruthy();

      const row = await h.db
        .prepare('SELECT password_hash, salt FROM users WHERE email = ?')
        .bind('pbkdf2-new@x.com')
        .first<{ password_hash: string; salt: string }>();
      expect(row).toBeTruthy();
      expect(row!.password_hash.startsWith('pbkdf2$100000$')).toBe(true);
      expect(row!.salt.length).toBe(32);

      const loginRes = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'pbkdf2-new@x.com', password: 'secret-password' },
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.json.success).toBe(true);
    });

    it('rejects wrong password on legacy SHA-256 account without migrating hash', async () => {
      const legacySalt = '00112233445566778899aabbccddeeff';
      const legacyHash = await hashPassword('old-pass-123', legacySalt);
      await h.db
        .prepare('INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
        .bind('u_legacy_1', 'legacy1@x.com', 'Legacy1', legacyHash, legacySalt)
        .run();

      const badRes = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'legacy1@x.com', password: 'wrong-password' },
      });
      expect(badRes.status).toBe(401);
      expect(badRes.json.success).toBe(false);

      const rowAfterBad = await h.db
        .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
        .bind('u_legacy_1')
        .first<{ password_hash: string; salt: string }>();
      expect(rowAfterBad!.password_hash).toBe(legacyHash);
      expect(rowAfterBad!.salt).toBe(legacySalt);
    });

    it('transparently migrates legacy SHA-256 hash to PBKDF2 upon successful login', async () => {
      const legacySalt = 'ffeeddccbbaa99887766554433221100';
      const legacyHash = await hashPassword('migrate-me-123', legacySalt);
      await h.db
        .prepare('INSERT INTO users (id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
        .bind('u_legacy_2', 'legacy2@x.com', 'Legacy2', legacyHash, legacySalt)
        .run();

      const loginRes1 = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'legacy2@x.com', password: 'migrate-me-123' },
      });
      expect(loginRes1.status).toBe(200);
      expect(loginRes1.json.success).toBe(true);

      const rowAfterLogin = await h.db
        .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
        .bind('u_legacy_2')
        .first<{ password_hash: string; salt: string }>();
      expect(rowAfterLogin!.password_hash.startsWith('pbkdf2$100000$')).toBe(true);
      expect(rowAfterLogin!.salt).not.toBe(legacySalt);

      // Subsequent login with migrated PBKDF2 hash still succeeds
      const loginRes2 = await h.request('/auth/login', {
        method: 'POST',
        body: { email: 'legacy2@x.com', password: 'migrate-me-123' },
      });
      expect(loginRes2.status).toBe(200);
      expect(loginRes2.json.success).toBe(true);
    });
  });
});
