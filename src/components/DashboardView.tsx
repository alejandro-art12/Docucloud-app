import React from 'react';
import {
  Search,
  UploadCloud,
  Plus,
  MoreVertical,
  ChevronRight,
  HardDrive,
  FolderOpen,
  Sparkles,
  AlertTriangle,
  Eye,
  Download,
} from 'lucide-react';
import {
  AppRoute,
  CATEGORIES,
  DocumentCategory,
  DocucloudDocument,
  DocucloudUser,
  MAX_STORAGE_BYTES,
} from '../types/docucloud';
import {
  formatBytes,
  formatDocDate,
  formatPercentageLabel,
  getStoragePercentage,
} from '../utils/formatters';
import { CategoryIcon, FileTypeBadgeIcon } from './FileTypeIcon';

interface DashboardViewProps {
  user: DocucloudUser;
  documents: DocucloudDocument[];
  onNavigate: (route: AppRoute) => void;
  onStartSearch: (query: string) => void;
  onSelectCategory: (category: DocumentCategory) => void;
  onOpenViewer: (doc: DocucloudDocument) => void;
  onDownloadDocument: (doc: DocucloudDocument) => Promise<void>;
  onOpenDocumentDetails: (doc: DocucloudDocument) => void;
  onOpenContextMenu: (doc: DocucloudDocument) => void;
  onSeedSampleDocs: () => Promise<void>;
  isSeedingSamples: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  documents,
  onNavigate,
  onStartSearch,
  onSelectCategory,
  onOpenViewer,
  onDownloadDocument,
  onOpenDocumentDetails,
  onOpenContextMenu,
  onSeedSampleDocs,
  isSeedingSamples,
}) => {
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Usuario';
  const usedBytes = user.usedStorageBytes;
  const remainingBytes = Math.max(0, MAX_STORAGE_BYTES - usedBytes);
  const usagePct = getStoragePercentage(usedBytes, MAX_STORAGE_BYTES);
  const isCriticalQuota = usagePct > 90;

  const recentDocs = [...documents]
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(0, 4);

  return (
    <div id="view-dashboard" className="px-4 pt-4 pb-20 space-y-5 relative">
      {/* Saludo Dinámico */}
      <section className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#2563EB]">
            {user.storageMode === 'firebase'
              ? 'Bóveda Cloud Firestore'
              : 'Bóveda Personal Cifrada'}
          </p>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight truncate">
            Hola, {firstName}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Tus documentos, organizados y a tu alcance
          </p>
        </div>
      </section>

      {/* Barra de Búsqueda Directa */}
      <section>
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-[#64748B] absolute left-3.5 pointer-events-none" />
          <input
            type="search"
            aria-label="Buscar documentos"
            placeholder="Buscar documentos..."
            onChange={(e) => {
              if (e.target.value.trim().length > 0) {
                onStartSearch(e.target.value);
              }
            }}
            onFocus={() => onStartSearch('')}
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] shadow-2xs focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
          />
        </div>
      </section>

      {/* Tarjeta de Cuota de Almacenamiento (10 GB) */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isCriticalQuota
                  ? 'bg-red-50 text-[#DC2626]'
                  : 'bg-[#DBEAFE] text-[#2563EB]'
              }`}
            >
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Cuota de almacenamiento
              </h2>
              <p className="text-xs text-[#64748B] tabular-nums">
                {formatBytes(usedBytes)} / 10.00 GB usados
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-bold font-mono-num ${
              isCriticalQuota ? 'text-[#DC2626]' : 'text-[#2563EB]'
            }`}
          >
            {formatPercentageLabel(usagePct)}
          </span>
        </div>

        {/* Barra de progreso (#2563EB normal, #DC2626 si > 90%) */}
        <div className="w-full h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCriticalQuota ? 'bg-[#DC2626]' : 'bg-[#2563EB]'
            }`}
            style={{
              width: `${usedBytes > 0 ? Math.max(usagePct, 1.5) : 0}%`,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#64748B] tabular-nums">
          <span>
            {documents.length}{' '}
            {documents.length === 1
              ? 'documento guardado'
              : 'documentos guardados'}
          </span>
          <span
            className={
              isCriticalQuota ? 'text-[#DC2626] font-semibold' : 'font-medium'
            }
          >
            {formatBytes(remainingBytes)} disponibles
          </span>
        </div>

        {isCriticalQuota && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Has superado el 90% de tu límite de 10 GB. Elimina archivos que no
              necesites para liberar espacio.
            </span>
          </div>
        )}
      </section>

      {/* Banner Destacado Subir Documento */}
      <section className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-4 text-white shadow-sm flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-sm font-bold tracking-tight">
            Sincronizar archivo nuevo
          </h2>
          <p className="text-xs text-[#DBEAFE] leading-snug">
            Guarda PDFs, imágenes, hojas de cálculo y documentos en tu bóveda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          className="h-11 px-3.5 rounded-xl bg-white text-[#2563EB] hover:bg-[#DBEAFE] font-semibold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Subir documento</span>
        </button>
      </section>

      {/* Acceso Rápido a Categorías */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">
            Acceso rápido a categorías
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('categories')}
            className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-0.5"
          >
            <span>Ver todas</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.map((category) => {
            const count = documents.filter(
              (d) => d.category === category
            ).length;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onSelectCategory(category)}
                className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] hover:bg-[#DBEAFE]/30 flex flex-col items-center text-center gap-1.5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center">
                  <CategoryIcon category={category} className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-[#0F172A] truncate w-full">
                  {category}
                </span>
                <span className="text-[10px] text-[#64748B] tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Lista de Documentos Recientes */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">
            Documentos recientes
          </h2>
          {documents.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('documents')}
              className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-0.5"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {recentDocs.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0F172A]">
                Tu bóveda está lista
              </p>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Todavía no tienes documentos. Sube tu primer archivo para
                comenzar a organizar tu información.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Subir documento</span>
              </button>
              <button
                type="button"
                disabled={isSeedingSamples}
                onClick={onSeedSampleDocs}
                className="w-full h-10 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE]/50 border border-[#E2E8F0] text-[#1E3A8A] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isSeedingSamples
                    ? 'Cargando documentos de ejemplo...'
                    : 'Cargar documentos de ejemplo'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-3 space-y-2.5 hover:border-[#2563EB]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDocumentDetails(doc)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <FileTypeBadgeIcon type={doc.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-[#64748B] truncate mt-0.5 tabular-nums">
                        {doc.category} ·{' '}
                        {formatDocDate(doc.uploadedAt, user.dateFormat)} ·{' '}
                        {formatBytes(doc.sizeBytes)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Opciones para ${doc.name}`}
                    onClick={() => onOpenContextMenu(doc)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] shrink-0"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0]/70">
                  <button
                    type="button"
                    onClick={() => onOpenViewer(doc)}
                    className="h-9 px-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>Abrir documento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadDocument(doc)}
                    className="h-9 px-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE] border border-[#E2E8F0] hover:border-[#2563EB]/30 text-[#1E3A8A] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                    <span>Descargar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Botón Flotante Subir Documento */}
      <button
        type="button"
        aria-label="Subir documento"
        onClick={() => onNavigate('upload')}
        className="fixed sm:absolute right-5 bottom-20 z-10 w-13 h-13 rounded-2xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white shadow-lg flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};
