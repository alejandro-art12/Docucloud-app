# Docucloud Firestore Security Specification & Red Team Audit

## 1. Data Invariants
1. **Strict Account Isolation (PII & Documents):** Every document in `/users/{userId}` can only be read (`get`), created, or updated by `request.auth.uid == userId` with `email_verified == true` for writes. `list` and `delete` on `/users` are strictly denied (`if false`).
2. **Document Ownership & Query Enforcer:** Every document in `/documents/{documentId}` must have `userId == request.auth.uid`. Both `get` and `list` verify `resource.data.userId == request.auth.uid` so un-scoped queries are rejected server-side.
3. **10 GB Storage Quota Invariant (`10,737,418,240` bytes):**
   - `maxStorageBytes` is strictly fixed at `10737418240` and immutable.
   - `usedStorageBytes` initializes at `0` on user creation and must always satisfy `0 <= usedStorageBytes <= 10737418240`.
   - Document creation requires an atomic batch update (`getAfter`) on `/users/$(request.auth.uid)` incrementing `usedStorageBytes` by `incoming().sizeBytes` without exceeding `10737418240`.
   - Document deletion requires an atomic batch update (`existsAfter` / `getAfter`) on `/users/$(request.auth.uid)` keeping `usedStorageBytes >= 0`.
4. **Temporal & Immutable Field Integrity:** `createdAt` and `uploadedAt` must equal `request.time` on creation and remain immutable on updates. `updatedAt` must always equal `request.time`. `uid`, `userId`, `sizeBytes`, and `type` are immutable after document creation.
5. **Schema & Boundary Hardening:** Every string field enforces strict `.size()` bounds and regex patterns where applicable; `hasAll` and `hasOnly` block shadow/ghost fields.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing on User Create:** Authenticated `userA` attempts to create `/users/userB` or set `uid: "userB"`.
2. **Unverified Email Write:** Authenticated `userA` with `email_verified: false` attempts to create `/users/userA`.
3. **PII Blanket Read Attack:** Authenticated `userB` attempts `get(/users/userA)` or `list(/users)` to harvest emails/phones.
4. **Quota Tampering on Registration:** `userA` attempts to create `/users/userA` with `maxStorageBytes: 999999999999` or `usedStorageBytes: -500`.
5. **Shadow / Ghost Field Injection:** `userA` updates `/users/userA` including an undeclared `isAdmin: true` field.
6. **Orphaned / Non-Atomic Document Upload:** `userA` creates `/documents/doc1` without atomically incrementing `/users/userA.usedStorageBytes` in the same batch.
7. **10 GB Quota Overflow Bypass:** `userA` attempts a batch creating `/documents/docOverflow` (`sizeBytes: 5000000000`) when `usedStorageBytes` is already `8000000000` (`newTotal > 10737418240`).
8. **Cross-Tenant Document Scraping:** `userB` executes an unfiltered `list(/documents)` or `get(/documents/docOwnedByA)`.
9. **Invalid Category Enum Poisoning:** `userA` attempts to create a document with `category: "HackedCategory"`.
10. **Immutable Field Mutation on Document Update:** `userA` attempts to update `sizeBytes` from `5000000` to `1` or change `userId` during a rename.
11. **Client Timestamp Forgery:** `userA` supplies a past/future timestamp (`Timestamp.fromMillis(1000000)`) instead of `request.time` (`serverTimestamp()`).
12. **Resource Exhaustion / ID Poisoning:** `userA` attempts to create a document with a 300-character ID or a 5,000-character `name` string.

## 3. Red Team Audit Conflict Report

| Collection | Check | Result | Gate Enforcing Protection |
| :--- | :--- | :--- | :--- |
| `/users/{userId}` | Identity Spoofing | PASS | `request.auth.uid == userId && data.uid == request.auth.uid` |
| `/users/{userId}` | Email Spoofing | PASS | `isVerifiedUser()` enforces `request.auth.token.email_verified == true` |
| `/users/{userId}` | PII Blanket Read | PASS | `allow get: if isSignedIn() && isValidId(userId) && request.auth.uid == userId; allow list: if false;` |
| `/users/{userId}` | Shadow Update | PASS | `isValidUser(incoming())` + `affectedKeys().hasOnly(...)` |
| `/users/{userId}` | Value Poisoning | PASS | `isValidUser(incoming())` wraps all `allow update` branches |
| `/documents/{documentId}` | Query Trust | PASS | `allow list: if isSignedIn() && existing().userId == request.auth.uid;` |
| `/documents/{documentId}` | Quota Desync | PASS | `getAfter(/databases/$(database)/documents/users/$(incoming().userId)).data.usedStorageBytes == get(...).data.usedStorageBytes + incoming().sizeBytes` |
| `/documents/{documentId}` | Resource Poisoning | PASS | `isValidId(documentId)` + `.size()` checks on every string |
