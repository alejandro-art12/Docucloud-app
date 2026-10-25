import { DocucloudUser, SortOption } from '../types/docucloud';

export type LayoutViewMode = 'list' | 'grid';
export type ViewerStageTheme = 'dark' | 'light';

export interface DocucloudUiPreferences {
  layoutMode: LayoutViewMode;
  viewerTheme: ViewerStageTheme;
  sortBy: SortOption;
}

export interface LightweightSessionSnapshot {
  currentUser: {
    uid: string;
    fullName: string;
    email: string;
    username: string;
    accountType: DocucloudUser['accountType'];
    dateFormat: DocucloudUser['dateFormat'];
    storageMode: DocucloudUser['storageMode'];
    usedStorageBytes: number;
    maxStorageBytes: number;
  };
  sessionToken: string;
  updatedAt: number;
}

export const UI_PREFERENCES_STORAGE_KEY = 'docucloud_ui_preferences';
export const SESSION_STATE_STORAGE_KEY = 'docucloud_session_state';

const DEFAULT_UI_PREFERENCES: DocucloudUiPreferences = {
  layoutMode: 'list',
  viewerTheme: 'dark',
  sortBy: 'date',
};

/**
 * Elimina de LocalStorage cualquier cadena Base64 pesada o residuo binario legado
 * para garantizar que LocalStorage solo almacene metadatos ligeros (< 5 MB) y evitar QuotaExceededError.
 */
export function purgeHeavyPayloadsFromLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith('docucloud_b64_') ||
        key.startsWith('docucloud_blob_')
      ) {
        keysToRemove.push(key);
        continue;
      }
      if (key.startsWith('docucloud_')) {
        const val = localStorage.getItem(key);
        if (val && val.includes(';base64,')) {
          keysToRemove.push(key);
        }
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // Ignorar en modos de navegación restringidos
  }
}

export function readUiPreferences(): DocucloudUiPreferences {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_UI_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<DocucloudUiPreferences>;
    return {
      layoutMode: parsed.layoutMode === 'grid' ? 'grid' : 'list',
      viewerTheme: parsed.viewerTheme === 'light' ? 'light' : 'dark',
      sortBy:
        parsed.sortBy === 'name' || parsed.sortBy === 'size'
          ? parsed.sortBy
          : 'date',
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function updateUiPreferences(
  patch: Partial<DocucloudUiPreferences>
): DocucloudUiPreferences {
  const next: DocucloudUiPreferences = {
    ...readUiPreferences(),
    ...patch,
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignorar si el almacenamiento está restringido
    }
  }
  return next;
}

export function syncSessionSnapshotInLocalStorage(
  user: DocucloudUser | null
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!user) {
      localStorage.removeItem(SESSION_STATE_STORAGE_KEY);
      return;
    }

    let existingToken = '';
    const existingRaw = localStorage.getItem(SESSION_STATE_STORAGE_KEY);
    if (existingRaw) {
      try {
        const parsed = JSON.parse(
          existingRaw
        ) as Partial<LightweightSessionSnapshot>;
        if (
          parsed.currentUser?.uid === user.uid &&
          typeof parsed.sessionToken === 'string'
        ) {
          existingToken = parsed.sessionToken;
        }
      } catch {
        // Generar nuevo token simulado ligero
      }
    }

    const token =
      existingToken ||
      `dc_session_${user.uid}_${Date.now().toString(36)}`;

    const snapshot: LightweightSessionSnapshot = {
      currentUser: {
        uid: user.uid,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        accountType: user.accountType,
        dateFormat: user.dateFormat,
        storageMode: user.storageMode,
        usedStorageBytes: user.usedStorageBytes,
        maxStorageBytes: user.maxStorageBytes,
      },
      sessionToken: token,
      updatedAt: Date.now(),
    };

    localStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignorar errores en modo privado estricto
  }
}
