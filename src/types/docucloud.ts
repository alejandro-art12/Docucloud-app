export const MAX_STORAGE_BYTES = 10737418240; // Estrictamente 10 GB = 10 * 1024 * 1024 * 1024 bytes
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // Estrictamente 10 MB = 10,485,760 bytes por archivo individual

export const OFFICIAL_APP_NAME = 'Docucloud';
export const OFFICIAL_SLOGAN = 'Tu información segura, siempre a tu alcance';
export const OFFICIAL_SUBTITLE =
  'Organiza, guarda y consulta tus documentos desde un solo lugar';
export const APP_VERSION = '2.4.0 (Compilación 108)';

// Constantes de validación sincronizadas con firebase-blueprint.json y firestore.rules
export const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const VALID_USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
export const MAX_UID_LENGTH = 128;
export const MAX_FULLNAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_USERNAME_LENGTH = 40;
export const MAX_PHONE_LENGTH = 30;
export const MAX_COUNTRY_CODE_LENGTH = 10;
export const MAX_BIO_LENGTH = 300;
export const MAX_DOC_NAME_LENGTH = 120;
export const MAX_DOC_BASENAME_LENGTH = 105;

export const CATEGORIES = [
  'Académicos',
  'Personales',
  'Trabajo',
  'Certificados',
  'Otros',
] as const;

export type DocumentCategory = (typeof CATEGORIES)[number];

export const FILE_TYPES = ['pdf', 'image', 'doc', 'xls'] as const;

export type DocumentFileType = (typeof FILE_TYPES)[number];

export type AccountTypeOption = 'personal' | 'independent';
export type DateFormatOption = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type StorageMode = 'firebase' | 'local';

export interface DocucloudUser {
  uid: string;
  fullName: string;
  email: string;
  usedStorageBytes: number;
  maxStorageBytes: number;
  createdAt: number;
  updatedAt: number;
  username: string;
  phone: string;
  countryCode: string;
  bio: string;
  accountType: AccountTypeOption;
  dateFormat: DateFormatOption;
  securityAlerts: boolean;
  storageMode: StorageMode;
}

export interface DocucloudDocument {
  id: string;
  userId: string;
  name: string;
  category: DocumentCategory;
  type: DocumentFileType;
  sizeBytes: number;
  starred: boolean;
  uploadedAt: number;
  updatedAt: number;
}

export type PublicRoute =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'unregistered-account';

export type PrivateRoute =
  | 'dashboard'
  | 'documents'
  | 'categories'
  | 'upload'
  | 'details'
  | 'search'
  | 'profile'
  | 'edit-profile'
  | 'change-password';

export type AppRoute = PublicRoute | PrivateRoute;

export type FileFilterOption = 'all' | 'pdf' | 'image' | 'documents';
export type SortOption = 'date' | 'name' | 'size';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ProfileUpdatePayload {
  fullName: string;
  email: string;
  username: string;
  phone: string;
  countryCode: string;
  bio: string;
  accountType: AccountTypeOption;
  dateFormat: DateFormatOption;
  securityAlerts: boolean;
}
