import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { studentProfiles, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { UserRole } from '../utils/domainLogic.ts';

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_SESSION_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface SessionPayload {
  userId: number;
  email: string;
  role: UserRole;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(data)
      .digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedUser {
  id: number;
  uid: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  currentUser?: AuthenticatedUser;
}

const INITIAL_ADMIN_EMAIL = 'abidinkeren143@gmail.com';

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  displayName?: string | null,
  photoURL?: string | null
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingByUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (existingByUid.length > 0) {
    return existingByUid[0];
  }

  const existingByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existingByEmail.length > 0) {
    const updated = await db
      .update(users)
      .set({
        uid,
        isEmailVerified: true,
        avatarUrl: existingByEmail[0].avatarUrl || photoURL || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail[0].id))
      .returning();
    return updated[0];
  }

  const assignedRole: UserRole = normalizedEmail === INITIAL_ADMIN_EMAIL ? 'admin' : 'student';
  const inserted = await db
    .insert(users)
    .values({
      uid,
      email: normalizedEmail,
      fullName: displayName || normalizedEmail.split('@')[0],
      role: assignedRole,
      avatarUrl: photoURL || null,
      isEmailVerified: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { uid, isEmailVerified: true, updatedAt: new Date() },
    })
    .returning();

  const created = inserted[0];
  if (created.role === 'student') {
    await db
      .insert(studentProfiles)
      .values({
        userId: created.id,
        educationLevel: 'SMA/SMK',
        parentalConsentGiven: true,
      })
      .onConflictDoNothing();
  }
  return created;
}

async function resolveBearerUser(authHeader?: string): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  // 1. Check custom HMAC session token
  const session = verifySessionToken(token);
  if (session) {
    const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive || user.deletedAt) return null;
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
    };
  }

  // 2. Fallback to Firebase ID token verification
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email) return null;
    const user = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email,
      decoded.name,
      decoded.picture
    );
    if (!user.isActive || user.deletedAt) return null;
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
    };
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const user = await resolveBearerUser(req.headers.authorization);
    if (user) {
      req.currentUser = user;
    }
  } catch {
    // Ignore optional auth failures
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveBearerUser(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk mengakses fitur ini.' });
    }
    req.currentUser = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi autentikasi tidak valid atau telah berakhir.' });
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }
    if (!allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).json({
        error: 'Akses ditolak. Peran akun Anda tidak memiliki izin untuk halaman atau aksi ini.',
      });
    }
    next();
  };
};

// Lightweight per-IP sliding-window rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || entry.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Terlalu banyak permintaan dalam waktu singkat. Silakan coba beberapa saat lagi.',
      });
    }
    entry.count += 1;
    next();
  };
}
