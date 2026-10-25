import {
  CATEGORIES,
  DocumentCategory,
  DocumentFileType,
  DocucloudDocument,
  DocucloudUser,
  FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../types/docucloud';
import {
  detectDocumentType,
  formatBytes,
  formatDocDate,
  inferMimeTypeFromName,
  normalizeCategoryToSpanish,
  splitFilename,
} from '../utils/formatters';
import {
  convertDocxBufferToSafeHtml,
  convertSpreadsheetBufferToSafeHtml,
  getPdfJsEngine,
} from './cdnReaders';

export { MAX_FILE_SIZE_BYTES };

export const DOCUCLOUD_DB_NAME = 'Docucloud_DB';
export const DOCUCLOUD_DB_VERSION = 1;
export const DOCUCLOUD_STORE_NAME = 'documents_store';

const LEGACY_V3_DB_NAME = 'docucloud_binary_vault_v3';
const LEGACY_V3_STORE_NAME = 'binary_records';

export type ViewerKind =
  | 'pdf'
  | 'docx'
  | 'spreadsheet'
  | 'image'
  | 'text'
  | 'unsupported';

export const MAX_FILE_SIZE_EXCEEDED_MESSAGE =
  'El archivo supera el límite máximo permitido de 10 MB por documento.';

export const ORIGIN_CORRUPTED_MESSAGE =
  'El documento ya viene con error o está dañado desde el origen. No se puede procesar.';

export const VIEWER_LOAD_ERROR_MESSAGE =
  'No se pudo cargar el contenido binario del archivo en este dispositivo. Vuelve a subir el archivo original.';

export class FileSizeLimitExceededError extends Error {
  readonly fileSizeBytes: number;
  constructor(
    fileSizeBytes = 0,
    message = MAX_FILE_SIZE_EXCEEDED_MESSAGE
  ) {
    super(message);
    this.name = 'FileSizeLimitExceededError';
    this.fileSizeBytes = fileSizeBytes;
  }
}

export class OriginCorruptedFileError extends Error {
  constructor(message = ORIGIN_CORRUPTED_MESSAGE) {
    super(message);
    this.name = 'OriginCorruptedFileError';
  }
}

/**
 * Esquema oficial almacenado en Docucloud_DB -> documents_store (clave primaria: id, índices: userId y categoria).
 * Visible directamente desde F12 -> Aplicación -> Almacenamiento -> IndexedDB -> Docucloud_DB -> documents_store.
 */
export interface DocucloudIndexedDbRecord {
  id: string;
  userId: string;
  nombre: string;
  tamanoBytes: number;
  tipo: string;
  tipoArchivo: DocumentFileType;
  fechaCarga: string;
  categoria: DocumentCategory;
  starred: boolean;
  uploadedAt: number;
  updatedAt: number;
  sha256: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
}

export interface CapturedOriginPayload {
  originalFile: File;
  typedBlob: Blob;
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  base64DataUrl: string;
  viewerKind: ViewerKind;
  pdfPageCount?: number;
  imageDimensions?: { width: number; height: number };
  docxPreviewText?: string;
  sheetSummary?: {
    sheetCount: number;
    firstSheetName: string;
    rowCount: number;
    colCount: number;
  };
  textPreview?: string;
}

export interface ResolvedDocumentBinary {
  blob: Blob;
  base64DataUrl: string;
  mimeType: string;
  sha256: string;
  isUserUploaded: boolean;
  kind: ViewerKind;
}

// Respaldo de emergencia únicamente si el navegador bloquea IndexedDB por completo
const emergencySessionFallback = new Map<string, DocucloudIndexedDbRecord>();

function makeFallbackKey(userId: string, docId: string): string {
  return `${userId}::${docId}`;
}

/**
 * Abre e inicializa la base de datos nativa IndexedDB `Docucloud_DB` (versión 1)
 * con el Object Store `documents_store` (clave primaria `id` e índices `userId` y `categoria`).
 */
export function openDocucloudDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }

    const request = indexedDB.open(DOCUCLOUD_DB_NAME, DOCUCLOUD_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCUCLOUD_STORE_NAME)) {
        const store = db.createObjectStore(DOCUCLOUD_STORE_NAME, {
          keyPath: 'id',
        });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('categoria', 'categoria', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ||
          new Error('No se pudo abrir la base de datos Docucloud_DB en IndexedDB.')
      );
  });
}

/**
 * Garantiza que `Docucloud_DB` y `documents_store` estén creados desde el arranque de la app
 * para su inspección inmediata en F12 -> Aplicación -> IndexedDB.
 */
export async function initDocucloudIndexedDB(): Promise<void> {
  try {
    const db = await openDocucloudDatabase();
    db.close();
  } catch {
    // Ignorar en entornos sin IndexedDB
  }
}

async function tryMigrateFromLegacyV3(
  userId: string,
  docId: string
): Promise<{
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  mimeType?: string;
  originalName?: string;
  sha256?: string;
} | null> {
  if (typeof indexedDB === 'undefined') return null;
  const legacyKey = `${userId}::${docId}`;
  try {
    const dbs =
      typeof indexedDB.databases === 'function'
        ? await indexedDB.databases()
        : null;
    if (dbs && !dbs.some((info) => info.name === LEGACY_V3_DB_NAME)) {
      return null;
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(LEGACY_V3_DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!db.objectStoreNames.contains(LEGACY_V3_STORE_NAME)) {
      db.close();
      return null;
    }

    return await new Promise((resolve) => {
      const tx = db.transaction(LEGACY_V3_STORE_NAME, 'readonly');
      const store = tx.objectStore(LEGACY_V3_STORE_NAME);
      const getReq = store.get(legacyKey);
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result || null);
      };
      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Convierte un Blob a DataURL Base64 únicamente en memoria cuando se requiera visualización auxiliar.
 * Nunca se persiste en LocalStorage.
 */
export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        resolve(reader.result);
      } else {
        reject(new OriginCorruptedFileError());
      }
    };
    reader.onerror = () => reject(new OriginCorruptedFileError());
    reader.onabort = () => reject(new OriginCorruptedFileError());
    reader.readAsDataURL(blob);
  });
}

/**
 * Lee los bytes binarios exactos de un Blob o File en un ArrayBuffer sin alteración.
 */
export function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new OriginCorruptedFileError());
      }
    };
    reader.onerror = () => reject(new OriginCorruptedFileError());
    reader.onabort = () => reject(new OriginCorruptedFileError());
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Lee los bytes desde un URL.createObjectURL(blob) temporal generado desde IndexedDB,
 * con respaldo directo sobre el Blob nativo.
 */
export async function readObjectUrlAsArrayBuffer(
  objectUrl: string | null,
  fallbackBlob: Blob
): Promise<ArrayBuffer> {
  if (objectUrl) {
    try {
      const response = await fetch(objectUrl);
      if (response.ok) {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > 0) {
          return buf;
        }
      }
    } catch {
      // Continuar con lectura directa del Blob recuperado de IndexedDB
    }
  }
  return readBlobAsArrayBuffer(fallbackBlob);
}

/**
 * Lee el contenido real de un archivo de texto plano mediante FileReader.readAsText().
 */
export function readBlobAsTextWithReader(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new OriginCorruptedFileError());
      }
    };
    reader.onerror = () => reject(new OriginCorruptedFileError());
    reader.onabort = () => reject(new OriginCorruptedFileError());
    reader.readAsText(blob, 'UTF-8');
  });
}

/**
 * Reconstruye un Blob binario idéntico byte por byte a partir de un DataURL Base64.
 */
export function base64DataUrlToBlob(
  dataUrl: string,
  fallbackMime = 'application/octet-stream'
): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Formato Base64 inválido.');
  }

  const header = dataUrl.slice(0, commaIdx);
  const base64Payload = dataUrl.slice(commaIdx + 1);
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header.trim());
  const extractedMime = mimeMatch?.[1]?.trim() || '';
  const resolvedMime =
    extractedMime && extractedMime !== 'application/octet-stream'
      ? extractedMime
      : fallbackMime;

  const binaryString = atob(base64Payload);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: resolvedMime });
}

/**
 * Calcula la huella criptográfica SHA-256 real sobre los bytes exactos del archivo.
 */
export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hashBytes = new Uint8Array(digest);
      return Array.from(hashBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Respaldo determinístico si WebCrypto no está disponible
  }

  const view = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < view.length; i++) {
    h1 ^= view[i];
    h1 = Math.imul(h1, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${view.length
    .toString(16)
    .padStart(8, '0')}`;
}

/**
 * Determina el motor exacto del visor multiformato (PDF <canvas>, Word .docx, Excel/CSV, Imagen o Texto).
 */
export function resolveViewerKind(
  fileName: string,
  mimeType = '',
  docType?: DocucloudDocument['type']
): ViewerKind {
  const lower = fileName.trim().toLowerCase();
  const mime = mimeType.trim().toLowerCase();

  if (
    mime.startsWith('image/') ||
    /\.(jpe?g|jfif|pjpeg|pjp|png|webp|gif|svg|bmp|avif|ico|heic|heif)$/.test(
      lower
    ) ||
    docType === 'image'
  ) {
    return 'image';
  }

  if (
    mime === 'application/pdf' ||
    lower.endsWith('.pdf') ||
    docType === 'pdf'
  ) {
    return 'pdf';
  }

  if (
    lower.endsWith('.docx') ||
    mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }

  if (
    /\.(xlsx|xls|csv|ods)$/.test(lower) ||
    mime ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    docType === 'xls'
  ) {
    return 'spreadsheet';
  }

  if (
    /\.(txt|tsv|md|markdown|log|json|xml|yaml|yml|ini|conf)$/.test(lower) ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml'
  ) {
    return 'text';
  }

  return 'unsupported';
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  const limit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

async function decodeRealImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  const tempUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          } else {
            reject(new OriginCorruptedFileError());
          }
        };
        img.onerror = () => reject(new OriginCorruptedFileError());
        img.src = tempUrl;
      }
    );
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

async function validateAndCountPdfPages(buffer: ArrayBuffer): Promise<number> {
  const pdfjsLib = await getPdfJsEngine();
  const data = new Uint8Array(buffer.slice(0));
  const loadingTask = pdfjsLib.getDocument({ data });
  try {
    const pdfDoc = await loadingTask.promise;
    const pages = pdfDoc.numPages;
    if (!Number.isFinite(pages) || pages < 1) {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
    return pages;
  } catch {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignorar limpieza del worker
    }
  }
}

/**
 * SUBSISTEMA UNIFICADO DE CAPTURA BINARIA REAL Y CONTROL DE ERRORES DE ORIGEN:
 * Valida el límite por archivo (10 MB) antes de iniciar la lectura y comprueba la integridad de origen.
 */
export async function validateAndCaptureOriginFile(
  file: File
): Promise<CapturedOriginPayload> {
  if (
    !file ||
    typeof file.name !== 'string' ||
    !file.name.trim() ||
    !Number.isFinite(file.size)
  ) {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileSizeLimitExceededError(file.size);
  }

  if (file.size <= 0) {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }

  const originalName = file.name.trim();
  const { extension } = splitFilename(originalName);
  const mimeType = inferMimeTypeFromName(originalName, file.type);
  const viewerKind = resolveViewerKind(originalName, mimeType);
  const lowerName = originalName.toLowerCase();

  const typedBlob =
    file.type === mimeType ? file : new Blob([file], { type: mimeType });

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await readBlobAsArrayBuffer(typedBlob);
  } catch {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }

  if (
    !arrayBuffer ||
    arrayBuffer.byteLength <= 0 ||
    arrayBuffer.byteLength !== file.size
  ) {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }

  const bytes = new Uint8Array(arrayBuffer);
  let pdfPageCount: number | undefined;
  let imageDimensions: { width: number; height: number } | undefined;
  let docxPreviewText: string | undefined;
  let sheetSummary:
    | {
        sheetCount: number;
        firstSheetName: string;
        rowCount: number;
        colCount: number;
      }
    | undefined;
  let textPreview: string | undefined;

  if (viewerKind === 'pdf') {
    if (!hasPdfSignature(bytes)) {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
    pdfPageCount = await validateAndCountPdfPages(arrayBuffer);
  } else if (viewerKind === 'docx') {
    const isPkZip =
      bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!isPkZip) {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
    try {
      const { plainSample } = await convertDocxBufferToSafeHtml(arrayBuffer);
      docxPreviewText = plainSample.slice(0, 320);
    } catch {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
  } else if (viewerKind === 'spreadsheet') {
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.ods')) {
      const isPkZip =
        bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
      if (!isPkZip) {
        throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
      }
    }
    if (lowerName.endsWith('.csv') && bytes.includes(0x00)) {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
    try {
      const parsedSheet = await convertSpreadsheetBufferToSafeHtml(
        arrayBuffer,
        0
      );
      sheetSummary = {
        sheetCount: parsedSheet.sheetNames.length,
        firstSheetName: parsedSheet.activeSheetName,
        rowCount: parsedSheet.rowCount,
        colCount: parsedSheet.colCount,
      };
    } catch {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
  } else if (viewerKind === 'image') {
    imageDimensions = await decodeRealImageDimensions(typedBlob);
  } else if (viewerKind === 'text') {
    let decodedText = '';
    try {
      decodedText = await readBlobAsTextWithReader(typedBlob);
    } catch {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
    if (decodedText.includes('\u0000')) {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
    if (lowerName.endsWith('.json') && decodedText.trim().length > 0) {
      try {
        JSON.parse(decodedText);
      } catch {
        throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
      }
    }
    textPreview = decodedText.slice(0, 600);
  }

  const sha256 = await computeSha256Hex(arrayBuffer);

  return {
    originalFile: file,
    typedBlob: new Blob([arrayBuffer], { type: mimeType }),
    originalName,
    extension,
    mimeType,
    sizeBytes: file.size,
    sha256,
    base64DataUrl: '',
    viewerKind,
    pdfPageCount,
    imageDimensions,
    docxPreviewText,
    sheetSummary,
    textPreview,
  };
}

/**
 * Valida la integridad básica de un Blob antes de renderizarlo o descargarlo.
 */
export async function validateBlobIntegrity(
  blob: Blob,
  kind: ViewerKind
): Promise<void> {
  if (!blob || blob.size <= 0) {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }

  if (kind === 'pdf') {
    const sliceBuf = await readBlobAsArrayBuffer(blob.slice(0, 1024));
    if (!hasPdfSignature(new Uint8Array(sliceBuf))) {
      throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
    }
  }
}

function putRecordInDocucloudStore(
  db: IDBDatabase,
  record: DocucloudIndexedDbRecord
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOCUCLOUD_STORE_NAME, 'readwrite');
    const store = tx.objectStore(DOCUCLOUD_STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error('Error al guardar en documents_store.'));
    tx.onabort = () =>
      reject(tx.error || new Error('Transacción abortada en Docucloud_DB.'));
  });
}

export interface SaveIndexedDbDocumentOptions {
  categoria?: DocumentCategory;
  tipoArchivo?: DocumentFileType;
  starred?: boolean;
  uploadedAt?: number;
  updatedAt?: number;
  silentLog?: boolean;
}

/**
 * Guarda sin corrupción en `Docucloud_DB` -> `documents_store` el objeto binario original
 * (`Blob` y `ArrayBuffer`), los metadatos (`nombre`, `tamanoBytes`, `tipo`, `fechaCarga`, `categoria`)
 * y el `userId` propietario.
 */
export async function saveDocumentBinaryPayload(
  userId: string,
  docId: string,
  payload: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    base64DataUrl?: string;
    blob: Blob;
  },
  options: SaveIndexedDbDocumentOptions = {}
): Promise<void> {
  const effectiveSize = Math.max(
    payload.sizeBytes || 0,
    payload.blob?.size || 0
  );
  if (effectiveSize > MAX_FILE_SIZE_BYTES) {
    throw new FileSizeLimitExceededError(effectiveSize);
  }
  if (!payload.blob || payload.blob.size <= 0) {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }

  const resolvedMime = inferMimeTypeFromName(
    payload.originalName,
    payload.mimeType || payload.blob.type
  );
  const arrayBuffer = await readBlobAsArrayBuffer(payload.blob);
  const cleanBlob = new Blob([arrayBuffer], { type: resolvedMime });

  const now = Date.now();
  const uploadedAt = options.uploadedAt ?? now;
  const updatedAt = options.updatedAt ?? uploadedAt;
  const categoria: DocumentCategory =
    options.categoria && CATEGORIES.includes(options.categoria)
      ? options.categoria
      : 'Otros';
  const tipoArchivo: DocumentFileType =
    options.tipoArchivo && FILE_TYPES.includes(options.tipoArchivo)
      ? options.tipoArchivo
      : detectDocumentType(payload.originalName, resolvedMime);

  const record: DocucloudIndexedDbRecord = {
    id: docId,
    userId,
    nombre: payload.originalName,
    tamanoBytes: arrayBuffer.byteLength,
    tipo: resolvedMime,
    tipoArchivo,
    fechaCarga: new Date(uploadedAt).toISOString(),
    categoria,
    starred: Boolean(options.starred),
    uploadedAt,
    updatedAt,
    sha256: payload.sha256,
    blob: cleanBlob,
    arrayBuffer,
  };

  try {
    const db = await openDocucloudDatabase();
    try {
      await putRecordInDocucloudStore(db, record);
    } catch {
      // Respaldo para motores que serializan ArrayBuffer nativo pero no Blob directo
      await putRecordInDocucloudStore(db, {
        ...record,
        blob: undefined,
        arrayBuffer,
      });
    } finally {
      db.close();
    }

    if (!options.silentLog) {
      console.log(`Archivo ${record.nombre} guardado con éxito en IndexedDB`, {
        baseDeDatos: DOCUCLOUD_DB_NAME,
        almacen: DOCUCLOUD_STORE_NAME,
        id: record.id,
        userId: record.userId,
        categoria: record.categoria,
        tamanoBytes: record.tamanoBytes,
        tipo: record.tipo,
        fechaCarga: record.fechaCarga,
      });
    }
  } catch {
    // Respaldo de emergencia en memoria de sesión únicamente si IndexedDB está bloqueado
    emergencySessionFallback.set(makeFallbackKey(userId, docId), record);
  }
}

/**
 * Guarda un Blob directo en `Docucloud_DB` -> `documents_store` junto con sus metadatos completos.
 */
export async function saveDocumentBlob(
  userId: string,
  docId: string,
  blob: Blob,
  mimeType?: string,
  originalName = 'Documento',
  options: SaveIndexedDbDocumentOptions = {}
): Promise<void> {
  if (!blob || blob.size <= 0) {
    throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
  }
  if (blob.size > MAX_FILE_SIZE_BYTES) {
    throw new FileSizeLimitExceededError(blob.size);
  }

  const resolvedMime = inferMimeTypeFromName(
    originalName,
    mimeType || blob.type
  );
  const normalizedBlob =
    blob.type === resolvedMime ? blob : new Blob([blob], { type: resolvedMime });
  const arrayBuffer = await readBlobAsArrayBuffer(normalizedBlob);
  const sha256 = await computeSha256Hex(arrayBuffer);

  await saveDocumentBinaryPayload(
    userId,
    docId,
    {
      originalName,
      mimeType: resolvedMime,
      sizeBytes: normalizedBlob.size,
      sha256,
      blob: normalizedBlob,
    },
    options
  );
}

/**
 * Consulta en tiempo real los documentos aislados de un usuario en `Docucloud_DB` -> `documents_store`
 * utilizando el índice nativo `userId`.
 */
export async function listUserDocumentsFromIndexedDB(
  userId: string
): Promise<DocucloudDocument[]> {
  try {
    const db = await openDocucloudDatabase();
    const records = await new Promise<DocucloudIndexedDbRecord[]>((resolve) => {
      const tx = db.transaction(DOCUCLOUD_STORE_NAME, 'readonly');
      const store = tx.objectStore(DOCUCLOUD_STORE_NAME);
      const userIndex = store.index('userId');
      const req = userIndex.getAll(IDBKeyRange.only(userId));
      req.onsuccess = () => {
        db.close();
        resolve((req.result as DocucloudIndexedDbRecord[]) || []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });

    return records
      .filter((r) => r.userId === userId)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.nombre,
        category: normalizeCategoryToSpanish(r.categoria),
        type: FILE_TYPES.includes(r.tipoArchivo)
          ? r.tipoArchivo
          : detectDocumentType(r.nombre, r.tipo),
        sizeBytes: r.tamanoBytes,
        starred: Boolean(r.starred),
        uploadedAt: r.uploadedAt || Date.parse(r.fechaCarga) || Date.now(),
        updatedAt: r.updatedAt || r.uploadedAt || Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Actualiza metadatos (`nombre`, `categoria`, `starred`, `updatedAt`) directamente en `documents_store`
 * manteniendo intacto el `Blob` binario original y los índices `userId` / `categoria`.
 */
export async function updateDocumentMetadataInIndexedDB(
  userId: string,
  docId: string,
  patch: {
    nombre?: string;
    categoria?: DocumentCategory;
    starred?: boolean;
    updatedAt?: number;
  }
): Promise<DocucloudDocument | null> {
  try {
    const db = await openDocucloudDatabase();
    const existing = await new Promise<DocucloudIndexedDbRecord | null>(
      (resolve) => {
        const tx = db.transaction(DOCUCLOUD_STORE_NAME, 'readonly');
        const req = tx.objectStore(DOCUCLOUD_STORE_NAME).get(docId);
        req.onsuccess = () =>
          resolve((req.result as DocucloudIndexedDbRecord) || null);
        req.onerror = () => resolve(null);
      }
    );

    if (!existing || existing.userId !== userId) {
      db.close();
      return null;
    }

    const updatedRecord: DocucloudIndexedDbRecord = {
      ...existing,
      nombre: patch.nombre ?? existing.nombre,
      categoria: patch.categoria ?? existing.categoria,
      starred: patch.starred !== undefined ? patch.starred : existing.starred,
      updatedAt: patch.updatedAt ?? Date.now(),
    };

    try {
      await putRecordInDocucloudStore(db, updatedRecord);
    } finally {
      db.close();
    }

    return {
      id: updatedRecord.id,
      userId: updatedRecord.userId,
      name: updatedRecord.nombre,
      category: normalizeCategoryToSpanish(updatedRecord.categoria),
      type: FILE_TYPES.includes(updatedRecord.tipoArchivo)
        ? updatedRecord.tipoArchivo
        : detectDocumentType(updatedRecord.nombre, updatedRecord.tipo),
      sizeBytes: updatedRecord.tamanoBytes,
      starred: Boolean(updatedRecord.starred),
      uploadedAt: updatedRecord.uploadedAt,
      updatedAt: updatedRecord.updatedAt,
    };
  } catch {
    return null;
  }
}

function hydrateIndexedDbRecord(
  record: Partial<DocucloudIndexedDbRecord>,
  fallbackName: string
): {
  blob: Blob;
  mimeType: string;
  sha256: string;
} | null {
  const resolvedMime = inferMimeTypeFromName(
    record.nombre || fallbackName,
    record.tipo || (record.blob instanceof Blob ? record.blob.type : '')
  );

  if (record.blob instanceof Blob && record.blob.size > 0) {
    const typedBlob =
      record.blob.type === resolvedMime
        ? record.blob
        : new Blob([record.blob], { type: resolvedMime });
    return {
      blob: typedBlob,
      mimeType: resolvedMime,
      sha256: record.sha256 || 'verificado',
    };
  }

  if (record.arrayBuffer && record.arrayBuffer.byteLength > 0) {
    return {
      blob: new Blob([record.arrayBuffer], { type: resolvedMime }),
      mimeType: resolvedMime,
      sha256: record.sha256 || 'verificado',
    };
  }

  return null;
}

/**
 * Lee en tiempo real el archivo binario original (`Blob`) directamente desde `Docucloud_DB` -> `documents_store`
 * validando que pertenezca estrictamente al `userId` activo.
 */
export async function getStoredDocumentBinary(
  userId: string,
  docId: string,
  fallbackName = ''
): Promise<{
  blob: Blob;
  base64DataUrl: string;
  mimeType: string;
  sha256: string;
} | null> {
  try {
    const db = await openDocucloudDatabase();
    const record = await new Promise<DocucloudIndexedDbRecord | null>(
      (resolve) => {
        const tx = db.transaction(DOCUCLOUD_STORE_NAME, 'readonly');
        const store = tx.objectStore(DOCUCLOUD_STORE_NAME);
        const req = store.get(docId);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as DocucloudIndexedDbRecord) || null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      }
    );

    if (record && record.userId === userId) {
      const hydrated = hydrateIndexedDbRecord(record, fallbackName);
      if (hydrated) {
        console.log('Cargando archivo desde IndexedDB', {
          baseDeDatos: DOCUCLOUD_DB_NAME,
          almacen: DOCUCLOUD_STORE_NAME,
          id: record.id,
          nombre: record.nombre,
          userId: record.userId,
          categoria: record.categoria,
          tamanoBytes: record.tamanoBytes,
        });
        return {
          blob: hydrated.blob,
          base64DataUrl: '',
          mimeType: hydrated.mimeType,
          sha256: hydrated.sha256,
        };
      }
    }
  } catch {
    // Continuar con respaldo de emergencia o migración legada
  }

  const legacyV3 = await tryMigrateFromLegacyV3(userId, docId);
  if (legacyV3) {
    const hydrated = hydrateIndexedDbRecord(
      {
        nombre: legacyV3.originalName || fallbackName,
        tipo: legacyV3.mimeType,
        blob: legacyV3.blob,
        arrayBuffer: legacyV3.arrayBuffer,
        sha256: legacyV3.sha256,
      },
      fallbackName
    );
    if (hydrated) {
      await saveDocumentBlob(
        userId,
        docId,
        hydrated.blob,
        hydrated.mimeType,
        legacyV3.originalName || fallbackName || 'Documento',
        { silentLog: true }
      );
      console.log('Cargando archivo desde IndexedDB', {
        baseDeDatos: DOCUCLOUD_DB_NAME,
        almacen: DOCUCLOUD_STORE_NAME,
        id: docId,
        nombre: legacyV3.originalName || fallbackName,
        userId,
      });
      return {
        blob: hydrated.blob,
        base64DataUrl: '',
        mimeType: hydrated.mimeType,
        sha256: hydrated.sha256,
      };
    }
  }

  const emergency = emergencySessionFallback.get(makeFallbackKey(userId, docId));
  if (emergency && emergency.userId === userId) {
    const hydrated = hydrateIndexedDbRecord(emergency, fallbackName);
    if (hydrated) {
      return {
        blob: hydrated.blob,
        base64DataUrl: '',
        mimeType: hydrated.mimeType,
        sha256: hydrated.sha256,
      };
    }
  }

  return null;
}

/**
 * Elimina de `Docucloud_DB` -> `documents_store` el registro binario asociado al `docId` del usuario.
 */
export async function deleteDocumentBlob(
  userId: string,
  docId: string
): Promise<void> {
  emergencySessionFallback.delete(makeFallbackKey(userId, docId));

  try {
    const db = await openDocucloudDatabase();
    const existing = await new Promise<DocucloudIndexedDbRecord | null>(
      (resolve) => {
        const tx = db.transaction(DOCUCLOUD_STORE_NAME, 'readonly');
        const req = tx.objectStore(DOCUCLOUD_STORE_NAME).get(docId);
        req.onsuccess = () =>
          resolve((req.result as DocucloudIndexedDbRecord) || null);
        req.onerror = () => resolve(null);
      }
    );

    if (!existing || existing.userId !== userId) {
      db.close();
      return;
    }

    await new Promise<void>((resolve) => {
      const tx = db.transaction(DOCUCLOUD_STORE_NAME, 'readwrite');
      tx.objectStore(DOCUCLOUD_STORE_NAME).delete(docId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignorar errores de limpieza
  }
}

function escapePdfLiteral(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function encodeWinAnsiBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i] = code <= 255 ? code : 63;
  }
  return out;
}

/**
 * Construye un archivo binario %PDF-1.4 real (application/pdf) exclusivamente para los documentos de ejemplo preinstalados.
 */
export function createDemoPdfBlob(
  title: string,
  category: string,
  ownerName: string,
  ownerEmail: string,
  sizeLabel: string,
  dateLabel: string
): Blob {
  const safeTitle = escapePdfLiteral(title.slice(0, 62));
  const safeCategory = escapePdfLiteral(category);
  const safeOwner = escapePdfLiteral(`${ownerName} (${ownerEmail})`);
  const safeDate = escapePdfLiteral(dateLabel);
  const safeSize = escapePdfLiteral(sizeLabel);

  const bodyLines = [
    'DOCUMENTO PDF DE EJEMPLO - DOCUCLOUD',
    `Categoria: ${safeCategory}`,
    `Fecha: ${safeDate}   |   Tamano registrado: ${safeSize}`,
    `Titular: ${safeOwner}`,
    '',
    '1. PERSISTENCIA EN INDEXEDDB (Docucloud_DB -> documents_store)',
    'Este documento binario se almacena y recupera directamente desde',
    'IndexedDB mediante objetos Blob reales y URL.createObjectURL(blob).',
    '',
    '2. MOTOR DE RENDERIZADO EN LIENZO (CANVAS PDF.JS)',
    'Docucloud renderiza cada pagina sobre <canvas> y soporta PDF (.pdf),',
    'Word (.docx), hojas Excel (.xlsx, .xls, .csv), imagenes y texto (.txt).',
  ];

  const streamCommands: string[] = [
    '0.118 0.227 0.541 rg',
    '42 742 511 58 re f',
    'BT',
    '/F2 14 Tf',
    '1 1 1 rg',
    '58 774 Td',
    '(DOCUCLOUD - BOVEDA PERSONAL) Tj',
    '/F1 10 Tf',
    '0.859 0.918 0.996 rg',
    '0 -18 Td',
    '(Tu informacion segura, siempre a tu alcance) Tj',
    'ET',
    'BT',
    '/F2 15 Tf',
    '0.059 0.090 0.165 rg',
    '42 708 Td',
    `(${safeTitle}) Tj`,
    'ET',
    '0.886 0.910 0.941 RG',
    '1 w',
    '42 694 m 553 694 l S',
    'BT',
    '/F1 11 Tf',
    '0.059 0.090 0.165 rg',
    '42 668 Td',
    '18 TL',
  ];

  for (const line of bodyLines) {
    if (line === '') {
      streamCommands.push('T*');
    } else {
      streamCommands.push(`(${escapePdfLiteral(line)}) Tj T*`);
    }
  }
  streamCommands.push('ET');

  const contentStream = streamCommands.join('\n');
  const streamBytes = encodeWinAnsiBytes(contentStream);

  const objects: Uint8Array[] = [
    encodeWinAnsiBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    encodeWinAnsiBytes(
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'
    ),
    encodeWinAnsiBytes(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n'
    ),
    encodeWinAnsiBytes(
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
    ),
    encodeWinAnsiBytes(
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
    ),
  ];

  const obj6Header = encodeWinAnsiBytes(
    `6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`
  );
  const obj6Footer = encodeWinAnsiBytes('\nendstream\nendobj\n');
  const obj6Combined = new Uint8Array(
    obj6Header.length + streamBytes.length + obj6Footer.length
  );
  obj6Combined.set(obj6Header, 0);
  obj6Combined.set(streamBytes, obj6Header.length);
  obj6Combined.set(obj6Footer, obj6Header.length + streamBytes.length);
  objects.push(obj6Combined);

  const pdfHeader = encodeWinAnsiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const offsets: number[] = [];
  let cursor = pdfHeader.length;

  for (const obj of objects) {
    offsets.push(cursor);
    cursor += obj.length;
  }

  const xrefOffset = cursor;
  const xrefLines = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((off) => `${String(off).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n');
  const xrefBytes = encodeWinAnsiBytes(xrefLines);

  const totalLength = cursor + xrefBytes.length;
  const fullPdf = new Uint8Array(totalLength);
  let pos = 0;
  fullPdf.set(pdfHeader, pos);
  pos += pdfHeader.length;
  for (const obj of objects) {
    fullPdf.set(obj, pos);
    pos += obj.length;
  }
  fullPdf.set(xrefBytes, pos);

  return new Blob([fullPdf], { type: 'application/pdf' });
}

/**
 * Construye una imagen PNG real (image/png) exclusivamente para la imagen de demostración preinstalada.
 */
export async function createDemoPngBlob(
  title: string,
  category: string,
  ownerName: string,
  dateLabel: string
): Promise<Blob> {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 3;
      ctx.fillRect(48, 48, 664, 864);
      ctx.strokeRect(48, 48, 664, 864);

      const grad = ctx.createLinearGradient(48, 48, 712, 180);
      grad.addColorStop(0, '#1E3A8A');
      grad.addColorStop(1, '#2563EB');
      ctx.fillStyle = grad;
      ctx.fillRect(48, 48, 664, 132);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('DOCUCLOUD · IMAGEN DEMO PNG', 84, 108);

      ctx.fillStyle = '#DBEAFE';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Categoría: ${category}  ·  ${dateLabel}`, 84, 146);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(title.slice(0, 38), 84, 245);

      ctx.fillStyle = '#EFF6FF';
      ctx.fillRect(84, 290, 592, 340);
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 2;
      ctx.strokeRect(84, 290, 592, 340);

      ctx.fillStyle = '#1E3A8A';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`Titular: ${ownerName}`, 116, 360);

      ctx.fillStyle = '#334155';
      ctx.font = '20px sans-serif';
      ctx.fillText('Documento gráfico de ejemplo en formato PNG real.', 116, 420);
      ctx.fillText(
        'Almacenado y leído en tiempo real desde IndexedDB',
        116,
        465
      );
      ctx.fillText('(Docucloud_DB -> documents_store).', 116, 505);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (pngBlob) return pngBlob;
    }
  }

  const fallbackPngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return base64DataUrlToBlob(fallbackPngBase64, 'image/png');
}

/**
 * Recupera el `Blob` directamente desde `Docucloud_DB` (`documents_store`) en tiempo real.
 * Si es un documento demo preinstalado aún no materializado en IndexedDB, lo persiste primero en `documents_store`
 * y lo devuelve para su lectura mediante `URL.createObjectURL(blob)`.
 */
export async function getOrCreateDocumentBlob(
  user: DocucloudUser,
  doc: DocucloudDocument
): Promise<ResolvedDocumentBinary> {
  const stored = await getStoredDocumentBinary(user.uid, doc.id, doc.name);
  if (stored) {
    const kind = resolveViewerKind(doc.name, stored.mimeType, doc.type);
    return {
      blob: stored.blob,
      base64DataUrl: stored.base64DataUrl,
      mimeType: stored.mimeType,
      sha256: stored.sha256,
      isUserUploaded: !doc.id.startsWith('doc_demo_'),
      kind,
    };
  }

  if (doc.id.startsWith('doc_demo_')) {
    const dateLabel = formatDocDate(doc.updatedAt, user.dateFormat, true);
    const sizeLabel = formatBytes(doc.sizeBytes);
    const demoKind = resolveViewerKind(doc.name, '', doc.type);

    const demoBlob =
      demoKind === 'image'
        ? await createDemoPngBlob(
            doc.name,
            doc.category,
            user.fullName,
            dateLabel
          )
        : createDemoPdfBlob(
            doc.name,
            doc.category,
            user.fullName,
            user.email,
            sizeLabel,
            dateLabel
          );

    const buf = await readBlobAsArrayBuffer(demoBlob);
    const sha256 = await computeSha256Hex(buf);

    await saveDocumentBinaryPayload(
      user.uid,
      doc.id,
      {
        originalName: doc.name,
        mimeType: demoBlob.type,
        sizeBytes: demoBlob.size,
        sha256,
        blob: demoBlob,
      },
      {
        categoria: doc.category,
        tipoArchivo: doc.type,
        starred: doc.starred,
        uploadedAt: doc.uploadedAt,
        updatedAt: doc.updatedAt,
        silentLog: true,
      }
    );

    console.log('Cargando archivo desde IndexedDB', {
      baseDeDatos: DOCUCLOUD_DB_NAME,
      almacen: DOCUCLOUD_STORE_NAME,
      id: doc.id,
      nombre: doc.name,
      userId: user.uid,
      categoria: doc.category,
    });

    return {
      blob: demoBlob,
      base64DataUrl: '',
      mimeType: demoBlob.type,
      sha256,
      isUserUploaded: false,
      kind: demoKind === 'image' ? 'image' : 'pdf',
    };
  }

  throw new Error(VIEWER_LOAD_ERROR_MESSAGE);
}

/**
 * Descarga directamente el Blob binario original mediante un `URL.createObjectURL(blob)` temporal
 * y libera la memoria automáticamente con `URL.revokeObjectURL()`.
 */
export function triggerDirectBlobDownload(
  blob: Blob,
  exactFileName: string
): void {
  const safeName = exactFileName.trim() || 'archivo';
  const blobUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 2500);
  }
}

export async function downloadVaultDocument(
  user: DocucloudUser,
  doc: DocucloudDocument
): Promise<void> {
  const { blob, kind } = await getOrCreateDocumentBlob(user, doc);
  await validateBlobIntegrity(blob, kind);
  triggerDirectBlobDownload(blob, doc.name);
}
