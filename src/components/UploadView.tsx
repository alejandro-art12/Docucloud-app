import React, { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Lock,
  Loader2,
  FilePlus2,
  ShieldCheck,
  FileWarning,
} from 'lucide-react';
import {
  AppRoute,
  CATEGORIES,
  DocumentCategory,
  DocumentFileType,
  DocucloudUser,
  MAX_DOC_BASENAME_LENGTH,
  MAX_FILE_SIZE_BYTES,
  MAX_STORAGE_BYTES,
} from '../types/docucloud';
import {
  QUOTA_EXCEEDED_MESSAGE,
  UploadDocumentInput,
} from '../services/vaultService';
import {
  CapturedOriginPayload,
  FileSizeLimitExceededError,
  MAX_FILE_SIZE_EXCEEDED_MESSAGE,
  ORIGIN_CORRUPTED_MESSAGE,
  OriginCorruptedFileError,
  validateAndCaptureOriginFile,
} from '../services/fileBlobService';
import {
  composeExactFilename,
  detectDocumentType,
  formatBytes,
  splitFilename,
} from '../utils/formatters';
import { FileTypeBadgeIcon } from './FileTypeIcon';

interface UploadViewProps {
  user: DocucloudUser;
  onUploadConfirm: (input: UploadDocumentInput) => Promise<void>;
  onNavigate: (route: AppRoute) => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface DetectedCandidate {
  originalName: string;
  extension: string;
  sizeBytes: number;
  type: DocumentFileType;
  mimeType: string;
  sha256: string;
  capturedPayload: CapturedOriginPayload;
}

export const UploadView: React.FC<UploadViewProps> = ({
  user,
  onUploadConfirm,
  onNavigate,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isInspectingFile, setIsInspectingFile] = useState(false);

  const [detectedFile, setDetectedFile] = useState<DetectedCandidate | null>(
    null
  );
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [customBaseName, setCustomBaseName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    DocumentCategory | ''
  >('');

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorAlert, setErrorAlert] = useState<string>('');

  const remainingQuota = Math.max(0, MAX_STORAGE_BYTES - user.usedStorageBytes);

  useEffect(() => {
    if (!detectedFile || detectedFile.capturedPayload.viewerKind !== 'image') {
      setPreviewImageUrl(null);
      return;
    }

    const url = URL.createObjectURL(detectedFile.capturedPayload.typedBlob);
    setPreviewImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [detectedFile]);

  const clearCandidate = () => {
    setDetectedFile(null);
    setCustomBaseName('');
    setUploadProgress(null);
  };

  /**
   * Valida primero el límite estricto de 10 MB (10,485,760 bytes) antes de iniciar
   * cualquier lectura binaria y luego verifica la integridad de origen del archivo.
   */
  const processIncomingNativeFile = async (file: File) => {
    setErrorAlert('');
    setUploadProgress(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      clearCandidate();
      const sizeAlert = `${MAX_FILE_SIZE_EXCEEDED_MESSAGE} El archivo "${file.name}" pesa ${formatBytes(
        file.size
      )} (máximo 10.00 MB).`;
      setErrorAlert(sizeAlert);
      onNotify?.(MAX_FILE_SIZE_EXCEEDED_MESSAGE, 'error');
      return;
    }

    setIsInspectingFile(true);

    try {
      const captured = await validateAndCaptureOriginFile(file);
      const { baseName, extension } = splitFilename(captured.originalName);
      const docType = detectDocumentType(
        captured.originalName,
        captured.mimeType
      );

      setDetectedFile({
        originalName: captured.originalName,
        extension,
        sizeBytes: captured.sizeBytes,
        type: docType,
        mimeType: captured.mimeType,
        sha256: captured.sha256,
        capturedPayload: captured,
      });
      setCustomBaseName(baseName.slice(0, MAX_DOC_BASENAME_LENGTH));

      if (user.usedStorageBytes + captured.sizeBytes > MAX_STORAGE_BYTES) {
        setErrorAlert(QUOTA_EXCEEDED_MESSAGE);
      }
    } catch (err) {
      clearCandidate();
      if (err instanceof FileSizeLimitExceededError) {
        setErrorAlert(err.message);
        onNotify?.(err.message, 'error');
      } else if (err instanceof OriginCorruptedFileError) {
        setErrorAlert(ORIGIN_CORRUPTED_MESSAGE);
      } else {
        setErrorAlert(ORIGIN_CORRUPTED_MESSAGE);
      }
    } finally {
      setIsInspectingFile(false);
    }
  };

  const handleNativeFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processIncomingNativeFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processIncomingNativeFile(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert('');

    if (!detectedFile) {
      setErrorAlert(
        'Por favor, selecciona o arrastra un archivo desde tu dispositivo antes de subirlo.'
      );
      return;
    }

    if (detectedFile.sizeBytes > MAX_FILE_SIZE_BYTES) {
      clearCandidate();
      setErrorAlert(MAX_FILE_SIZE_EXCEEDED_MESSAGE);
      onNotify?.(MAX_FILE_SIZE_EXCEEDED_MESSAGE, 'error');
      return;
    }

    if (
      !Number.isFinite(detectedFile.sizeBytes) ||
      detectedFile.sizeBytes <= 0 ||
      detectedFile.capturedPayload.typedBlob.size !== detectedFile.sizeBytes
    ) {
      clearCandidate();
      setErrorAlert(ORIGIN_CORRUPTED_MESSAGE);
      return;
    }

    const newTotal = user.usedStorageBytes + detectedFile.sizeBytes;
    if (newTotal > MAX_STORAGE_BYTES) {
      setUploadProgress(null);
      setErrorAlert(QUOTA_EXCEEDED_MESSAGE);
      return;
    }

    const trimmedBase = customBaseName.trim();
    if (!trimmedBase) {
      setErrorAlert('Por favor, ingresa un nombre visible para el documento.');
      return;
    }

    if (!selectedCategory) {
      setErrorAlert(
        'Debes seleccionar una categoría obligatoria antes de subir el archivo.'
      );
      return;
    }

    setUploadProgress(0);
    const steps = [28, 64, 100];
    for (const pct of steps) {
      await new Promise((r) => setTimeout(r, 90));
      setUploadProgress(pct);
    }

    try {
      const exactFileName = composeExactFilename(
        trimmedBase,
        detectedFile.extension
      );

      await onUploadConfirm({
        name: exactFileName,
        category: selectedCategory,
        type: detectedFile.type,
        sizeBytes: detectedFile.sizeBytes,
        mimeType: detectedFile.mimeType,
        fileBlob: detectedFile.capturedPayload.typedBlob,
        capturedPayload: detectedFile.capturedPayload,
      });
    } catch (err) {
      setUploadProgress(null);
      setErrorAlert(
        err instanceof Error ? err.message : 'Error al subir el documento.'
      );
    }
  };

  const isBusy = uploadProgress !== null || isInspectingFile;
  const isOriginCorruptionAlert = errorAlert === ORIGIN_CORRUPTED_MESSAGE;
  const isFileSizeLimitAlert = errorAlert.startsWith(
    MAX_FILE_SIZE_EXCEEDED_MESSAGE
  );

  return (
    <div id="view-upload" className="px-4 pt-4 pb-6 space-y-4">
      {/* Encabezado */}
      <section className="space-y-1">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
          Subir documento
        </h1>
        <p className="text-xs text-[#64748B] tabular-nums">
          Máx. 10 MB por archivo · Cuota libre: {formatBytes(remainingQuota)} de 10.00 GB
        </p>
      </section>

      {/* Alerta Roja de Límite 10 MB, Error de Origen o Exceso de Cuota */}
      {errorAlert && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-red-50 border border-[#DC2626] flex items-start gap-2.5 text-[#DC2626]"
        >
          {isOriginCorruptionAlert ? (
            <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            {isOriginCorruptionAlert && (
              <p className="text-[11px] font-bold text-[#DC2626]">
                Control de integridad de origen
              </p>
            )}
            {isFileSizeLimitAlert && (
              <p className="text-[11px] font-bold text-[#DC2626]">
                Límite máximo de 10 MB superado
              </p>
            )}
            <p className="text-xs font-semibold leading-relaxed">
              {errorAlert}
            </p>
          </div>
        </div>
      )}

      {/* Zona Dropzone de Captura Binaria Real */}
      <section>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!isBusy) fileInputRef.current?.click();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!isBusy) fileInputRef.current?.click();
            }
          }}
          className={`w-full rounded-2xl border-2 border-dashed p-5 text-center flex flex-col items-center justify-center gap-2.5 transition-colors cursor-pointer ${
            isDragging
              ? 'border-[#2563EB] bg-[#DBEAFE]/50'
              : 'border-[#E2E8F0] bg-white hover:border-[#2563EB]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.csv,.ods,.png,.jpg,.jpeg,.jfif,.webp,.gif,.svg,.bmp,.avif,.txt,.tsv,.md,.json,.xml,.doc,.ppt,.pptx,.zip,image/*,application/pdf,text/*"
            onChange={handleNativeFileChange}
            className="hidden"
          />
          <div className="w-13 h-13 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center relative">
            {isInspectingFile ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center">
              <Lock className="w-3 h-3" />
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-[#0F172A]">
              {isInspectingFile
                ? 'Validando integridad del archivo...'
                : 'Selecciona o arrastra tu archivo real'}
            </p>
            <p className="text-xs text-[#64748B]">
              PDF, Word (.docx), Excel (.xlsx, .xls, .csv), imágenes y texto (.txt) · Máx. 10 MB
            </p>
          </div>
          <span className="h-9 px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#2563EB] inline-flex items-center gap-1.5 whitespace-nowrap">
            <FilePlus2 className="w-4 h-4" />
            <span>Examinar dispositivo</span>
          </span>
        </div>
      </section>

      {/* Formulario del archivo capturado y Categoría */}
      <form onSubmit={handleUploadSubmit} className="space-y-4">
        {detectedFile && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <FileTypeBadgeIcon type={detectedFile.type} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] break-all">
                    {detectedFile.originalName}
                  </p>
                  <p className="text-[11px] text-[#64748B] tabular-nums mt-0.5">
                    {detectedFile.mimeType} · {formatBytes(detectedFile.sizeBytes)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Quitar archivo seleccionado"
                disabled={isBusy}
                onClick={() => {
                  clearCandidate();
                  setErrorAlert('');
                }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Resumen de verificación de origen según el tipo de archivo */}
            <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-[#16A34A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Archivo íntegro listo para visor y descarga</span>
                </span>
                <span className="text-[#64748B] font-mono tabular-nums">
                  {detectedFile.extension || detectedFile.mimeType}
                </span>
              </div>

              {detectedFile.capturedPayload.viewerKind === 'image' && (
                <div className="space-y-1.5 text-center">
                  <div className="bg-[#0F172A] rounded-lg p-2 flex items-center justify-center">
                    <img
                      src={
                        previewImageUrl ||
                        detectedFile.capturedPayload.base64DataUrl
                      }
                      alt={detectedFile.originalName}
                      referrerPolicy="no-referrer"
                      className="max-h-40 w-auto max-w-full object-contain rounded"
                    />
                  </div>
                  {detectedFile.capturedPayload.imageDimensions && (
                    <p className="text-[11px] text-[#64748B] tabular-nums">
                      Imagen real ({detectedFile.mimeType}) ·{' '}
                      {detectedFile.capturedPayload.imageDimensions.width} ×{' '}
                      {detectedFile.capturedPayload.imageDimensions.height} px
                    </p>
                  )}
                </div>
              )}

              {detectedFile.capturedPayload.viewerKind === 'pdf' && (
                <p className="text-[11px] text-[#64748B] tabular-nums">
                  PDF verificado para lector &lt;canvas&gt; ·{' '}
                  {detectedFile.capturedPayload.pdfPageCount || 1}{' '}
                  {detectedFile.capturedPayload.pdfPageCount === 1
                    ? 'página'
                    : 'páginas'}
                </p>
              )}

              {detectedFile.capturedPayload.viewerKind === 'docx' && (
                <div className="space-y-1">
                  <p className="text-[11px] text-[#1E3A8A] font-medium">
                    Documento Word (.docx) verificado con Mammoth.js
                  </p>
                  {detectedFile.capturedPayload.docxPreviewText && (
                    <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed">
                      {detectedFile.capturedPayload.docxPreviewText}
                    </p>
                  )}
                </div>
              )}

              {detectedFile.capturedPayload.viewerKind === 'spreadsheet' &&
                detectedFile.capturedPayload.sheetSummary && (
                  <p className="text-[11px] text-[#1E3A8A] font-medium tabular-nums">
                    Hoja de cálculo verificada ·{' '}
                    {detectedFile.capturedPayload.sheetSummary.sheetCount}{' '}
                    {detectedFile.capturedPayload.sheetSummary.sheetCount === 1
                      ? 'hoja'
                      : 'hojas'}{' '}
                    ({detectedFile.capturedPayload.sheetSummary.rowCount} filas ×{' '}
                    {detectedFile.capturedPayload.sheetSummary.colCount} columnas)
                  </p>
                )}

              {detectedFile.capturedPayload.viewerKind === 'text' &&
                detectedFile.capturedPayload.textPreview && (
                  <pre className="max-h-24 overflow-y-auto p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-[11px] font-mono text-[#0F172A] whitespace-pre-wrap break-words leading-relaxed">
                    {detectedFile.capturedPayload.textPreview}
                  </pre>
                )}
            </div>

            {/* Nombre del archivo conservando su extensión original exacta */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="upload-custom-name"
                  className="text-xs font-semibold text-[#0F172A]"
                >
                  Nombre del archivo (conserva su extensión original)
                </label>
                <span className="text-[11px] text-[#64748B] tabular-nums">
                  {customBaseName.length}/{MAX_DOC_BASENAME_LENGTH}
                </span>
              </div>
              <div className="flex items-center h-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus-within:bg-white focus-within:border-[#2563EB] px-3 gap-2">
                <input
                  id="upload-custom-name"
                  type="text"
                  required
                  disabled={isBusy}
                  maxLength={MAX_DOC_BASENAME_LENGTH}
                  value={customBaseName}
                  onChange={(e) => setCustomBaseName(e.target.value)}
                  placeholder="Nombre_del_archivo"
                  className="flex-1 min-w-0 bg-transparent text-sm text-[#0F172A] focus:outline-none"
                />
                {detectedFile.extension && (
                  <span className="text-xs font-mono font-semibold text-[#1E3A8A] tabular-nums shrink-0">
                    {detectedFile.extension}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selector Dropdown Obligatorio para la Categoría */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-2.5 shadow-2xs">
          <label
            htmlFor="upload-category-select"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Categoría del documento <span className="text-[#DC2626]">*</span>
          </label>
          <select
            id="upload-category-select"
            required
            disabled={isBusy}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value as DocumentCategory | '');
              if (errorAlert.includes('categoría')) {
                setErrorAlert('');
              }
            }}
            className="w-full h-11 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:bg-white focus:border-[#2563EB]"
          >
            <option value="">Selecciona una categoría...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setSelectedCategory(cat)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Barra de Progreso Animada */}
        {uploadProgress !== null && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin" />
                <span className="text-xs font-bold text-[#0F172A]">
                  Guardando archivo binario original...
                </span>
              </div>
              <span className="text-xs font-bold text-[#2563EB] font-mono tabular-nums">
                {uploadProgress}%
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <div className="space-y-1.5 text-[11px] text-[#64748B]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Persistencia binaria directa en IndexedDB (máx. 10 MB)</span>
                </span>
                <span className="text-[#16A34A] font-semibold">Completado</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Validación de cuota aislada de 10 GB</span>
                </span>
                <span className="text-[#16A34A] font-semibold">Verificado</span>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="space-y-2 pt-1">
          <button
            type="submit"
            disabled={isBusy}
            className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
          >
            <UploadCloud className="w-5 h-5" />
            <span>
              {uploadProgress !== null
                ? 'Guardando archivo...'
                : 'Subir documento'}
            </span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => onNavigate('documents')}
            className="w-full h-11 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Cancelar y volver
          </button>
        </div>
      </form>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#64748B] text-center pt-1">
        <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
        <span>
          Lectura integrada para PDF, Word (.docx), Excel (.xlsx/.xls/.csv), imágenes y texto
        </span>
      </div>
    </div>
  );
};
