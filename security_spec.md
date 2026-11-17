# NOCTA Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership & Role Integrity**: No user may self-assign `role` other than `'user'` in `/users/{userId}` or create an `/admins/{userId}` document unless they are a verified `super_admin` or the verified platform bootstrap owner.
2. **PII & Intimate Data Isolation**: Emails, age confirmations, personal boundaries, and couple session responses are isolated from public or blanket reads. Admins cannot read couple intimate session responses or user personal boundaries.
3. **Couple Membership Gate**: Every subcollection under `/couples/{coupleId}` (`history`, `favorites`, `sessions`) verifies membership against the parent `/couples/{coupleId}` document via `get()`.
4. **Anti-Repetition Ledger Permanence**: `/couples/{coupleId}/history/{activityId}` cannot be deleted by users on sign-out, and `activityId` serves as the document key to prevent duplicate history entries.
5. **Immutable Audit Trail**: `/admin_logs/{logId}` documents cannot be updated or deleted by anyone.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on protected writes must equal `request.time`.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Privilege Escalation on User Create**: Creating `/users/attacker` with `{ role: 'super_admin' }`.
2. **Self-Privilege Escalation on User Update**: Updating `/users/victim` `role` from `'user'` to `'admin'`.
3. **Admin Registry Spoofing**: Non-admin creating `/admins/attacker` with `{ role: 'super_admin' }`.
4. **PII Blanket Read**: Signed-in non-owner reading `/users/victim/private/profile`.
5. **Shadow Field Injection on Activity Create**: Admin creating `/activities/act1` with extra ghost field `ghostFlag: true`.
6. **ID Poisoning**: Creating `/activities/<1500_char_string>` or IDs with invalid characters (`../etc`).
7. **Unverified Email Write**: Writing to `/users/attacker` when `request.auth.token.email_verified == false`.
8. **Forged Timestamp**: Creating `/admin_logs/log1` with a backdated `createdAt` not equal to `request.time`.
9. **Couple Subcollection Intrusion**: Non-member reading or writing `/couples/couple1/history/act1`.
10. **Invite Scraping**: Running a `list` query on `/couple_invites` without filtering by `inviterId == request.auth.uid`.
11. **History Deletion**: Couple member attempting `delete` on `/couples/couple1/history/act1`.
12. **Audit Log Tampering**: Admin attempting `update` or `delete` on `/admin_logs/log1`.
