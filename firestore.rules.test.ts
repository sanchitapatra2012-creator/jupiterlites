/**
 * Phase 0 Dirty Dozen Security Rule Verification Spec
 * Maps all 12 adversarial payloads from security_spec.md against expected PERMISSION_DENIED outcomes.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenCases: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Admin Registration',
    operation: 'create',
    path: '/users/attackerUid',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attackerUid',
      fullName: 'Attacker',
      email: 'attacker@example.com',
      role: 'admin',
      status: 'active',
      emailVerified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Role Escalation Update',
    operation: 'update',
    path: '/users/attackerUid',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: { role: 'admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    operation: 'get',
    path: '/users/victimUid',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'User Directory Scrape',
    operation: 'list',
    path: '/users',
    auth: { uid: 'researcherUid', email: 'user@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/users/u1',
    auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: {
      uid: 'u1',
      fullName: 'Test User',
      email: 'u1@example.com',
      role: 'researcher',
      status: 'active',
      emailVerified: true,
      isSuperuser: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Notification Ownership Spoof',
    operation: 'create',
    path: '/notifications/notif1',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: {
      userId: 'victimUid',
      title: 'Alert',
      message: 'Spoofed',
      type: 'warning',
      read: false,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Notification Content Tampering',
    operation: 'update',
    path: '/notifications/notif1',
    auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: { message: 'Tampered message' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Audit Log Forgery',
    operation: 'create',
    path: '/activity_logs/log1',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: {
      userId: 'victimUid',
      action: 'DELETE_DATASET',
      resourceType: 'dataset',
      details: 'Forged log',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Audit Log Deletion by Non-Admin',
    operation: 'delete',
    path: '/activity_logs/log1',
    auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Admin Registry Poisoning',
    operation: 'create',
    path: '/admins/attackerUid',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attackerUid', email: 'attacker@example.com' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unverified Admin Email Spoof',
    operation: 'list',
    path: '/users',
    auth: { uid: 'spoofUid', email: 'patrasanchita2012@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: `/users/${'a'.repeat(300)}`,
    auth: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
