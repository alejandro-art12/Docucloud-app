import React, { useEffect, useState } from 'react';
import {
  Eye,
  Download,
  Edit3,
  Info,
  Share2,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react';
import {
  CATEGORIES,
  DocumentCategory,
  DocucloudDocument,
  MAX_DOC_BASENAME_LENGTH,
} from '../types/docucloud';
import {
  composeExactFilename,
  formatBytes,
  splitFilename,
} from '../utils/formatters';
import { FileTypeBadgeIcon } from './FileTypeIcon';

interface ContextMenuSheetProps {
  document: DocucloudDocument | null;
  onClose: () => void;
  onOpenViewer: (doc: DocucloudDocument) => void;
  onDownload: (doc: DocucloudDocument) => Promise<void>;
  onOpenDetails: (doc: DocucloudDocument) => void;
  onRename: (doc: DocucloudDocument) => void;
  onDelete: (doc: DocucloudDocument) => void;
  onShare: (doc: DocucloudDocument) => void;
}

export const ContextMenuSheet: React.FC<ContextMenuSheetProps> = ({
  document,
  onClose,
  onOpenViewer,
  onDownload,
  onOpenDetails,
  onRename,
  onDelete,
  onShare,
}) => {
  if (!document) return null;

  return (
    <div
      className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/55 backdrop-blur-xs flex flex-col justify-end"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Opciones del documento"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white rounded-t-3xl p-4 space-y-3 shadow-2xl border-t border-[#E2E8F0]"
      >
        <div className="w-10 h-1 bg-[#E2E8F0] rounded-full mx-auto" />

        <div className="flex items-center gap-3 pb-2 border-b border-[#E2E8F0]">
          <FileTypeBadgeIcon type={document.type} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#0F172A] truncate">
              {document.name}
            </p>
            <p className="text-xs text-[#64748B] tabular-nums">
              {document.category} · {formatBytes(document.sizeBytes)}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              const target = document;
              onClose();
              onOpenViewer(target);
            }}
            className="w-full h-11 px-3 rounded-xl hover:bg-[#F8FAFC] text-left flex items-center gap-3 text-sm font-medium text-[#0F172A]"
          >
            <Eye className="w-5 h-5 text-[#2563EB] shrink-0" />
            <span>Abrir documento</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = document;
              onClose();
              void onDownload(target);
            }}
            className="w-full h-11 px-3 rounded-xl hover:bg-[#F8FAFC] text-left flex items-center gap-3 text-sm font-medium text-[#0F172A]"
          >
            <Download className="w-5 h-5 text-[#2563EB] shrink-0" />
            <span>Descargar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = document;
              onClose();
              onRename(target);
            }}
            className="w-full h-11 px-3 rounded-xl hover:bg-[#F8FAFC] text-left flex items-center gap-3 text-sm font-medium text-[#0F172A]"
          >
            <Edit3 className="w-5 h-5 text-[#64748B] shrink-0" />
            <span>Renombrar o cambiar categoría</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = document;
              onClose();
              onOpenDetails(target);
            }}
            className="w-full h-11 px-3 rounded-xl hover:bg-[#F8FAFC] text-left flex items-center gap-3 text-sm font-medium text-[#0F172A]"
          >
            <Info className="w-5 h-5 text-[#64748B] shrink-0" />
            <span>Ver detalles y metadatos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = document;
              onClose();
              onShare(target);
            }}
            className="w-full h-11 px-3 rounded-xl hover:bg-[#F8FAFC] text-left flex items-center gap-3 text-sm font-medium text-[#0F172A]"
          >
            <Share2 className="w-5 h-5 text-[#64748B] shrink-0" />
            <span>Copiar enlace seguro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const target = document;
              onClose();
              onDelete(target);
            }}
            className="w-full h-11 px-3 rounded-xl hover:bg-red-50 text-left flex items-center gap-3 text-sm font-semibold text-[#DC2626]"
          >
            <Trash2 className="w-5 h-5 shrink-0" />
            <span>Eliminar archivo</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]"
        >
          Cancelar
        </button>
      </section>
    </div>
  );
};

interface RenameDocumentModalProps {
  document: DocucloudDocument | null;
  onClose: () => void;
  onConfirmRename: (
    docId: string,
    newFullName: string,
    newCategory: DocumentCategory
  ) => Promise<void>;
}

export const RenameDocumentModal: React.FC<RenameDocumentModalProps> = ({
  document,
  onClose,
  onConfirmRename,
}) => {
  const [baseName, setBaseName] = useState('');
  const [extension, setExtension] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Personales');
  const [validationError, setValidationError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (document) {
      const parts = splitFilename(document.name);
      setBaseName(parts.baseName.slice(0, MAX_DOC_BASENAME_LENGTH));
      setExtension(parts.extension);
      setCategory(document.category);
      setValidationError('');
    }
  }, [document]);

  if (!document) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = baseName.trim();
    if (!trimmed) {
      setValidationError('El nombre del documento no puede estar vacío.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\s().áéíóúÁÉÍÓÚñÑ]+$/.test(trimmed)) {
      setValidationError(
        'Caracteres permitidos: letras, números, espacios, guiones y guiones bajos.'
      );
      return;
    }

    setIsSaving(true);
    try {
      await onConfirmRename(
        document.id,
        composeExactFilename(trimmed, extension),
        category
      );
      onClose();
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : 'No fue posible renombrar el documento.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/60 backdrop-blur-xs flex flex-col justify-end"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white rounded-t-3xl p-5 space-y-4 shadow-2xl border-t border-[#E2E8F0]"
      >
        <div className="w-10 h-1 bg-[#E2E8F0] rounded-full mx-auto -mt-1" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="rename-modal-title"
                className="text-base font-bold text-[#0F172A]"
              >
                Cambiar nombre
              </h2>
              <p className="text-xs text-[#64748B]">
                Ingresa un nuevo nombre sin modificar la extensión original.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal de renombrar"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="rename-input"
                className="text-xs font-semibold text-[#0F172A]"
              >
                Nombre del documento
              </label>
              <span className="text-[11px] text-[#64748B] tabular-nums">
                {baseName.length}/{MAX_DOC_BASENAME_LENGTH}
              </span>
            </div>

            <div className="flex items-center h-12 px-3 rounded-xl bg-[#F8FAFC] border border-[#2563EB] gap-2">
              <input
                id="rename-input"
                type="text"
                autoFocus
                maxLength={MAX_DOC_BASENAME_LENGTH}
                value={baseName}
                onChange={(e) => {
                  setBaseName(e.target.value);
                  setValidationError('');
                }}
                placeholder="Nombre del documento"
                className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[#0F172A] focus:outline-none"
              />
              {baseName && (
                <button
                  type="button"
                  aria-label="Limpiar texto"
                  onClick={() => setBaseName('')}
                  className="w-7 h-7 rounded-full bg-[#E2E8F0] text-[#64748B] flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {extension && (
                <span className="px-2 py-0.5 rounded bg-[#DBEAFE] text-[#1E3A8A] text-xs font-mono font-semibold shrink-0">
                  {extension}
                </span>
              )}
            </div>

            {validationError ? (
              <p className="text-xs text-[#DC2626] font-medium">
                {validationError}
              </p>
            ) : (
              <p className="text-[11px] text-[#64748B]">
                Permitidos: letras, números, espacios, guiones y guiones bajos.
              </p>
            )}
          </div>

          {/* Selector rápido de categoría */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <p className="text-xs font-semibold text-[#0F172A]">Categoría</p>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <span>{cat}</span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

interface DeleteDocumentModalProps {
  document: DocucloudDocument | null;
  onClose: () => void;
  onConfirmDelete: (doc: DocucloudDocument) => Promise<void>;
}

export const DeleteDocumentModal: React.FC<DeleteDocumentModalProps> = ({
  document,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!document) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(document);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] space-y-4 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2
            id="delete-modal-title"
            className="text-lg font-bold text-[#0F172A]"
          >
            ¿Eliminar documento?
          </h2>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5 text-left my-2">
            <FileTypeBadgeIcon type={document.type} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0F172A] truncate">
                {document.name}
              </p>
              <p className="text-[11px] text-[#16A34A] font-semibold tabular-nums">
                Libera {formatBytes(document.sizeBytes)} de almacenamiento
              </p>
            </div>
          </div>

          <p className="text-xs text-[#DC2626] font-medium leading-relaxed bg-red-50 border border-red-200 rounded-xl p-3">
            ¿Estás seguro de eliminar{' '}
            <strong className="break-all">{document.name}</strong>? Esta acción
            liberará espacio de tu almacenamiento pero no se podrá deshacer
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleConfirm}
            className="w-full h-12 rounded-xl bg-[#DC2626] hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Eliminar documento</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
