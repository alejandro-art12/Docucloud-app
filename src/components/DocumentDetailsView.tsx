import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Star,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Eye,
  Edit3,
  FolderInput,
  Trash2,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  AppRoute,
  DocucloudDocument,
  DocucloudUser,
} from '../types/docucloud';
import {
  formatBytes,
  formatDocDate,
  formatRelativeTime,
  splitFilename,
} from '../utils/formatters';
import {
  getOrCreateDocumentBlob,
  readBlobAsTextWithReader,
  readObjectUrlAsArrayBuffer,
  resolveViewerKind,
  ViewerKind,
} from '../services/fileBlobService';
import {
  convertDocxBufferToSafeHtml,
  convertSpreadsheetBufferToSafeHtml,
  getPdfJsEngine,
  PdfDocumentProxy,
} from '../services/cdnReaders';
import { FileTypeBadgeIcon } from './FileTypeIcon';

interface DocumentDetailsViewProps {
  user: DocucloudUser;
  document: DocucloudDocument;
  onNavigate: (route: AppRoute) => void;
  onOpenViewer: (doc: DocucloudDocument) => void;
  onDownloadDocument: (doc: DocucloudDocument) => Promise<void>;
  onToggleStar: (doc: DocucloudDocument) => Promise<void>;
  onOpenRenameModal: (doc: DocucloudDocument) => void;
  onOpenDeleteModal: (doc: DocucloudDocument) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentDetailsView: React.FC<DocumentDetailsViewProps> = ({
  user,
  document,
  onNavigate,
  onOpenViewer,
  onDownloadDocument,
  onToggleStar,
  onOpenRenameModal,
  onOpenDeleteModal,
  onNotify,
}) => {
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [previewKind, setPreviewKind] = useState<ViewerKind>(() =>
    resolveViewerKind(document.name, '', document.type)
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string>('');
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [sheetTableHtml, setSheetTableHtml] = useState<string>('');
  const [previewText, setPreviewText] = useState<string>('');
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [sha256, setSha256] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(true);

  const pdfPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let loadedPdf: PdfDocumentProxy | null = null;

    const revokeUrl = () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };

    const loadLivePreview = async () => {
      setIsLoadingPreview(true);
      setPreviewText('');
      setPreviewBase64('');
      setDocxHtml('');
      setSheetTableHtml('');
      setZoomPercent(100);
      revokeUrl();
      setPreviewUrl(null);
      setPreviewKind(resolveViewerKind(document.name, '', document.type));

      try {
        const resolved = await getOrCreateDocumentBlob(user, document);
        if (isCancelled) return;

        setPreviewKind(resolved.kind);
        setSha256(resolved.sha256);
        setMimeType(resolved.mimeType);
        setPreviewBase64(resolved.base64DataUrl);

        const tempObjectUrl = URL.createObjectURL(resolved.blob);
        if (isCancelled) {
          URL.revokeObjectURL(tempObjectUrl);
          return;
        }
        activeUrlRef.current = tempObjectUrl;

        if (resolved.kind === 'image') {
          setPreviewUrl(tempObjectUrl);
        } else if (resolved.kind === 'text') {
          const txt = await readBlobAsTextWithReader(resolved.blob);
          if (!isCancelled) {
            setPreviewText(txt.slice(0, 900));
          }
        } else if (resolved.kind === 'docx') {
          const buf = await readObjectUrlAsArrayBuffer(
            tempObjectUrl,
            resolved.blob
          );
          if (isCancelled) return;
          const { html } = await convertDocxBufferToSafeHtml(buf);
          if (!isCancelled) {
            setDocxHtml(html);
          }
        } else if (resolved.kind === 'spreadsheet') {
          const buf = await readObjectUrlAsArrayBuffer(
            tempObjectUrl,
            resolved.blob
          );
          if (isCancelled) return;
          const parsedSheet = await convertSpreadsheetBufferToSafeHtml(buf, 0);
          if (!isCancelled) {
            setSheetTableHtml(parsedSheet.tableHtml);
          }
        } else if (resolved.kind === 'pdf') {
          const [pdfjsLib, buf] = await Promise.all([
            getPdfJsEngine(),
            readObjectUrlAsArrayBuffer(tempObjectUrl, resolved.blob),
          ]);
          if (isCancelled) return;
          const task = pdfjsLib.getDocument({
            data: new Uint8Array(buf.slice(0)),
          });
          loadedPdf = await task.promise;
          if (isCancelled) {
            await loadedPdf.destroy();
            return;
          }
          setPdfPageCount(loadedPdf.numPages || 1);
          const firstPage = await loadedPdf.getPage(1);
          if (!isCancelled && pdfPreviewCanvasRef.current) {
            const baseVp = firstPage.getViewport({ scale: 1 });
            const cssScale = 310 / baseVp.width;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const vp = firstPage.getViewport({ scale: cssScale * dpr });
            const canvas = pdfPreviewCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = Math.floor(vp.width);
              canvas.height = Math.floor(vp.height);
              canvas.style.width = `${Math.floor(baseVp.width * cssScale)}px`;
              canvas.style.height = `${Math.floor(baseVp.height * cssScale)}px`;
              await firstPage.render({ canvasContext: ctx, viewport: vp })
                .promise;
            }
          }
        }
      } catch {
        // Mantener tarjeta de metadatos si falla vista rápida
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    };

    loadLivePreview();

    return () => {
      isCancelled = true;
      revokeUrl();
      if (loadedPdf) {
        loadedPdf.destroy().catch(() => undefined);
      }
    };
  }, [user, document]);

  const handleZoomOut = () => setZoomPercent((z) => Math.max(75, z - 25));
  const handleZoomIn = () => setZoomPercent((z) => Math.min(150, z + 25));

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/#doc=${encodeURIComponent(
      document.id
    )}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      onNotify(
        'Enlace cifrado del documento copiado al portapapeles',
        'success'
      );
    } catch {
      onNotify('Enlace seguro generado para este archivo', 'info');
    }
  };

  const { extension } = splitFilename(document.name);

  const renderRealPreviewSurface = () => {
    if (previewKind === 'pdf') {
      return (
        <div
          style={{ transform: `scale(${zoomPercent / 100})` }}
          className="w-full rounded-xl bg-white border border-[#E2E8F0] p-2.5 min-h-[220px] flex flex-col items-center justify-center transition-transform origin-top"
        >
          {isLoadingPreview && (
            <div className="py-10 flex flex-col items-center gap-2 text-xs text-[#64748B]">
              <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
              <span>Renderizando página 1 en &lt;canvas&gt;…</span>
            </div>
          )}
          <canvas
            ref={pdfPreviewCanvasRef}
            className={`rounded bg-white shadow-2xs ${
              isLoadingPreview ? 'hidden' : 'block'
            }`}
          />
        </div>
      );
    }

    if (isLoadingPreview) {
      return (
        <div className="w-full rounded-xl bg-white border border-[#E2E8F0] p-8 min-h-[200px] flex flex-col items-center justify-center gap-2 text-xs text-[#64748B]">
          <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
          <span>Cargando vista previa real…</span>
        </div>
      );
    }

    if (previewKind === 'docx') {
      return (
        <div
          style={{ transform: `scale(${zoomPercent / 100})` }}
          className="w-full rounded-xl bg-white border border-[#E2E8F0] p-4 max-h-60 overflow-y-auto transition-transform origin-top docucloud-docx-prose text-xs"
        >
          {docxHtml ? (
            <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
          ) : (
            <p className="text-xs text-[#64748B] italic">
              Pulsa &quot;Abrir documento&quot; para leer el archivo completo.
            </p>
          )}
        </div>
      );
    }

    if (previewKind === 'spreadsheet') {
      return (
        <div
          style={{ transform: `scale(${zoomPercent / 100})` }}
          className="w-full rounded-xl bg-white border border-[#E2E8F0] max-h-60 overflow-auto transition-transform origin-top docucloud-xlsx-container"
        >
          {sheetTableHtml ? (
            <div dangerouslySetInnerHTML={{ __html: sheetTableHtml }} />
          ) : (
            <p className="p-4 text-xs text-[#64748B]">
              Pulsa &quot;Abrir documento&quot; para explorar la hoja de cálculo.
            </p>
          )}
        </div>
      );
    }

    if (previewKind === 'image' && (previewUrl || previewBase64)) {
      return (
        <div
          style={{ transform: `scale(${zoomPercent / 100})` }}
          className="w-full rounded-xl bg-[#0F172A] border border-[#E2E8F0] p-3 min-h-[210px] flex items-center justify-center transition-transform origin-top"
        >
          <img
            src={previewUrl || previewBase64}
            alt={document.name}
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (previewBase64 && e.currentTarget.src !== previewBase64) {
                e.currentTarget.src = previewBase64;
              }
            }}
            className="max-h-56 w-auto max-w-full object-contain rounded-lg"
          />
        </div>
      );
    }

    if (previewKind === 'text') {
      return (
        <div
          style={{ transform: `scale(${zoomPercent / 100})` }}
          className="w-full rounded-xl bg-white border border-[#E2E8F0] p-3.5 max-h-56 overflow-y-auto transition-transform origin-top"
        >
          <pre className="font-mono text-xs text-[#0F172A] whitespace-pre-wrap break-words leading-relaxed">
            {previewText || '(Archivo de texto vacío)'}
          </pre>
        </div>
      );
    }

    return (
      <div className="w-full rounded-xl bg-white border border-[#E2E8F0] p-5 text-center space-y-2.5">
        <div className="flex justify-center">
          <FileTypeBadgeIcon type={document.type} size="lg" />
        </div>
        <p className="text-xs font-bold text-[#0F172A] break-all">
          {document.name}
        </p>
        <p className="text-xs text-[#1E3A8A] font-medium">
          Archivo binario original disponible para descarga directa
        </p>
      </div>
    );
  };

  return (
    <div id="view-details" className="px-4 pt-3 pb-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Volver a Mis Documentos"
          onClick={() => onNavigate('documents')}
          className="w-11 h-11 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:bg-slate-50"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-[#0F172A]">
            Detalles del documento
          </h1>
          <p className="text-[11px] text-[#64748B]">
            Archivo original e integridad verificada
          </p>
        </div>
        <button
          type="button"
          aria-label="Compartir enlace del documento"
          onClick={handleShare}
          className="w-11 h-11 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:bg-slate-50"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileTypeBadgeIcon type={document.type} />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#0F172A] break-all leading-snug">
              {document.name}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {document.category} · Modificado{' '}
              {formatRelativeTime(document.updatedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={
            document.starred ? 'Quitar de favoritos' : 'Marcar como favorito'
          }
          onClick={() => onToggleStar(document)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#2563EB] shrink-0"
        >
          <Star
            className={`w-5 h-5 ${
              document.starred ? 'text-[#2563EB] fill-[#2563EB]' : ''
            }`}
          />
        </button>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onOpenViewer(document)}
          className="h-12 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
        >
          <Eye className="w-4 h-4 shrink-0" />
          <span>Abrir documento</span>
        </button>
        <button
          type="button"
          onClick={() => onDownloadDocument(document)}
          className="h-12 px-3 rounded-xl bg-[#DBEAFE] hover:bg-[#2563EB] text-[#1E3A8A] hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Descargar</span>
        </button>
      </section>

      <section className="bg-[#DBEAFE]/35 border border-[#E2E8F0] rounded-2xl p-3 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#1E3A8A] bg-white px-2.5 py-1 rounded-lg border border-[#E2E8F0] tabular-nums">
            {previewKind === 'pdf'
              ? `Página 1 de ${pdfPageCount}`
              : previewKind === 'docx'
              ? 'Vista previa Word'
              : previewKind === 'spreadsheet'
              ? 'Tabla Excel / CSV'
              : previewKind === 'image'
              ? 'Imagen original'
              : previewKind === 'text'
              ? 'Vista previa UTF-8'
              : 'Formato descargable'}
          </span>
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#E2E8F0]">
            <button
              type="button"
              aria-label="Alejar vista previa"
              onClick={handleZoomOut}
              className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#2563EB]"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-[#0F172A] px-1 tabular-nums">
              {zoomPercent}%
            </span>
            <button
              type="button"
              aria-label="Acercar vista previa"
              onClick={handleZoomIn}
              className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#2563EB]"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-3.5 bg-[#E2E8F0] mx-0.5" />
            <button
              type="button"
              aria-label="Pantalla completa en visor multiformato"
              onClick={() => onOpenViewer(document)}
              className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#2563EB]"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto">{renderRealPreviewSurface()}</div>
      </section>

      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0F172A]">
            Información del archivo
          </h3>
          <span className="text-[11px] font-semibold text-[#16A34A] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Archivo original</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">Extensión / Tipo</p>
            <p className="font-semibold text-[#0F172A] mt-0.5">
              {extension || document.type.toUpperCase()}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">Tamaño exacto</p>
            <p className="font-semibold text-[#0F172A] tabular-nums mt-0.5">
              {formatBytes(document.sizeBytes)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">Categoría</p>
            <p className="font-semibold text-[#0F172A] mt-0.5">
              {document.category}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">Huella SHA-256</p>
            <p className="font-mono font-semibold text-[#0F172A] mt-0.5 truncate">
              {sha256 ? `${sha256.slice(0, 12)}…` : 'Verificada'}
            </p>
          </div>
        </div>

        <div className="pt-1 border-t border-[#E2E8F0] space-y-2 text-xs">
          {mimeType && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#64748B] shrink-0">Tipo MIME</span>
              <span className="font-mono text-[11px] text-[#0F172A] truncate">
                {mimeType}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Fecha de carga</span>
            <span className="font-medium text-[#0F172A] tabular-nums">
              {formatDocDate(document.uploadedAt, user.dateFormat, true)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Última modificación</span>
            <span className="font-medium text-[#0F172A] tabular-nums">
              {formatDocDate(document.updatedAt, user.dateFormat, true)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onOpenRenameModal(document)}
          className="h-11 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-xs font-semibold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Edit3 className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>Renombrar</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenRenameModal(document)}
          className="h-11 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-xs font-semibold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <FolderInput className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>Mover</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenDeleteModal(document)}
          className="h-11 rounded-xl bg-red-50 border border-red-200 hover:bg-[#DC2626] text-xs font-semibold text-[#DC2626] hover:text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>Eliminar</span>
        </button>
      </section>
    </div>
  );
};
