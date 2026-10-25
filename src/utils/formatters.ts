import {
  DateFormatOption,
  DocumentCategory,
  DocumentFileType,
  MAX_STORAGE_BYTES,
} from '../types/docucloud';

/**
 * Formatea bytes en unidades amigables (B, KB, MB, GB).
 * Ejemplos:
 * - 0 -> "0 B"
 * - 1048576 -> "1.00 MB"
 * - 10737418240 -> "10.00 GB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k))
  );
  const value = bytes / Math.pow(k, i);
  if (i === 0) return `${Math.round(value)} B`;
  return `${value.toFixed(dm)} ${sizes[i]}`;
}

/**
 * Calcula el porcentaje exacto sobre el límite de 10 GB (10,737,418,240 bytes).
 */
export function getStoragePercentage(
  usedBytes: number,
  maxBytes: number = MAX_STORAGE_BYTES
): number {
  if (maxBytes <= 0 || usedBytes <= 0) return 0;
  const pct = (usedBytes / maxBytes) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function formatPercentageLabel(pct: number): string {
  if (pct === 0) return '0%';
  if (pct < 0.01) return '< 0.01%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

/**
 * Formatea marcas de tiempo en español según el formato preferido del usuario.
 */
export function formatDocDate(
  timestampMs: number,
  dateFormat?: DateFormatOption,
  includeTime = false
): string {
  const d = new Date(timestampMs || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const monthNum = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  const shortMonths = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];

  let datePart = `${d.getDate()} ${shortMonths[d.getMonth()]} ${year}`;
  if (dateFormat === 'DD/MM/YYYY') {
    datePart = `${day}/${monthNum}/${year}`;
  } else if (dateFormat === 'MM/DD/YYYY') {
    datePart = `${monthNum}/${day}/${year}`;
  } else if (dateFormat === 'YYYY-MM-DD') {
    datePart = `${year}-${monthNum}-${day}`;
  }

  if (!includeTime) return datePart;

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}, ${hours}:${minutes}`;
}

export function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Hace ${diffHrs} h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDocDate(timestampMs);
}

/**
 * Separa un nombre de archivo en su base editable y su extensión original exacta (ej. ".jpg", ".pdf", ".png").
 */
export function splitFilename(filename: string): {
  baseName: string;
  extension: string;
} {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { baseName: trimmed || 'Documento', extension: '' };
  }
  return {
    baseName: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot),
  };
}

/**
 * Une el nombre base y la extensión original exacta sin duplicar extensiones ni agregar sufijos falsos.
 */
export function composeExactFilename(
  baseNameRaw: string,
  extension: string
): string {
  const cleanBase = baseNameRaw.trim();
  const cleanExt = extension.trim();
  if (!cleanExt) return cleanBase;
  if (cleanBase.toLowerCase().endsWith(cleanExt.toLowerCase())) {
    const stripped = cleanBase.slice(0, cleanBase.length - cleanExt.length).trim();
    return `${stripped || cleanBase}${cleanExt}`;
  }
  return `${cleanBase}${cleanExt}`;
}

/**
 * Conserva el tipo MIME real provisto por el archivo nativo o lo infiere exactamente de su extensión original.
 */
export function inferMimeTypeFromName(
  filename: string,
  providedMime = ''
): string {
  const cleanMime = providedMime.trim();
  if (cleanMime && cleanMime !== 'application/octet-stream') {
    return cleanMime;
  }

  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.jfif') ||
    lower.endsWith('.pjpeg') ||
    lower.endsWith('.pjp')
  ) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.txt') || lower.endsWith('.log'))
    return 'text/plain;charset=utf-8';
  if (lower.endsWith('.csv')) return 'text/csv;charset=utf-8';
  if (lower.endsWith('.tsv')) return 'text/tab-separated-values;charset=utf-8';
  if (lower.endsWith('.md') || lower.endsWith('.markdown'))
    return 'text/markdown;charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json;charset=utf-8';
  if (lower.endsWith('.xml')) return 'application/xml;charset=utf-8';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx'))
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lower.endsWith('.pptx'))
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lower.endsWith('.zip')) return 'application/zip';

  return cleanMime || 'application/octet-stream';
}

/**
 * Normaliza cualquier categoría previa o en inglés a las 5 categorías oficiales en español.
 */
export function normalizeCategoryToSpanish(raw: unknown): DocumentCategory {
  switch (raw) {
    case 'Académicos':
    case 'Academic':
      return 'Académicos';
    case 'Personales':
    case 'Personal':
      return 'Personales';
    case 'Trabajo':
    case 'Work':
      return 'Trabajo';
    case 'Certificados':
    case 'Certificates':
      return 'Certificados';
    case 'Otros':
    case 'Other':
    default:
      return 'Otros';
  }
}

/**
 * Detecta el tipo de archivo según su tipo MIME nativo o su extensión: 'pdf' | 'image' | 'doc' | 'xls'.
 */
export function detectDocumentType(
  filename: string,
  mimeType = ''
): DocumentFileType {
  const lower = filename.trim().toLowerCase();
  const mime = mimeType.trim().toLowerCase();

  if (mime.startsWith('image/') || /\.(png|jpe?g|jfif|pjpeg|pjp|gif|webp|svg|bmp|avif|ico|heic|heif)$/.test(lower)) {
    return 'image';
  }
  if (mime === 'application/pdf' || mime.includes('pdf') || lower.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    /\.(xlsx?|csv|tsv|ods|numbers)$/.test(lower) ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv')
  ) {
    return 'xls';
  }
  return 'doc';
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 40);
  return cleaned || 'usuarioboveda';
}
