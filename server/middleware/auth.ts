import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface FirebaseConfigFile {
  projectId?: string;
}

function loadProjectId(): string | null {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as FirebaseConfigFile;
    if (!parsed.projectId || parsed.projectId === 'remixed-project-id') {
      return null;
    }
    return parsed.projectId;
  } catch {
    return null;
  }
}

const firebaseProjectId = loadProjectId();
const adminApp = firebaseProjectId
  ? getApps().length > 0
    ? getApp()
    : initializeApp({ projectId: firebaseProjectId })
  : null;

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isAdmin: boolean;
  role: 'researcher' | 'admin';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Server-side trusted admin directory (combined with Firebase custom claims & env ADMIN_EMAILS)
const ADMIN_REGISTRY_PATH = path.resolve(process.cwd(), 'data', 'admin-registry.json');

interface AdminRegistryData {
  adminUids: string[];
  suspendedUids: string[];
}

function readRegistry(): AdminRegistryData {
  try {
    if (!fs.existsSync(ADMIN_REGISTRY_PATH)) {
      return { adminUids: [], suspendedUids: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(ADMIN_REGISTRY_PATH, 'utf-8')) as Partial<AdminRegistryData>;
    return {
      adminUids: Array.isArray(parsed.adminUids) ? parsed.adminUids : [],
      suspendedUids: Array.isArray(parsed.suspendedUids) ? parsed.suspendedUids : [],
    };
  } catch {
    return { adminUids: [], suspendedUids: [] };
  }
}

function writeRegistry(data: AdminRegistryData): void {
  const dir = path.dirname(ADMIN_REGISTRY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ADMIN_REGISTRY_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getTrustedAdminEmails(): Set<string> {
  const emails = new Set<string>(['patrasanchita2012@gmail.com']);
  const envEmails = process.env.ADMIN_EMAILS ?? '';
  for (const entry of envEmails.split(',')) {
    const trimmed = entry.trim().toLowerCase();
    if (trimmed) emails.add(trimmed);
  }
  return emails;
}

export function isUidSuspended(uid: string): boolean {
  return readRegistry().suspendedUids.includes(uid);
}

export function setUidSuspended(uid: string, suspended: boolean): void {
  const reg = readRegistry();
  const next = new Set(reg.suspendedUids);
  if (suspended) next.add(uid);
  else next.delete(uid);
  writeRegistry({ ...reg, suspendedUids: Array.from(next) });
}

export function setUidAdminRole(uid: string, makeAdmin: boolean): void {
  const reg = readRegistry();
  const next = new Set(reg.adminUids);
  if (makeAdmin) next.add(uid);
  else next.delete(uid);
  writeRegistry({ ...reg, adminUids: Array.from(next) });
}

export async function trySetFirebaseCustomClaims(uid: string, role: 'researcher' | 'admin'): Promise<boolean> {
  if (!adminApp) return false;
  try {
    await getAuth(adminApp).setCustomUserClaims(uid, {
      role,
      admin: role === 'admin',
    });
    return true;
  } catch {
    // Expected on Starter Tier projects without IAM Firebase Auth Admin grants;
    // server registry still enforces authorization authoritatively.
    return false;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!adminApp) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization token.' });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty authorization token.' });
    return;
  }

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(idToken);
    if (isUidSuspended(decoded.uid)) {
      res.status(403).json({ error: 'Account has been suspended by an administrator.' });
      return;
    }

    const email = (decoded.email ?? '').toLowerCase();
    const emailVerified = Boolean(decoded.email_verified);
    const trustedEmails = getTrustedAdminEmails();
    const reg = readRegistry();

    const hasAdminClaim = decoded.admin === true || decoded.role === 'admin';
    const isTrustedEmailAdmin = emailVerified && trustedEmails.has(email);
    const isRegistryAdmin = reg.adminUids.includes(decoded.uid);
    const isAdmin = hasAdminClaim || isTrustedEmailAdmin || isRegistryAdmin;

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: typeof decoded.name === 'string' ? decoded.name : email.split('@')[0] || 'Researcher',
      emailVerified,
      isAdmin,
      role: isAdmin ? 'admin' : 'researcher',
    };

    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    res.status(401).json({ error: `Unauthorized: ${message}` });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    return;
  }
  next();
}
