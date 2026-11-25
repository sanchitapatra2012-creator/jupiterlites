# EcoDNA Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **User Identity & Role Integrity**: A user document at `/users/{userId}` can only be created by the authenticated owner (`request.auth.uid == userId`), must carry `uid == request.auth.uid`, must initialize `role == "researcher"` and `status == "active"`, and cannot self-escalate `role` or `status` on update.
2. **PII Isolation**: User profile documents contain `email` and `fullName` (PII). Reads (`get`) are restricted to `isOwner(userId)` or `isAdmin()`. Blanket `list` queries on `/users` are strictly restricted to `isAdmin()`.
3. **Notification Isolation**: Every `/notifications/{notificationId}` document must belong to `request.auth.uid` on create/list/get/delete, and regular users may only mutate the `read` boolean field.
4. **Immutable Audit Trail**: `/activity_logs/{logId}` documents must carry `userId == request.auth.uid` and `createdAt == request.time` on creation, and cannot be updated or deleted by non-admin users.
5. **Admin Authority Isolation**: `/admins/{userId}` cannot be created, updated, or deleted from any client SDK. `/system_settings/{settingId}` writes are strictly restricted to `isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Registration**: `create /users/attackerUid` with `{ uid: "attackerUid", role: "admin", status: "active", ... }` -> `PERMISSION_DENIED`
2. **Role Escalation Update**: `update /users/attackerUid` changing `{ role: "admin" }` -> `PERMISSION_DENIED`
3. **Cross-User PII Read**: `get /users/victimUid` as `attackerUid` -> `PERMISSION_DENIED`
4. **User Directory Scrape**: `list /users` as standard `researcher` -> `PERMISSION_DENIED`
5. **Shadow Ghost Field Injection**: `create /users/u1` with extra `{ isSuperuser: true }` -> `PERMISSION_DENIED`
6. **Notification Ownership Spoof**: `create /notifications/n1` with `{ userId: "victimUid", ... }` as `attackerUid` -> `PERMISSION_DENIED`
7. **Notification Content Tampering**: `update /notifications/n1` modifying `message` instead of `read` -> `PERMISSION_DENIED`
8. **Audit Log Forgery**: `create /activity_logs/l1` with `{ userId: "victimUid", ... }` as `attackerUid` -> `PERMISSION_DENIED`
9. **Audit Log Deletion**: `delete /activity_logs/l1` as non-admin owner -> `PERMISSION_DENIED`
10. **Admin Registry Poisoning**: `create /admins/attackerUid` as `attackerUid` -> `PERMISSION_DENIED`
11. **Unverified Admin Email Spoof**: Request with `token.email == "patrasanchita2012@gmail.com"` and `token.email_verified == false` calling `list /users` -> `PERMISSION_DENIED`
12. **Path ID Poisoning**: `create /users/bad$id/with/slashes` or 1.5KB ID string -> `PERMISSION_DENIED`
