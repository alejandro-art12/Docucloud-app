import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseAuthUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  CATEGORIES,
  DocumentCategory,
  DocumentFileType,
  DocucloudDocument,
  DocucloudUser,
  FILE_TYPES,
  MAX_BIO_LENGTH,
  MAX_COUNTRY_CODE_LENGTH,
  MAX_DOC_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_FILE_SIZE_BYTES,
  MAX_FULLNAME_LENGTH,
  MAX_PHONE_LENGTH,
  MAX_STORAGE_BYTES,
  MAX_USERNAME_LENGTH,
  ProfileUpdatePayload,
} from '../types/docucloud';
import {
  formatBytes,
  formatDocDate,
  normalizeCategoryToSpanish,
  sanitizeUsername,
} from '../utils/formatters';
import {
  CapturedOriginPayload,
  createDemoPdfBlob,
  createDemoPngBlob,
  deleteDocumentBlob,
  FileSizeLimitExceededError,
  initDocucloudIndexedDB,
  listUserDocumentsFromIndexedDB,
  MAX_FILE_SIZE_EXCEEDED_MESSAGE,
  ORIGIN_CORRUPTED_MESSAGE,
  saveDocumentBinaryPayload,
  saveDocumentBlob,
  updateDocumentMetadataInIndexedDB,
} from './fileBlobService';
import {
  purgeHeavyPayloadsFromLocalStorage,
  syncSessionSnapshotInLocalStorage,
} from './uiPreferencesService';

export const QUOTA_EXCEEDED_MESSAGE =
  'Almacenamiento insuficiente. Este archivo supera tu límite disponible de 10 GB';

const LOCAL_USERS_KEY = 'docucloud_users';
const LOCAL_SESSION_KEY = 'docucloud_active_session';
const LOCAL_SEED_LANG_KEY = 'docucloud_seed_es_v2';
const DEMO_IDB_SEEDED_KEY = 'docucloud_demo_idb_v1';
const getLegacyLocalDocsKey = (userId: string) => `docucloud_docs_${userId}`;

interface LocalStoredUser extends DocucloudUser {
  password: string;
}

export class UnregisteredEmailError extends Error {
  email: string;
  constructor(email: string) {
    super('Esta cuenta aún no está registrada.');
    this.name = 'UnregisteredEmailError';
    this.email = email;
  }
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (typeof val === 'number') {
    return val;
  }
  if (
    val &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

function generateSafeId(prefix = 'usr'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

function generateDocumentUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return generateSafeId('doc');
}

function buildSpanishDemoDocs(demoUid: string, now: number): DocucloudDocument[] {
  return [
    {
      id: 'doc_demo_1',
      userId: demoUid,
      name: 'Contrato_arrendamiento_2026.pdf',
      category: 'Personales',
      type: 'pdf',
      sizeBytes: 870400, // 850.00 KB
      starred: true,
      uploadedAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: 'doc_demo_2',
      userId: demoUid,
      name: 'Informe_academico_2026.pdf',
      category: 'Académicos',
      type: 'pdf',
      sizeBytes: 2516582, // 2.40 MB
      starred: false,
      uploadedAt: now - 86400000 * 9,
      updatedAt: now - 86400000 * 9,
    },
    {
      id: 'doc_demo_3',
      userId: demoUid,
      name: 'Contrato_servicios_profesionales.pdf',
      category: 'Trabajo',
      type: 'pdf',
      sizeBytes: 1468006, // 1.40 MB
      starred: true,
      uploadedAt: now - 86400000 * 14,
      updatedAt: now - 86400000 * 12,
    },
    {
      id: 'doc_demo_4',
      userId: demoUid,
      name: 'Adenda_contrato_firmada.png',
      category: 'Otros',
      type: 'image',
      sizeBytes: 2202009, // 2.10 MB
      starred: false,
      uploadedAt: now - 86400000 * 20,
      updatedAt: now - 86400000 * 20,
    },
    {
      id: 'doc_demo_5',
      userId: demoUid,
      name: 'Certificado_arquitectura_cloud.pdf',
      category: 'Certificados',
      type: 'pdf',
      sizeBytes: 460800, // 450.00 KB
      starred: false,
      uploadedAt: now - 86400000 * 28,
      updatedAt: now - 86400000 * 28,
    },
  ];
}

/**
 * Inicializa únicamente los metadatos ligeros de usuario en LocalStorage (< 5 MB)
 * e inicializa `Docucloud_DB` en IndexedDB sin guardar archivos ni Base64 en LocalStorage.
 */
export function ensureDemoSeedInLocalStorage(): void {
  purgeHeavyPayloadsFromLocalStorage();
  void initDocucloudIndexedDB();

  try {
    const now = Date.now();
    const demoUid = 'demo_carlos_mendoza';
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    const alreadySpanishV2 = localStorage.getItem(LOCAL_SEED_LANG_KEY) === 'true';

    if (raw && alreadySpanishV2) return;

    const sampleDocs = buildSpanishDemoDocs(demoUid, now);
    const totalUsed = sampleDocs.reduce((acc, d) => acc + d.sizeBytes, 0);

    const demoUser: LocalStoredUser = {
      uid: demoUid,
      fullName: 'Carlos Mendoza',
      email: 'carlos@docucloud.com',
      password: 'Demo1234!',
      usedStorageBytes: totalUsed,
      maxStorageBytes: MAX_STORAGE_BYTES,
      createdAt: now - 86400000 * 60,
      updatedAt: now - 86400000 * 2,
      username: 'carlosmendoza',
      phone: '9 11 4523-8890',
      countryCode: '+54',
      bio: 'Diseñador independiente y usuario particular de bóvedas digitales.',
      accountType: 'personal',
      dateFormat: 'DD/MM/YYYY',
      securityAlerts: true,
      storageMode: 'local',
    };

    if (!raw) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([demoUser]));
      localStorage.setItem(LOCAL_SEED_LANG_KEY, 'true');
      return;
    }

    const parsedUsers: LocalStoredUser[] = JSON.parse(raw);
    if (Array.isArray(parsedUsers)) {
      const hasDemo = parsedUsers.some((u) => u.uid === demoUid);
      const nextUsers = hasDemo
        ? parsedUsers.map((u) => (u.uid === demoUid ? demoUser : u))
        : [demoUser, ...parsedUsers];
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(nextUsers));
    }
    localStorage.setItem(LOCAL_SEED_LANG_KEY, 'true');
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
}

function readLocalUsers(): LocalStoredUser[] {
  ensureDemoSeedInLocalStorage();
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: LocalStoredUser[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function stripPassword(u: LocalStoredUser): DocucloudUser {
  const { password: _pwd, ...rest } = u;
  return rest;
}

/**
 * Carga en tiempo real los documentos del usuario desde `Docucloud_DB` -> `documents_store` en IndexedDB,
 * migrando cualquier metadato legado desde LocalStorage y sembrando los archivos binarios demo si corresponde.
 */
export async function loadLocalDocsForUserFromIndexedDB(
  user: DocucloudUser
): Promise<{ docs: DocucloudDocument[]; syncedUser: DocucloudUser }> {
  await initDocucloudIndexedDB();

  let existingIdbDocs = await listUserDocumentsFromIndexedDB(user.uid);
  const existingIds = new Set(existingIdbDocs.map((d) => d.id));

  // Migrar cualquier lista legada que estuviera en LocalStorage hacia IndexedDB y limpiar LocalStorage
  try {
    const legacyKey = getLegacyLocalDocsKey(user.uid);
    const rawLegacy = localStorage.getItem(legacyKey);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy);
      localStorage.removeItem(legacyKey);

      if (Array.isArray(parsedLegacy)) {
        for (const item of parsedLegacy as DocucloudDocument[]) {
          if (item && item.id && item.userId === user.uid && !existingIds.has(item.id)) {
            if (item.id.startsWith('doc_demo_')) {
              const dateLabel = formatDocDate(item.updatedAt, user.dateFormat, true);
              const demoBlob =
                item.type === 'image'
                  ? await createDemoPngBlob(
                      item.name,
                      item.category,
                      user.fullName,
                      dateLabel
                    )
                  : createDemoPdfBlob(
                      item.name,
                      item.category,
                      user.fullName,
                      user.email,
                      formatBytes(item.sizeBytes),
                      dateLabel
                    );

              await saveDocumentBlob(
                user.uid,
                item.id,
                demoBlob,
                demoBlob.type,
                item.name,
                {
                  categoria: normalizeCategoryToSpanish(item.category),
                  tipoArchivo: item.type,
                  starred: Boolean(item.starred),
                  uploadedAt: item.uploadedAt,
                  updatedAt: item.updatedAt,
                  silentLog: true,
                }
              );
              existingIds.add(item.id);
            }
          }
        }
      }
    }
  } catch {
    // Continuar con carga desde IndexedDB
  }

  // Si es la cuenta demo y aún no se sembraron sus archivos binarios en Docucloud_DB, crearlos en IndexedDB
  if (
    user.uid === 'demo_carlos_mendoza' &&
    existingIds.size === 0 &&
    (typeof localStorage === 'undefined' ||
      localStorage.getItem(DEMO_IDB_SEEDED_KEY) !== 'true')
  ) {
    const sampleDocs = buildSpanishDemoDocs(user.uid, Date.now());
    for (const sample of sampleDocs) {
      const dateLabel = formatDocDate(sample.updatedAt, user.dateFormat, true);
      const demoBlob =
        sample.type === 'image'
          ? await createDemoPngBlob(
              sample.name,
              sample.category,
              user.fullName,
              dateLabel
            )
          : createDemoPdfBlob(
              sample.name,
              sample.category,
              user.fullName,
              user.email,
              formatBytes(sample.sizeBytes),
              dateLabel
            );

      await saveDocumentBlob(
        user.uid,
        sample.id,
        demoBlob,
        demoBlob.type,
        sample.name,
        {
          categoria: sample.category,
          tipoArchivo: sample.type,
          starred: sample.starred,
          uploadedAt: sample.uploadedAt,
          updatedAt: sample.updatedAt,
          silentLog: true,
        }
      );
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(DEMO_IDB_SEEDED_KEY, 'true');
      } catch {
        // Ignorar
      }
    }
  }

  existingIdbDocs = await listUserDocumentsFromIndexedDB(user.uid);
  const exactUsedBytes = existingIdbDocs.reduce(
    (sum, docItem) => sum + docItem.sizeBytes,
    0
  );

  let syncedUser = user;
  if (user.storageMode === 'local' && exactUsedBytes !== user.usedStorageBytes) {
    syncedUser = {
      ...user,
      usedStorageBytes: exactUsedBytes,
    };
    try {
      const users = readLocalUsers();
      const idx = users.findIndex((u) => u.uid === user.uid);
      if (idx >= 0) {
        users[idx] = {
          ...users[idx],
          usedStorageBytes: exactUsedBytes,
        };
        writeLocalUsers(users);
      }
    } catch {
      // Ignorar
    }
  }

  return { docs: existingIdbDocs, syncedUser };
}

export function getSavedLocalSessionUser(): DocucloudUser | null {
  try {
    const uid = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!uid) return null;
    const found = readLocalUsers().find((u) => u.uid === uid);
    return found ? stripPassword(found) : null;
  } catch {
    return null;
  }
}

export function loginLocalAccount(
  emailRaw: string,
  password: string,
  _rememberMe: boolean
): DocucloudUser {
  const email = emailRaw.trim().toLowerCase();
  const users = readLocalUsers();
  const found = users.find((u) => u.email.toLowerCase() === email);
  if (!found) {
    throw new UnregisteredEmailError(emailRaw.trim());
  }
  if (found.password !== password) {
    throw new Error('Contraseña incorrecta. Verifica tus credenciales.');
  }
  localStorage.setItem(LOCAL_SESSION_KEY, found.uid);
  const cleanUser = stripPassword(found);
  syncSessionSnapshotInLocalStorage(cleanUser);
  return cleanUser;
}

export function registerLocalAccount(
  fullNameRaw: string,
  emailRaw: string,
  password: string
): DocucloudUser {
  const fullName = fullNameRaw.trim().slice(0, MAX_FULLNAME_LENGTH);
  const email = emailRaw.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);

  if (!fullName) {
    throw new Error('Por favor, ingresa tu nombre completo.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Por favor, ingresa un correo electrónico válido.');
  }
  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  const users = readLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error(
      'Ya existe una cuenta registrada con este correo electrónico.'
    );
  }

  const now = Date.now();
  const uid = generateSafeId('usr');
  const username = sanitizeUsername(email.split('@')[0] || fullName);

  const newUser: LocalStoredUser = {
    uid,
    fullName,
    email,
    password,
    usedStorageBytes: 0, // Inicializado estrictamente en 0 B al registrarse
    maxStorageBytes: MAX_STORAGE_BYTES, // Fijado estrictamente en 10 GB (10,737,418,240 B)
    createdAt: now,
    updatedAt: now,
    username,
    phone: '',
    countryCode: '+54',
    bio: '',
    accountType: 'personal',
    dateFormat: 'DD/MM/YYYY',
    securityAlerts: true,
    storageMode: 'local',
  };

  users.push(newUser);
  writeLocalUsers(users);
  localStorage.setItem(LOCAL_SESSION_KEY, uid);
  const cleanUser = stripPassword(newUser);
  syncSessionSnapshotInLocalStorage(cleanUser);

  return cleanUser;
}

export function changeLocalPassword(
  uid: string,
  currentPassword: string,
  newPassword: string
): void {
  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.uid === uid);
  if (idx === -1) {
    throw new Error('No se pudo localizar el registro de la cuenta.');
  }
  if (users[idx].password !== currentPassword) {
    throw new Error('La contraseña actual es incorrecta.');
  }
  if (newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }
  users[idx] = {
    ...users[idx],
    password: newPassword,
    updatedAt: Date.now(),
  };
  writeLocalUsers(users);
}

/**
 * Inicia sesión con Google mediante Firebase Auth y aprovisiona/carga el documento aislado en Firestore.
 */
export async function signInWithGoogleVault(): Promise<DocucloudUser> {
  const credential = await signInWithPopup(auth, googleProvider);
  localStorage.removeItem(LOCAL_SESSION_KEY);
  return ensureFirestoreUserRecord(credential.user);
}

export async function ensureFirestoreUserRecord(
  fbUser: FirebaseAuthUser
): Promise<DocucloudUser> {
  const userPath = `users/${fbUser.uid}`;
  const userRef = doc(db, 'users', fbUser.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (snap.exists()) {
    const data = snap.data();
    return mapFirestoreUserToModel(fbUser.uid, data);
  }

  const safeFullName = (
    fbUser.displayName ||
    fbUser.email?.split('@')[0] ||
    'Usuario Docucloud'
  )
    .trim()
    .slice(0, MAX_FULLNAME_LENGTH);
  const safeEmail = (fbUser.email || 'usuario@docucloud.com')
    .trim()
    .slice(0, MAX_EMAIL_LENGTH);
  const safeUsername = sanitizeUsername(
    safeEmail.split('@')[0] || safeFullName
  ).slice(0, MAX_USERNAME_LENGTH);

  const createPayload = {
    uid: fbUser.uid,
    fullName: safeFullName,
    email: safeEmail,
    usedStorageBytes: 0,
    maxStorageBytes: MAX_STORAGE_BYTES,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    username: safeUsername,
    phone: '',
    countryCode: '+54',
    bio: '',
    accountType: 'personal' as const,
    dateFormat: 'DD/MM/YYYY' as const,
    securityAlerts: true,
  };

  try {
    await setDoc(userRef, createPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }

  const now = Date.now();
  return {
    uid: fbUser.uid,
    fullName: safeFullName,
    email: safeEmail,
    usedStorageBytes: 0,
    maxStorageBytes: MAX_STORAGE_BYTES,
    createdAt: now,
    updatedAt: now,
    username: safeUsername,
    phone: '',
    countryCode: '+54',
    bio: '',
    accountType: 'personal',
    dateFormat: 'DD/MM/YYYY',
    securityAlerts: true,
    storageMode: 'firebase',
  };
}

export function mapFirestoreUserToModel(
  uid: string,
  data: Record<string, unknown>
): DocucloudUser {
  return {
    uid,
    fullName:
      typeof data.fullName === 'string' ? data.fullName : 'Usuario Docucloud',
    email: typeof data.email === 'string' ? data.email : '',
    usedStorageBytes:
      typeof data.usedStorageBytes === 'number'
        ? Math.max(0, data.usedStorageBytes)
        : 0,
    maxStorageBytes: MAX_STORAGE_BYTES,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    username:
      typeof data.username === 'string'
        ? data.username
        : sanitizeUsername(uid),
    phone: typeof data.phone === 'string' ? data.phone : '',
    countryCode:
      typeof data.countryCode === 'string' ? data.countryCode : '+54',
    bio: typeof data.bio === 'string' ? data.bio : '',
    accountType:
      data.accountType === 'independent' ? 'independent' : 'personal',
    dateFormat:
      data.dateFormat === 'MM/DD/YYYY' || data.dateFormat === 'YYYY-MM-DD'
        ? data.dateFormat
        : 'DD/MM/YYYY',
    securityAlerts:
      typeof data.securityAlerts === 'boolean' ? data.securityAlerts : true,
    storageMode: 'firebase',
  };
}

export function subscribeToFirestoreVault(
  uid: string,
  onUserChange: (user: DocucloudUser) => void,
  onDocsChange: (docs: DocucloudDocument[]) => void
): () => void {
  const userPath = `users/${uid}`;
  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        onUserChange(mapFirestoreUserToModel(uid, snap.data()));
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  );

  // Filtro estricto por propietario: .where("userId", "==", currentUser.uid)
  const docsQuery = query(
    collection(db, 'documents'),
    where('userId', '==', uid)
  );
  const unsubDocs = onSnapshot(
    docsQuery,
    (snapshot) => {
      const items: DocucloudDocument[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const cat = normalizeCategoryToSpanish(d.category);
        const fType = FILE_TYPES.includes(d.type as DocumentFileType)
          ? (d.type as DocumentFileType)
          : 'pdf';
        return {
          id: docSnap.id,
          userId: String(d.userId || uid),
          name: String(d.name || 'Sin_titulo.pdf'),
          category: cat,
          type: fType,
          sizeBytes: typeof d.sizeBytes === 'number' ? d.sizeBytes : 0,
          starred: Boolean(d.starred),
          uploadedAt: toMillis(d.uploadedAt),
          updatedAt: toMillis(d.updatedAt),
        };
      });
      onDocsChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    }
  );

  return () => {
    unsubUser();
    unsubDocs();
  };
}

export interface UploadDocumentInput {
  name: string;
  category: DocumentCategory;
  type: DocumentFileType;
  sizeBytes: number;
  fileBlob?: Blob;
  mimeType?: string;
  capturedPayload?: CapturedOriginPayload;
}

/**
 * Valida la integridad de origen (> 0 bytes), el límite estricto de 10 MB por archivo,
 * la cuota de 10 GB y persiste el archivo binario en IndexedDB.
 */
export async function uploadVaultDocument(
  user: DocucloudUser,
  input: UploadDocumentInput
): Promise<{ updatedUser: DocucloudUser; createdDoc: DocucloudDocument }> {
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error(ORIGIN_CORRUPTED_MESSAGE);
  }

  const safeSize = Math.round(input.sizeBytes);
  if (safeSize > MAX_FILE_SIZE_BYTES) {
    throw new FileSizeLimitExceededError(
      safeSize,
      MAX_FILE_SIZE_EXCEEDED_MESSAGE
    );
  }

  const newTotal = user.usedStorageBytes + safeSize;

  if (newTotal > MAX_STORAGE_BYTES) {
    throw new Error(QUOTA_EXCEEDED_MESSAGE);
  }

  const safeName = input.name.trim().slice(0, MAX_DOC_NAME_LENGTH);
  if (!safeName) {
    throw new Error('El nombre del documento no puede estar vacío.');
  }
  if (!CATEGORIES.includes(input.category)) {
    throw new Error('Por favor, selecciona una categoría válida.');
  }
  if (!FILE_TYPES.includes(input.type)) {
    throw new Error('Tipo de archivo no admitido.');
  }

  const now = Date.now();

  const persistLosslessBinary = async (docId: string) => {
    const idbOptions = {
      categoria: input.category,
      tipoArchivo: input.type,
      starred: false,
      uploadedAt: now,
      updatedAt: now,
    };

    if (input.capturedPayload) {
      await saveDocumentBinaryPayload(
        user.uid,
        docId,
        {
          originalName: safeName,
          mimeType: input.capturedPayload.mimeType,
          sizeBytes: input.capturedPayload.sizeBytes,
          sha256: input.capturedPayload.sha256,
          blob: input.capturedPayload.typedBlob,
        },
        idbOptions
      );
    } else if (input.fileBlob) {
      await saveDocumentBlob(
        user.uid,
        docId,
        input.fileBlob,
        input.mimeType,
        safeName,
        idbOptions
      );
    }
  };

  if (user.storageMode === 'firebase') {
    const newDocRef = doc(collection(db, 'documents'));
    const userRef = doc(db, 'users', user.uid);

    // Guardar en Docucloud_DB -> documents_store antes del commit para disponibilidad inmediata
    await persistLosslessBinary(newDocRef.id);

    const batch = writeBatch(db);

    batch.set(newDocRef, {
      userId: user.uid,
      name: safeName,
      category: input.category,
      type: input.type,
      sizeBytes: safeSize,
      starred: false,
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(userRef, {
      usedStorageBytes: increment(safeSize),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      await deleteDocumentBlob(user.uid, newDocRef.id);
      handleFirestoreError(err, OperationType.WRITE, 'documents');
    }

    return {
      updatedUser: {
        ...user,
        usedStorageBytes: newTotal,
        updatedAt: now,
      },
      createdDoc: {
        id: newDocRef.id,
        userId: user.uid,
        name: safeName,
        category: input.category,
        type: input.type,
        sizeBytes: safeSize,
        starred: false,
        uploadedAt: now,
        updatedAt: now,
      },
    };
  }

  // Persistencia nativa en Docucloud_DB -> documents_store (con UUID único e índices userId y categoria)
  const createdDoc: DocucloudDocument = {
    id: generateDocumentUuid(),
    userId: user.uid,
    name: safeName,
    category: input.category,
    type: input.type,
    sizeBytes: safeSize,
    starred: false,
    uploadedAt: now,
    updatedAt: now,
  };

  await persistLosslessBinary(createdDoc.id);

  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.uid === user.uid);
  const updatedUsed =
    idx >= 0 ? users[idx].usedStorageBytes + safeSize : newTotal;

  if (idx >= 0) {
    users[idx] = {
      ...users[idx],
      usedStorageBytes: updatedUsed,
      updatedAt: now,
    };
    writeLocalUsers(users);
  }

  return {
    updatedUser: {
      ...user,
      usedStorageBytes: updatedUsed,
      updatedAt: now,
    },
    createdDoc,
  };
}

/**
 * Elimina un documento de `Docucloud_DB` (`documents_store`) y decrementa atómicamente usedStorageBytes.
 */
export async function deleteVaultDocument(
  user: DocucloudUser,
  targetDoc: DocucloudDocument
): Promise<DocucloudUser> {
  const nextUsed = Math.max(0, user.usedStorageBytes - targetDoc.sizeBytes);
  const now = Date.now();

  if (user.storageMode === 'firebase') {
    const docRef = doc(db, 'documents', targetDoc.id);
    const userRef = doc(db, 'users', user.uid);
    const batch = writeBatch(db);

    batch.delete(docRef);
    batch.update(userRef, {
      usedStorageBytes: nextUsed,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `documents/${targetDoc.id}`
      );
    }

    await deleteDocumentBlob(user.uid, targetDoc.id);

    return {
      ...user,
      usedStorageBytes: nextUsed,
      updatedAt: now,
    };
  }

  await deleteDocumentBlob(user.uid, targetDoc.id);

  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.uid === user.uid);
  if (idx >= 0) {
    const safeRemaining = Math.max(
      0,
      users[idx].usedStorageBytes - targetDoc.sizeBytes
    );
    users[idx] = {
      ...users[idx],
      usedStorageBytes: safeRemaining,
      updatedAt: now,
    };
    writeLocalUsers(users);
    return stripPassword(users[idx]);
  }

  return {
    ...user,
    usedStorageBytes: nextUsed,
    updatedAt: now,
  };
}

export async function renameOrMoveVaultDocument(
  user: DocucloudUser,
  docId: string,
  newNameRaw: string,
  newCategory: DocumentCategory
): Promise<DocucloudDocument | null> {
  const newName = newNameRaw.trim().slice(0, MAX_DOC_NAME_LENGTH);
  if (!newName) {
    throw new Error('El nombre del documento no puede estar vacío.');
  }
  const now = Date.now();

  if (user.storageMode === 'firebase') {
    const docPath = `documents/${docId}`;
    try {
      await updateDoc(doc(db, 'documents', docId), {
        name: newName,
        category: newCategory,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
    await updateDocumentMetadataInIndexedDB(user.uid, docId, {
      nombre: newName,
      categoria: newCategory,
      updatedAt: now,
    });
    return null;
  }

  return updateDocumentMetadataInIndexedDB(user.uid, docId, {
    nombre: newName,
    categoria: newCategory,
    updatedAt: now,
  });
}

export async function toggleStarVaultDocument(
  user: DocucloudUser,
  docId: string,
  starred: boolean
): Promise<DocucloudDocument | null> {
  const now = Date.now();

  if (user.storageMode === 'firebase') {
    const docPath = `documents/${docId}`;
    try {
      await updateDoc(doc(db, 'documents', docId), {
        starred,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
    await updateDocumentMetadataInIndexedDB(user.uid, docId, {
      starred,
      updatedAt: now,
    });
    return null;
  }

  return updateDocumentMetadataInIndexedDB(user.uid, docId, {
    starred,
    updatedAt: now,
  });
}

export async function updateVaultUserProfile(
  user: DocucloudUser,
  payload: ProfileUpdatePayload
): Promise<DocucloudUser> {
  const safeFullName = payload.fullName.trim().slice(0, MAX_FULLNAME_LENGTH);
  const safeEmail = payload.email.trim().slice(0, MAX_EMAIL_LENGTH);
  const safeUsername = sanitizeUsername(payload.username).slice(
    0,
    MAX_USERNAME_LENGTH
  );
  const safePhone = payload.phone.trim().slice(0, MAX_PHONE_LENGTH);
  const safeCountryCode = payload.countryCode
    .trim()
    .slice(0, MAX_COUNTRY_CODE_LENGTH);
  const safeBio = payload.bio.trim().slice(0, MAX_BIO_LENGTH);

  if (!safeFullName) {
    throw new Error('El nombre completo es obligatorio.');
  }
  if (!safeEmail || !safeEmail.includes('@')) {
    throw new Error('Debes ingresar un correo electrónico válido.');
  }

  const now = Date.now();

  if (user.storageMode === 'firebase') {
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: safeFullName,
        email: safeEmail,
        username: safeUsername,
        phone: safePhone,
        countryCode: safeCountryCode,
        bio: safeBio,
        accountType: payload.accountType,
        dateFormat: payload.dateFormat,
        securityAlerts: payload.securityAlerts,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }

    return {
      ...user,
      fullName: safeFullName,
      email: safeEmail,
      username: safeUsername,
      phone: safePhone,
      countryCode: safeCountryCode,
      bio: safeBio,
      accountType: payload.accountType,
      dateFormat: payload.dateFormat,
      securityAlerts: payload.securityAlerts,
      updatedAt: now,
    };
  }

  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.uid === user.uid);
  if (idx >= 0) {
    users[idx] = {
      ...users[idx],
      fullName: safeFullName,
      email: safeEmail,
      username: safeUsername,
      phone: safePhone,
      countryCode: safeCountryCode,
      bio: safeBio,
      accountType: payload.accountType,
      dateFormat: payload.dateFormat,
      securityAlerts: payload.securityAlerts,
      updatedAt: now,
    };
    writeLocalUsers(users);
    return stripPassword(users[idx]);
  }

  return {
    ...user,
    fullName: safeFullName,
    email: safeEmail,
    username: safeUsername,
    phone: safePhone,
    countryCode: safeCountryCode,
    bio: safeBio,
    accountType: payload.accountType,
    dateFormat: payload.dateFormat,
    securityAlerts: payload.securityAlerts,
    updatedAt: now,
  };
}

export async function signOutVault(user: DocucloudUser | null): Promise<void> {
  localStorage.removeItem(LOCAL_SESSION_KEY);
  syncSessionSnapshotInLocalStorage(null);
  if (user?.storageMode === 'firebase' || auth.currentUser) {
    await firebaseSignOut(auth);
  }
}

export async function seedSampleFilesForCurrentUser(
  user: DocucloudUser
): Promise<DocucloudUser> {
  const dateLabel = new Date().toLocaleDateString('es-ES');
  const pdf1 = createDemoPdfBlob(
    'Informe_Financiero_2026.pdf',
    'Trabajo',
    user.fullName,
    user.email,
    'PDF',
    dateLabel
  );
  const pdf2 = createDemoPdfBlob(
    'Historial_Academico_Oficial.pdf',
    'Académicos',
    user.fullName,
    user.email,
    'PDF',
    dateLabel
  );
  const png1 = await createDemoPngBlob(
    'Identificacion_Oficial_Escaneada.png',
    'Personales',
    user.fullName,
    dateLabel
  );
  const pdf3 = createDemoPdfBlob(
    'Certificado_Ciberseguridad.pdf',
    'Certificados',
    user.fullName,
    user.email,
    'PDF',
    dateLabel
  );

  const samples: UploadDocumentInput[] = [
    {
      name: 'Informe_Financiero_2026.pdf',
      category: 'Trabajo',
      type: 'pdf',
      sizeBytes: pdf1.size,
      fileBlob: pdf1,
      mimeType: 'application/pdf',
    },
    {
      name: 'Historial_Academico_Oficial.pdf',
      category: 'Académicos',
      type: 'pdf',
      sizeBytes: pdf2.size,
      fileBlob: pdf2,
      mimeType: 'application/pdf',
    },
    {
      name: 'Identificacion_Oficial_Escaneada.png',
      category: 'Personales',
      type: 'image',
      sizeBytes: png1.size,
      fileBlob: png1,
      mimeType: 'image/png',
    },
    {
      name: 'Certificado_Ciberseguridad.pdf',
      category: 'Certificados',
      type: 'pdf',
      sizeBytes: pdf3.size,
      fileBlob: pdf3,
      mimeType: 'application/pdf',
    },
  ];

  let latestUser = user;
  for (const item of samples) {
    const res = await uploadVaultDocument(latestUser, item);
    latestUser = res.updatedUser;
  }
  return latestUser;
}
