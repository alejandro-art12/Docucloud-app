/**
 * Firestore Security Rules Test Suite ("Dirty Dozen" Adversarial Verification)
 * Verifies all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */
import {
  initializeTestEnvironment,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

const MAX_STORAGE = 10737418240;

export async function runDirtyDozenSecurityTests() {
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'docucloud-security-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', 'userA'), {
        uid: 'userA',
        fullName: 'Carlos Mendoza',
        email: 'carlos@docucloud.com',
        usedStorageBytes: 8000000000,
        maxStorageBytes: MAX_STORAGE,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await setDoc(doc(adminDb, 'documents', 'docA1'), {
        userId: 'userA',
        name: 'Contrato_2026.pdf',
        category: 'Personales',
        type: 'pdf',
        sizeBytes: 102400,
        starred: false,
        uploadedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });

    const userACtx = testEnv.authenticatedContext('userA', {
      email: 'carlos@docucloud.com',
      email_verified: true,
    });
    const userBCtx = testEnv.authenticatedContext('userB', {
      email: 'other@docucloud.com',
      email_verified: true,
    });
    const unverifiedCtx = testEnv.authenticatedContext('userUnverified', {
      email: 'spoof@docucloud.com',
      email_verified: false,
    });

    const dbA = userACtx.firestore();
    const dbB = userBCtx.firestore();
    const dbUnverified = unverifiedCtx.firestore();

    // 1. Identity Spoofing on User Create
    await assertFails(
      setDoc(doc(dbA, 'users', 'userB'), {
        uid: 'userB',
        fullName: 'Spoofed',
        email: 'spoof@docucloud.com',
        usedStorageBytes: 0,
        maxStorageBytes: MAX_STORAGE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 2. Unverified Email Write
    await assertFails(
      setDoc(doc(dbUnverified, 'users', 'userUnverified'), {
        uid: 'userUnverified',
        fullName: 'Unverified User',
        email: 'spoof@docucloud.com',
        usedStorageBytes: 0,
        maxStorageBytes: MAX_STORAGE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 3. PII Blanket Read Attack
    await assertFails(getDoc(doc(dbB, 'users', 'userA')));
    await assertFails(getDocs(collection(dbB, 'users')));

    // 4. Quota Tampering on Registration
    await assertFails(
      setDoc(doc(dbB, 'users', 'userB'), {
        uid: 'userB',
        fullName: 'Cheater',
        email: 'other@docucloud.com',
        usedStorageBytes: 0,
        maxStorageBytes: 999999999999,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 5. Shadow / Ghost Field Injection
    await assertFails(
      updateDoc(doc(dbA, 'users', 'userA'), {
        fullName: 'Carlos Mendoza',
        isAdmin: true,
        updatedAt: serverTimestamp(),
      })
    );

    // 6. Orphaned / Non-Atomic Document Upload
    await assertFails(
      setDoc(doc(dbA, 'documents', 'orphanDoc'), {
        userId: 'userA',
        name: 'Huerfano.pdf',
        category: 'Trabajo',
        type: 'pdf',
        sizeBytes: 2048,
        starred: false,
        uploadedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 7. 10 GB Quota Overflow Bypass
    const overflowBatch = writeBatch(dbA);
    overflowBatch.set(doc(dbA, 'documents', 'overflowDoc'), {
      userId: 'userA',
      name: 'Archivo_Masivo.pdf',
      category: 'Trabajo',
      type: 'pdf',
      sizeBytes: 5000000000,
      starred: false,
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    overflowBatch.update(doc(dbA, 'users', 'userA'), {
      usedStorageBytes: 13000000000,
      updatedAt: serverTimestamp(),
    });
    await assertFails(overflowBatch.commit());

    // 8. Cross-Tenant Document Scraping
    await assertFails(getDoc(doc(dbB, 'documents', 'docA1')));
    await assertFails(getDocs(collection(dbB, 'documents')));

    // 9. Invalid Category Enum Poisoning
    const badCatBatch = writeBatch(dbA);
    badCatBatch.set(doc(dbA, 'documents', 'badCatDoc'), {
      userId: 'userA',
      name: 'Valid.pdf',
      category: 'InvalidCategory',
      type: 'pdf',
      sizeBytes: 1024,
      starred: false,
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    badCatBatch.update(doc(dbA, 'users', 'userA'), {
      usedStorageBytes: 8000001024,
      updatedAt: serverTimestamp(),
    });
    await assertFails(badCatBatch.commit());

    // 10. Immutable Field Mutation on Document Update
    await assertFails(
      updateDoc(doc(dbA, 'documents', 'docA1'), {
        sizeBytes: 1,
        updatedAt: serverTimestamp(),
      })
    );

    // 11. Client Timestamp Forgery
    await assertFails(
      updateDoc(doc(dbA, 'documents', 'docA1'), {
        name: 'Forged_Time.pdf',
        updatedAt: Timestamp.fromMillis(1000000),
      })
    );

    // 12. Resource Exhaustion / Oversized Name Poisoning
    await assertFails(
      updateDoc(doc(dbA, 'documents', 'docA1'), {
        name: 'A'.repeat(500) + '.pdf',
        updatedAt: serverTimestamp(),
      })
    );
  } finally {
    await testEnv.cleanup();
  }
}
