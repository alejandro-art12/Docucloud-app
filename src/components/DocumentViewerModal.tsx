import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Moon,
  Loader2,
  AlertCircle,
  FileDown,
  FileText,
  Table,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { DocucloudDocument, DocucloudUser } from '../types/docucloud';
import {
  formatBytes,
  formatDocDate,
  splitFilename,
} from '../utils/formatters';
import {
  getOrCreateDocumentBlob,
  ORIGIN_CORRUPTED_MESSAGE,
  OriginCorruptedFileError,
  readBlobAsTextWithReader,
  readObjectUrlAsArrayBuffer,
  triggerDirectBlobDownload,
  validateBlobIntegrity,
  VIEWER_LOAD_ERROR_MESSAGE,
  ViewerKind,
} from '../services/fileBlobService';
import {
  convertDocxBufferToSafeHtml,
  convertSpreadsheetBufferToSafeHtml,
  getPdfJsEngine,
  ParsedSheetHtml,
  PdfDocumentProxy,
} from '../services/cdnReaders';
import {
  readUiPreferences,
  updateUiPreferences,
} from '../services/uiPreferencesService';
import { FileTypeBadgeIcon } from './FileTypeIcon';

interface PdfPageCanvasProps {
  pdfDocument: PdfDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  zoomPercent: number;
  registerPageRef: (pageNum: number, el: HTMLDivElement | null) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDocument,
  pageNumber,
  containerWidth,
  zoomPercent,
  registerPageRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    let cancelRender: (() => void) | null = null;

    const renderPageToCanvas = async () => {
      setRendering(true);
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const usableWidth = Math.max(240, containerWidth - 28);
        const cssScale = (usableWidth / baseViewport.width) * (zoomPercent / 100);
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const renderViewport = page.getViewport({ scale: cssScale * dpr });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(baseViewport.width * cssScale)}px`;
        canvas.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        });
        cancelRender = () => renderTask.cancel();
        await renderTask.promise;
      } catch {
        // Ignorar cancelación cuando el usuario ajusta el zoom rápidamente
      } finally {
        if (!isCancelled) {
          setRendering(false);
        }
      }
    };

    renderPageToCanvas();

    return () => {
      isCancelled = true;
      if (cancelRender) {
        try {
          cancelRender();
        } catch {
          // Ignorar
        }
      }
    };
  }, [pdfDocument, pageNumber, containerWidth, zoomPercent]);

  return (
    <div
      ref={(el) => registerPageRef(pageNumber, el)}
      data-page-number={pageNumber}
      className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-2 mx-auto w-fit relative"
    >
      {rendering && (
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-[#DBEAFE] text-[#1E3A8A] text-[10px] font-semibold">
          Renderizando pág. {pageNumber}…
        </div>
      )}
      <canvas ref={canvasRef} className="block rounded bg-white" />
      <p className="text-[11px] text-[#64748B] text-center pt-1.5 tabular-nums font-medium">
        Página {pageNumber}
      </p>
    </div>
  );
};

interface PdfCanvasNativeReaderProps {
  objectUrl: string | null;
  blob: Blob;
  onCorruptedError: () => void;
}

/**
 * Motor PDF 100% basado en <canvas> alimentado mediante el URL.createObjectURL(blob) temporal de IndexedDB.
 */
const PdfCanvasNativeReader: React.FC<PdfCanvasNativeReaderProps> = ({
  objectUrl,
  blob,
  onCorruptedError,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [containerWidth, setContainerWidth] = useState<number>(365);
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(true);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateWidth());
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [isParsingPdf]);

  useEffect(() => {
    let isCancelled = false;
    let loadedDoc: PdfDocumentProxy | null = null;

    const loadPdfWithCanvasEngine = async () => {
      setIsParsingPdf(true);
      setCurrentPage(1);
      try {
        const [pdfjsLib, arrayBuffer] = await Promise.all([
          getPdfJsEngine(),
          readObjectUrlAsArrayBuffer(objectUrl, blob),
        ]);
        if (isCancelled) return;

        // Conversión explícita a Uint8Array según especificación
        const uint8Data = new Uint8Array(arrayBuffer.slice(0));
        const loadingTask = pdfjsLib.getDocument({ data: uint8Data });
        loadedDoc = await loadingTask.promise;

        if (isCancelled) {
          await loadedDoc.destroy();
          return;
        }

        if (!loadedDoc.numPages || loadedDoc.numPages < 1) {
          throw new OriginCorruptedFileError(ORIGIN_CORRUPTED_MESSAGE);
        }

        setPdfDoc(loadedDoc);
        setPageCount(loadedDoc.numPages);
      } catch {
        if (!isCancelled) {
          onCorruptedError();
        }
      } finally {
        if (!isCancelled) {
          setIsParsingPdf(false);
        }
      }
    };

    loadPdfWithCanvasEngine();

    return () => {
      isCancelled = true;
      if (loadedDoc) {
        loadedDoc.destroy().catch(() => undefined);
      }
    };
  }, [objectUrl, blob, onCorruptedError]);

  const registerPageRef = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      if (el) {
        pageElementsRef.current.set(pageNum, el);
      } else {
        pageElementsRef.current.delete(pageNum);
      }
    },
    []
  );

  const jumpToPage = (targetPage: number) => {
    if (pageCount < 1) return;
    const clamped = Math.min(Math.max(1, targetPage), pageCount);
    setCurrentPage(clamped);
    const targetEl = pageElementsRef.current.get(clamped);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || pageCount <= 1) return;
    const containerRect = container.getBoundingClientRect();
    const focalY = containerRect.top + containerRect.height * 0.35;

    let closestPage = 1;
    let minDistance = Number.POSITIVE_INFINITY;

    pageElementsRef.current.forEach((el, pNum) => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= focalY && rect.bottom >= focalY) {
        closestPage = pNum;
        minDistance = 0;
      } else if (minDistance > 0) {
        const dist = Math.abs(rect.top - focalY);
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = pNum;
        }
      }
    });

    if (closestPage !== currentPage) {
      setCurrentPage(closestPage);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
      {/* Barra de controles PDF: Navegación de páginas + Zoom (+ / -) */}
      <div className="px-3 py-2 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={currentPage <= 1 || isParsingPdf}
            onClick={() => jumpToPage(currentPage - 1)}
            className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] disabled:opacity-40 flex items-center justify-center text-[#0F172A] hover:border-[#2563EB]"
          >
            <ChevronLeft className="w-4 h-4 text-[#2563EB]" />
          </button>
          <span className="px-1.5 text-xs font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
            {pageCount > 0 ? `Pág. ${currentPage} / ${pageCount}` : 'PDF'}
          </span>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={currentPage >= pageCount || isParsingPdf}
            onClick={() => jumpToPage(currentPage + 1)}
            className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] disabled:opacity-40 flex items-center justify-center text-[#0F172A] hover:border-[#2563EB]"
          >
            <ChevronRight className="w-4 h-4 text-[#2563EB]" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Alejar páginas PDF"
            disabled={isParsingPdf}
            onClick={() => setPdfZoom((z) => Math.max(50, z - 25))}
            className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:border-[#2563EB]"
          >
            <ZoomOut className="w-3.5 h-3.5 text-[#2563EB]" />
          </button>
          <button
            type="button"
            onClick={() => setPdfZoom(100)}
            title="Restablecer escala al 100%"
            className="h-8 px-2 rounded-lg bg-[#DBEAFE]/60 text-[11px] font-mono font-semibold text-[#1E3A8A] tabular-nums whitespace-nowrap"
          >
            {pdfZoom}%
          </button>
          <button
            type="button"
            aria-label="Acercar páginas PDF"
            disabled={isParsingPdf}
            onClick={() => setPdfZoom((z) => Math.min(225, z + 25))}
            className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:border-[#2563EB]"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#2563EB]" />
          </button>
        </div>
      </div>

      {/* Contenedor móvil con scroll vertical fluido sobre <canvas> */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 space-y-3"
      >
        {isParsingPdf ? (
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center p-6 gap-2.5">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
            <p className="text-xs font-semibold text-[#64748B]">
              Renderizando páginas del PDF en lienzo &lt;canvas&gt;…
            </p>
          </div>
        ) : (
          pdfDoc &&
          Array.from({ length: pageCount }, (_, idx) => (
            <PdfPageCanvas
              key={idx + 1}
              pdfDocument={pdfDoc}
              pageNumber={idx + 1}
              containerWidth={containerWidth}
              zoomPercent={pdfZoom}
              registerPageRef={registerPageRef}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface DocxNativeReaderProps {
  objectUrl: string | null;
  blob: Blob;
  onCorruptedError: () => void;
}

/**
 * Lector nativo de documentos Word (.docx) mediante mammoth.convertToHtml({ arrayBuffer }).
 */
const DocxNativeReader: React.FC<DocxNativeReaderProps> = ({
  objectUrl,
  blob,
  onCorruptedError,
}) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [hasVisibleText, setHasVisibleText] = useState<boolean>(true);
  const [fontScale, setFontScale] = useState<number>(100);
  const [isParsing, setIsParsing] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const parseDocx = async () => {
      setIsParsing(true);
      try {
        const buffer = await readObjectUrlAsArrayBuffer(objectUrl, blob);
        if (isCancelled) return;
        const { html, plainSample } = await convertDocxBufferToSafeHtml(buffer);
        if (isCancelled) return;
        setHtmlContent(html);
        setHasVisibleText(plainSample.length > 0 || html.includes('<img'));
      } catch {
        if (!isCancelled) {
          onCorruptedError();
        }
      } finally {
        if (!isCancelled) {
          setIsParsing(false);
        }
      }
    };

    parseDocx();

    return () => {
      isCancelled = true;
    };
  }, [objectUrl, blob, onCorruptedError]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
      <div className="px-3 py-2 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span className="text-xs font-semibold text-[#0F172A] truncate">
            Documento Word (.docx)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Reducir tamaño de lectura"
            onClick={() => setFontScale((s) => Math.max(85, s - 10))}
            className="h-8 px-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:border-[#2563EB]"
          >
            A-
          </button>
          <span className="px-1 text-[11px] font-mono font-semibold text-[#1E3A8A] tabular-nums">
            {fontScale}%
          </span>
          <button
            type="button"
            aria-label="Aumentar tamaño de lectura"
            onClick={() => setFontScale((s) => Math.min(140, s + 10))}
            className="h-8 px-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:border-[#2563EB]"
          >
            A+
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5">
        {isParsing ? (
          <div className="h-full min-h-[340px] flex flex-col items-center justify-center p-6 gap-2.5">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
            <p className="text-xs font-semibold text-[#64748B]">
              Procesando documento Word con Mammoth.js…
            </p>
          </div>
        ) : (
          <article
            style={{ fontSize: `${(14.5 * fontScale) / 100}px` }}
            className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs docucloud-docx-prose"
          >
            {hasVisibleText ? (
              <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            ) : (
              <p className="text-xs text-[#64748B] italic">
                (El documento de Word no contiene párrafos de texto visibles)
              </p>
            )}
          </article>
        )}
      </div>
    </div>
  );
};

interface SpreadsheetNativeReaderProps {
  objectUrl: string | null;
  blob: Blob;
  onCorruptedError: () => void;
}

/**
 * Lector interactivo de hojas de cálculo Excel / CSV (.xlsx, .xls, .csv) mediante SheetJS (XLSX.read + sheet_to_html).
 */
const SpreadsheetNativeReader: React.FC<SpreadsheetNativeReaderProps> = ({
  objectUrl,
  blob,
  onCorruptedError,
}) => {
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetData, setSheetData] = useState<ParsedSheetHtml | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [isParsing, setIsParsing] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const loadWorkbook = async () => {
      setIsParsing(true);
      setActiveSheetIdx(0);
      try {
        const buffer = await readObjectUrlAsArrayBuffer(objectUrl, blob);
        if (isCancelled) return;
        const parsed = await convertSpreadsheetBufferToSafeHtml(buffer, 0);
        if (isCancelled) return;
        setArrayBuffer(buffer);
        setSheetData(parsed);
      } catch {
        if (!isCancelled) {
          onCorruptedError();
        }
      } finally {
        if (!isCancelled) {
          setIsParsing(false);
        }
      }
    };

    loadWorkbook();

    return () => {
      isCancelled = true;
    };
  }, [objectUrl, blob, onCorruptedError]);

  const handleSelectSheet = async (index: number) => {
    if (!arrayBuffer || index === activeSheetIdx) return;
    setActiveSheetIdx(index);
    try {
      const parsed = await convertSpreadsheetBufferToSafeHtml(
        arrayBuffer,
        index
      );
      setSheetData(parsed);
    } catch {
      onCorruptedError();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
      <div className="px-3 py-2 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Table className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span className="text-xs font-semibold text-[#0F172A] truncate">
            {sheetData?.activeSheetName || 'Hoja de cálculo'}
          </span>
        </div>
        {sheetData && (
          <span className="text-[11px] text-[#64748B] tabular-nums shrink-0">
            {sheetData.rowCount} filas · {sheetData.colCount} col.
          </span>
        )}
      </div>

      {/* Pestañas de hojas si el libro Excel contiene más de una hoja */}
      {sheetData && sheetData.sheetNames.length > 1 && (
        <div className="px-3 py-1.5 bg-white border-b border-[#E2E8F0] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {sheetData.sheetNames.map((name, idx) => {
            const isActive = idx === activeSheetIdx;
            return (
              <button
                key={`${name}-${idx}`}
                type="button"
                onClick={() => void handleSelectSheet(idx)}
                className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenedor con desplazamiento horizontal y vertical (overflow-auto) y encabezados #2563EB */}
      <div className="flex-1 p-3 min-h-0 flex flex-col">
        {isParsing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-2.5">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
            <p className="text-xs font-semibold text-[#64748B]">
              Procesando hoja de cálculo con SheetJS…
            </p>
          </div>
        ) : sheetData && sheetData.tableHtml ? (
          <div
            className="flex-1 overflow-auto rounded-xl border border-[#E2E8F0] bg-white shadow-xs docucloud-xlsx-container"
            dangerouslySetInnerHTML={{ __html: sheetData.tableHtml }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-[#E2E8F0] p-6 text-center">
            <p className="text-xs text-[#64748B]">
              La hoja seleccionada no contiene celdas con datos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

interface DocumentViewerModalProps {
  user: DocucloudUser;
  document: DocucloudDocument | null;
  onClose: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  user,
  document,
  onClose,
  onNotify,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewerKind, setViewerKind] = useState<ViewerKind>('pdf');
  const [activeBlob, setActiveBlob] = useState<Blob | null>(null);
  const [base64DataUrl, setBase64DataUrl] = useState<string>('');
  const [useBase64ImageFallback, setUseBase64ImageFallback] =
    useState<boolean>(false);
  const [mimeType, setMimeType] = useState<string>('');
  const [sha256, setSha256] = useState<string>('');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [imageZoom, setImageZoom] = useState<number>(100);
  const [darkImageStage, setDarkImageStage] = useState<boolean>(
    () => readUiPreferences().viewerTheme === 'dark'
  );
  const [naturalDims, setNaturalDims] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const activeObjectUrlRef = useRef<string | null>(null);

  const revokeCurrentObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  const handleToggleImageStage = () => {
    setDarkImageStage((prev) => {
      const next = !prev;
      updateUiPreferences({ viewerTheme: next ? 'dark' : 'light' });
      return next;
    });
  };

  const handleCloseViewer = useCallback(() => {
    revokeCurrentObjectUrl();
    setObjectUrl(null);
    setActiveBlob(null);
    setBase64DataUrl('');
    setUseBase64ImageFallback(false);
    setTextContent('');
    setNaturalDims(null);
    setLoadError('');
    onClose();
  }, [onClose, revokeCurrentObjectUrl]);

  const handleFormatCorrupted = useCallback(() => {
    setLoadError(ORIGIN_CORRUPTED_MESSAGE);
    onNotify(ORIGIN_CORRUPTED_MESSAGE, 'error');
  }, [onNotify]);

  useEffect(() => {
    if (!document) {
      revokeCurrentObjectUrl();
      setObjectUrl(null);
      setActiveBlob(null);
      setBase64DataUrl('');
      setUseBase64ImageFallback(false);
      setTextContent('');
      setNaturalDims(null);
      setLoadError('');
      return;
    }

    let isCancelled = false;

    const loadDocumentIntoViewer = async () => {
      setIsLoading(true);
      setLoadError('');
      setTextContent('');
      setNaturalDims(null);
      setImageZoom(100);
      setUseBase64ImageFallback(false);

      revokeCurrentObjectUrl();
      setObjectUrl(null);
      setActiveBlob(null);
      setBase64DataUrl('');

      try {
        const resolved = await getOrCreateDocumentBlob(user, document);
        if (isCancelled) return;

        await validateBlobIntegrity(resolved.blob, resolved.kind);
        if (isCancelled) return;

        if (resolved.kind === 'text') {
          const parsedText = await readBlobAsTextWithReader(resolved.blob);
          if (isCancelled) return;
          setTextContent(parsedText);
        }

        const generatedUrl = URL.createObjectURL(resolved.blob);
        if (isCancelled) {
          URL.revokeObjectURL(generatedUrl);
          return;
        }

        activeObjectUrlRef.current = generatedUrl;
        setActiveBlob(resolved.blob);
        setBase64DataUrl(resolved.base64DataUrl);
        setMimeType(resolved.mimeType);
        setSha256(resolved.sha256);
        setViewerKind(resolved.kind);
        setObjectUrl(generatedUrl);
      } catch (err) {
        if (!isCancelled) {
          const msg =
            err instanceof OriginCorruptedFileError
              ? ORIGIN_CORRUPTED_MESSAGE
              : err instanceof Error
              ? err.message
              : VIEWER_LOAD_ERROR_MESSAGE;
          setLoadError(msg);
          onNotify(msg, 'error');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDocumentIntoViewer();

    return () => {
      isCancelled = true;
      revokeCurrentObjectUrl();
    };
  }, [document, user, reloadNonce, revokeCurrentObjectUrl, onNotify]);

  useEffect(() => {
    if (!document) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseViewer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [document, handleCloseViewer]);

  if (!document) return null;

  const { extension } = splitFilename(document.name);

  const handleDirectDownload = () => {
    if (!activeBlob) {
      onNotify(VIEWER_LOAD_ERROR_MESSAGE, 'error');
      return;
    }
    triggerDirectBlobDownload(activeBlob, document.name);
    onNotify(`Descargando ${document.name}`, 'success');
  };

  const handleShareDocument = async () => {
    const shareLink = `${window.location.origin}/#doc=${encodeURIComponent(
      document.id
    )}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: document.name,
          text: `Documento en Docucloud: ${document.name}`,
          url: shareLink,
        });
        return;
      }
    } catch {
      // Continuar hacia portapapeles
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      onNotify('Enlace del documento copiado al portapapeles', 'success');
    } catch {
      onNotify('Enlace listo para compartir', 'info');
    }
  };

  const renderViewerBody = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#0F172A]">
              Abriendo archivo original…
            </p>
            <p className="text-xs text-[#64748B] break-all">{document.name}</p>
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-5">
          <div
            role="alert"
            className="w-full bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm text-center space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-[#0F172A]">
                No se puede procesar el archivo
              </h2>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {loadError}
              </p>
            </div>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reintentar apertura</span>
              </button>
              <button
                type="button"
                onClick={handleCloseViewer}
                className="w-full h-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs whitespace-nowrap"
              >
                Cerrar visor
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (viewerKind) {
      case 'pdf':
        return activeBlob ? (
          <PdfCanvasNativeReader
            objectUrl={objectUrl}
            blob={activeBlob}
            onCorruptedError={handleFormatCorrupted}
          />
        ) : null;

      case 'docx':
        return activeBlob ? (
          <DocxNativeReader
            objectUrl={objectUrl}
            blob={activeBlob}
            onCorruptedError={handleFormatCorrupted}
          />
        ) : null;

      case 'spreadsheet':
        return activeBlob ? (
          <SpreadsheetNativeReader
            objectUrl={objectUrl}
            blob={activeBlob}
            onCorruptedError={handleFormatCorrupted}
          />
        ) : null;

      case 'image': {
        const activeImageSrc = useBase64ImageFallback
          ? base64DataUrl
          : objectUrl || base64DataUrl;

        return (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Reducir escala de imagen"
                  onClick={() => setImageZoom((z) => Math.max(50, z - 25))}
                  className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:border-[#2563EB]"
                >
                  <ZoomOut className="w-4 h-4 text-[#2563EB]" />
                </button>
                <span className="px-1.5 text-xs font-semibold font-mono text-[#0F172A] tabular-nums">
                  {imageZoom}%
                </span>
                <button
                  type="button"
                  aria-label="Aumentar escala de imagen"
                  onClick={() => setImageZoom((z) => Math.min(300, z + 25))}
                  className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:border-[#2563EB]"
                >
                  <ZoomIn className="w-4 h-4 text-[#2563EB]" />
                </button>
                {imageZoom !== 100 && (
                  <button
                    type="button"
                    onClick={() => setImageZoom(100)}
                    className="h-8 px-2 rounded-lg bg-[#DBEAFE] text-[#1E3A8A] text-[11px] font-semibold whitespace-nowrap"
                  >
                    100%
                  </button>
                )}
              </div>

              {naturalDims && (
                <span className="text-[11px] text-[#64748B] tabular-nums hidden min-[370px]:inline">
                  {naturalDims.width} × {naturalDims.height} px
                </span>
              )}

              <button
                type="button"
                aria-label="Alternar fondo del visor"
                onClick={handleToggleImageStage}
                className="h-8 px-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 whitespace-nowrap"
              >
                {darkImageStage ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Oscuro</span>
                  </>
                )}
              </button>
            </div>

            <div
              className={`flex-1 overflow-auto p-3 flex items-center justify-center transition-colors ${
                darkImageStage ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'
              }`}
            >
              {activeImageSrc && (
                <img
                  src={activeImageSrc}
                  alt={document.name}
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setNaturalDims({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      });
                    }
                  }}
                  onError={() => {
                    if (!useBase64ImageFallback && base64DataUrl) {
                      setUseBase64ImageFallback(true);
                      return;
                    }
                    handleFormatCorrupted();
                  }}
                  style={{
                    transform: `scale(${imageZoom / 100})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-w-full h-auto mx-auto rounded-lg object-contain shadow-md transition-transform duration-150"
                />
              )}
            </div>
          </div>
        );
      }

      case 'text': {
        const lineCount = textContent ? textContent.split(/\r?\n/).length : 0;
        return (
          <div className="flex-1 flex flex-col min-h-0 p-3.5 gap-3 overflow-y-auto bg-[#F8FAFC]">
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-[#64748B] tabular-nums">
                Texto UTF-8 · {lineCount} {lineCount === 1 ? 'línea' : 'líneas'}{' '}
                · {textContent.length} caracteres
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-xs font-mono text-sm text-[#0F172A] border border-[#E2E8F0] whitespace-pre-wrap break-words leading-relaxed">
              {textContent || '(Archivo de texto vacío)'}
            </div>
          </div>
        );
      }

      case 'unsupported':
      default:
        return (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center bg-[#F8FAFC]">
            <div className="w-full bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col items-center text-center gap-2.5">
                <FileTypeBadgeIcon type={document.type} size="lg" />
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-[#0F172A] break-all">
                    {document.name}
                  </h2>
                  <p className="text-xs text-[#64748B] tabular-nums">
                    {document.category} · {formatBytes(document.sizeBytes)}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DBEAFE]/50 border border-[#2563EB]/25 text-center">
                <p className="text-xs font-semibold text-[#1E3A8A] leading-relaxed">
                  Este formato comprimido o binario especial está disponible para
                  descarga directa intacta
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">Extensión original</span>
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {extension || 'Binario'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B] shrink-0">Tipo MIME</span>
                  <span className="font-mono text-[11px] text-[#0F172A] truncate">
                    {mimeType || 'application/octet-stream'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">Fecha de carga</span>
                  <span className="font-medium text-[#0F172A] tabular-nums">
                    {formatDocDate(document.uploadedAt, user.dateFormat, true)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">Integridad</span>
                  <span className="font-semibold text-[#16A34A] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>
                      {sha256 ? `SHA-256 (${sha256.slice(0, 8)})` : 'Íntegro'}
                    </span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDirectDownload}
                className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors whitespace-nowrap"
              >
                <FileDown className="w-5 h-5" />
                <span>Descargar archivo original</span>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visor de documento: ${document.name}`}
      className="fixed sm:absolute inset-0 z-50 bg-[#F8FAFC] flex flex-col overflow-hidden"
    >
      {/* Barra superior del visor con botón "Descargar" siempre accesible */}
      <header className="min-h-14 px-3 py-2 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          aria-label="Regresar y cerrar visor"
          onClick={handleCloseViewer}
          className="w-10 h-10 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE]/50 border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] shrink-0 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1 px-1">
          <h1
            title={document.name}
            className="text-xs font-bold text-[#0F172A] leading-snug break-all line-clamp-2"
          >
            {document.name}
          </h1>
          <p className="text-[11px] text-[#64748B] tabular-nums truncate">
            {document.category} · {formatBytes(document.sizeBytes)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Compartir documento"
            onClick={handleShareDocument}
            className="w-9 h-9 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE]/50 border border-[#E2E8F0] flex items-center justify-center text-[#2563EB] transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Descargar archivo original"
            disabled={!activeBlob}
            onClick={handleDirectDownload}
            className="h-9 px-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white disabled:opacity-40 text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar</span>
          </button>
          <button
            type="button"
            aria-label="Cerrar visor"
            onClick={handleCloseViewer}
            className="w-9 h-9 rounded-xl hover:bg-[#F8FAFC] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Cuerpo Dinámico Multiformato */}
      <div className="flex-1 flex flex-col min-h-0">{renderViewerBody()}</div>
    </div>
  );
};
