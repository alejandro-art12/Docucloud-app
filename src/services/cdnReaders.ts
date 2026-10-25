/**
 * Adaptador tipado y seguro para las librerías CDN integradas en index.html:
 * - PDF.js 3.11.174 (window.pdfjsLib + workerSrc CDN)
 * - Mammoth.js 1.6.0 (window.mammoth)
 * - SheetJS / XLSX 0.18.5 (window.XLSX)
 */

export const PDFJS_CDN_SCRIPT =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
export const PDFJS_CDN_WORKER =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
export const MAMMOTH_CDN_SCRIPT =
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
export const XLSX_CDN_SCRIPT =
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface PdfPageProxy {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
}

export interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
  destroy: () => Promise<void>;
}

export interface PdfJsGlobal {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (src: { data: Uint8Array }) => PdfLoadingTask;
}

export interface MammothGlobal {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{
    value: string;
    messages: Array<{ type: string; message: string }>;
  }>;
}

export interface XlsxWorkBook {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

export interface XlsxGlobal {
  read: (
    data: Uint8Array | ArrayBuffer,
    opts?: { type?: 'array' | 'buffer'; codepage?: number; cellDates?: boolean }
  ) => XlsxWorkBook;
  utils: {
    sheet_to_html: (
      worksheet: unknown,
      opts?: { id?: string; editable?: boolean }
    ) => string;
  };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsGlobal;
    mammoth?: MammothGlobal;
    XLSX?: XlsxGlobal;
  }
}

const pendingScripts = new Map<string, Promise<void>>();

function ensureExternalScript(
  url: string,
  isReady: () => boolean
): Promise<void> {
  if (isReady()) {
    return Promise.resolve();
  }
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Entorno de documento no disponible.'));
  }

  const existing = pendingScripts.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const found = Array.from(document.getElementsByTagName('script')).find(
      (s) => s.src === url
    );
    if (found) {
      if (isReady()) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        resolve();
      };
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        pendingScripts.delete(url);
        reject(new Error(msg));
      };
      const pollTimer = window.setInterval(() => {
        if (isReady()) finish();
      }, 60);
      const timeoutTimer = window.setTimeout(() => {
        if (isReady()) finish();
        else fail(`Tiempo agotado al cargar ${url}`);
      }, 10000);
      found.addEventListener('load', () => finish(), { once: true });
      found.addEventListener(
        'error',
        () => fail(`No se pudo cargar ${url}`),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pendingScripts.delete(url);
      reject(new Error(`No se pudo cargar ${url}`));
    };
    document.head.appendChild(script);
  });

  pendingScripts.set(url, promise);
  return promise;
}

/**
 * Obtiene PDF.js desde el encabezado CDN y garantiza la configuración exacta de GlobalWorkerOptions.workerSrc.
 */
export async function getPdfJsEngine(): Promise<PdfJsGlobal> {
  if (!window.pdfjsLib) {
    await ensureExternalScript(PDFJS_CDN_SCRIPT, () => Boolean(window.pdfjsLib));
  }
  const lib = window.pdfjsLib;
  if (!lib) {
    throw new Error('Motor PDF.js no disponible.');
  }
  if (lib.GlobalWorkerOptions.workerSrc !== PDFJS_CDN_WORKER) {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_WORKER;
  }
  return lib;
}

/**
 * Obtiene Mammoth.js para conversión de archivos Word (.docx) a HTML estructurado.
 */
export async function getMammothEngine(): Promise<MammothGlobal> {
  if (!window.mammoth) {
    await ensureExternalScript(MAMMOTH_CDN_SCRIPT, () => Boolean(window.mammoth));
  }
  if (!window.mammoth) {
    throw new Error('Motor Mammoth.js no disponible.');
  }
  return window.mammoth;
}

/**
 * Obtiene SheetJS (XLSX) para lectura de hojas de cálculo (.xlsx, .xls, .csv).
 */
export async function getXlsxEngine(): Promise<XlsxGlobal> {
  if (!window.XLSX) {
    await ensureExternalScript(XLSX_CDN_SCRIPT, () => Boolean(window.XLSX));
  }
  if (!window.XLSX) {
    throw new Error('Motor SheetJS (XLSX) no disponible.');
  }
  return window.XLSX;
}

/**
 * Limpia cualquier etiqueta potencialmente insegura del HTML generado por Mammoth/SheetJS
 * conservando intactos párrafos, títulos, listas, negritas, tablas e imágenes embebidas.
 */
export function sanitizeDocumentHtml(rawHtml: string): string {
  if (typeof DOMParser === 'undefined') return rawHtml;
  const parser = new DOMParser();
  const parsed = parser.parseFromString(rawHtml, 'text/html');

  parsed
    .querySelectorAll('script, iframe, object, embed, meta, title, style, link')
    .forEach((node) => node.remove());

  parsed.body.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      const attrVal = attr.value.trim().toLowerCase();
      if (attrName.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (
        (attrName === 'href' || attrName === 'src') &&
        attrVal.startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName.toLowerCase() === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return parsed.body.innerHTML;
}

/**
 * Convierte un archivo binario .docx en HTML limpio mediante mammoth.convertToHtml({ arrayBuffer }).
 */
export async function convertDocxBufferToSafeHtml(
  arrayBuffer: ArrayBuffer
): Promise<{ html: string; plainSample: string }> {
  const mammoth = await getMammothEngine();
  const result = await mammoth.convertToHtml({
    arrayBuffer: arrayBuffer.slice(0),
  });
  const safeHtml = sanitizeDocumentHtml(result.value || '');
  const parser = new DOMParser();
  const doc = parser.parseFromString(safeHtml, 'text/html');
  const plainSample = (doc.body.textContent || '').trim();
  return { html: safeHtml, plainSample };
}

export interface ParsedSheetHtml {
  sheetNames: string[];
  activeSheetName: string;
  tableHtml: string;
  rowCount: number;
  colCount: number;
}

/**
 * Procesa hojas de cálculo (.xlsx, .xls, .csv) mediante XLSX.read(data, { type: 'array' })
 * y convierte la hoja solicitada a HTML usando XLSX.utils.sheet_to_html(), promoviendo la primera
 * fila como encabezado <thead> resaltado en azul (#2563EB).
 */
export async function convertSpreadsheetBufferToSafeHtml(
  arrayBuffer: ArrayBuffer,
  requestedSheetIndex = 0
): Promise<ParsedSheetHtml> {
  const XLSX = await getXlsxEngine();
  const data = new Uint8Array(arrayBuffer.slice(0));
  const workbook = XLSX.read(data, {
    type: 'array',
    codepage: 65001,
    cellDates: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El libro de Excel no contiene hojas válidas.');
  }

  const safeIdx = Math.min(
    Math.max(0, requestedSheetIndex),
    workbook.SheetNames.length - 1
  );
  const activeSheetName = workbook.SheetNames[safeIdx];
  const sheet = workbook.Sheets[activeSheetName];
  if (!sheet) {
    throw new Error('No se pudo leer la hoja de cálculo.');
  }

  const rawHtml = XLSX.utils.sheet_to_html(sheet, {
    id: 'docucloud-sheet-table',
    editable: false,
  });

  const parser = new DOMParser();
  const parsed = parser.parseFromString(rawHtml, 'text/html');
  const tableEl = parsed.querySelector('table');

  if (!tableEl) {
    return {
      sheetNames: workbook.SheetNames,
      activeSheetName,
      tableHtml: '',
      rowCount: 0,
      colCount: 0,
    };
  }

  // Filtrar filas completamente vacías al final si toda la tabla no está vacía
  const allRows = Array.from(tableEl.querySelectorAll('tr'));
  const nonEmptyRows = allRows.filter((row) =>
    Array.from(row.querySelectorAll('td, th')).some(
      (cell) => (cell.textContent || '').trim().length > 0
    )
  );

  if (nonEmptyRows.length === 0) {
    return {
      sheetNames: workbook.SheetNames,
      activeSheetName,
      tableHtml: '',
      rowCount: 0,
      colCount: 0,
    };
  }

  // Construir tabla limpia con <thead> azul (#2563EB) en la primera fila y <tbody> legible
  const cleanTable = parsed.createElement('table');
  const thead = parsed.createElement('thead');
  const tbody = parsed.createElement('tbody');

  const [firstRow, ...dataRows] = nonEmptyRows;
  const headerTr = parsed.createElement('tr');
  const headerCells = Array.from(firstRow.querySelectorAll('td, th'));
  let maxCols = headerCells.length;

  headerCells.forEach((cell, cIdx) => {
    const th = parsed.createElement('th');
    const txt = (cell.textContent || '').trim();
    th.textContent = txt || `Columna ${cIdx + 1}`;
    const colspan = cell.getAttribute('colspan');
    const rowspan = cell.getAttribute('rowspan');
    if (colspan) th.setAttribute('colspan', colspan);
    if (rowspan) th.setAttribute('rowspan', rowspan);
    headerTr.appendChild(th);
  });
  thead.appendChild(headerTr);

  dataRows.forEach((row) => {
    const bodyTr = parsed.createElement('tr');
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length > maxCols) maxCols = cells.length;
    cells.forEach((cell) => {
      const td = parsed.createElement('td');
      td.textContent = (cell.textContent || '').trim();
      const colspan = cell.getAttribute('colspan');
      const rowspan = cell.getAttribute('rowspan');
      if (colspan) td.setAttribute('colspan', colspan);
      if (rowspan) td.setAttribute('rowspan', rowspan);
      bodyTr.appendChild(td);
    });
    tbody.appendChild(bodyTr);
  });

  cleanTable.appendChild(thead);
  cleanTable.appendChild(tbody);

  return {
    sheetNames: workbook.SheetNames,
    activeSheetName,
    tableHtml: cleanTable.outerHTML,
    rowCount: nonEmptyRows.length,
    colCount: maxCols,
  };
}
