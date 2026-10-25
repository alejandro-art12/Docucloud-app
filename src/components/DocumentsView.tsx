import React, { useState } from 'react';
import {
  Search,
  X,
  Plus,
  MoreVertical,
  List,
  LayoutGrid,
  ArrowUpDown,
  FolderOpen,
  UploadCloud,
  ArrowLeft,
  Star,
  FilterX,
  Lightbulb,
  Eye,
  Download,
} from 'lucide-react';
import {
  AppRoute,
  DocumentCategory,
  DocucloudDocument,
  DocucloudUser,
  FileFilterOption,
  SortOption,
} from '../types/docucloud';
import { formatBytes, formatDocDate } from '../utils/formatters';
import {
  LayoutViewMode,
  readUiPreferences,
  updateUiPreferences,
} from '../services/uiPreferencesService';
import { FileTypeBadgeIcon } from './FileTypeIcon';

interface DocumentsViewProps {
  mode: 'documents' | 'search';
  user: DocucloudUser;
  documents: DocucloudDocument[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  selectedCategory: DocumentCategory | 'All';
  onSelectCategory: (cat: DocumentCategory | 'All') => void;
  onlyStarred: boolean;
  onToggleOnlyStarred: (val: boolean) => void;
  fileFilter: FileFilterOption;
  onFileFilterChange: (f: FileFilterOption) => void;
  sortBy: SortOption;
  onSortByChange: (s: SortOption) => void;
  onNavigate: (route: AppRoute) => void;
  onOpenViewer: (doc: DocucloudDocument) => void;
  onDownloadDocument: (doc: DocucloudDocument) => Promise<void>;
  onOpenDocumentDetails: (doc: DocucloudDocument) => void;
  onOpenContextMenu: (doc: DocucloudDocument) => void;
}

function renderHighlightedTitle(title: string, query: string) {
  const clean = query.trim();
  if (!clean) return title;
  const lowerTitle = title.toLowerCase();
  const lowerQuery = clean.toLowerCase();
  const idx = lowerTitle.indexOf(lowerQuery);
  if (idx === -1) return title;

  return (
    <>
      {title.slice(0, idx)}
      <mark className="bg-[#DBEAFE] text-[#1E3A8A] font-bold rounded px-0.5">
        {title.slice(idx, idx + clean.length)}
      </mark>
      {title.slice(idx + clean.length)}
    </>
  );
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  mode,
  user,
  documents,
  searchQuery,
  onSearchQueryChange,
  selectedCategory,
  onSelectCategory,
  onlyStarred,
  onToggleOnlyStarred,
  fileFilter,
  onFileFilterChange,
  sortBy,
  onSortByChange,
  onNavigate,
  onOpenViewer,
  onDownloadDocument,
  onOpenDocumentDetails,
  onOpenContextMenu,
}) => {
  const [layoutMode, setLayoutMode] = useState<LayoutViewMode>(
    () => readUiPreferences().layoutMode
  );

  const handleLayoutChange = (nextMode: LayoutViewMode) => {
    setLayoutMode(nextMode);
    updateUiPreferences({ layoutMode: nextMode });
  };

  // Filtrado exclusivo de los documentos del usuario activo
  const filteredDocs = documents
    .filter((doc) => {
      if (selectedCategory !== 'All' && doc.category !== selectedCategory) {
        return false;
      }
      if (onlyStarred && !doc.starred) {
        return false;
      }
      if (fileFilter === 'pdf' && doc.type !== 'pdf') return false;
      if (fileFilter === 'image' && doc.type !== 'image') return false;
      if (
        fileFilter === 'documents' &&
        doc.type !== 'doc' &&
        doc.type !== 'xls'
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          doc.name.toLowerCase().includes(q) ||
          doc.category.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'size') {
        return b.sizeBytes - a.sizeBytes;
      }
      return b.updatedAt - a.updatedAt;
    });

  const resetAllFilters = () => {
    onSearchQueryChange('');
    onSelectCategory('All');
    onFileFilterChange('all');
    onToggleOnlyStarred(false);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All' ||
    fileFilter !== 'all' ||
    onlyStarred;

  const filterButtons: { id: FileFilterOption; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'pdf', label: 'PDF' },
    { id: 'image', label: 'Imágenes' },
    { id: 'documents', label: 'Documentos' },
  ];

  const suggestedTerms = ['contrato', 'certificado', 'informe', 'arrendamiento'];

  return (
    <div
      id={mode === 'search' ? 'view-search' : 'view-documents'}
      className="px-4 pt-4 pb-6 space-y-4"
    >
      {/* Cabecera */}
      {mode === 'search' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Volver al inicio"
            onClick={() => {
              onSearchQueryChange('');
              onNavigate('dashboard');
            }}
            className="w-11 h-11 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:bg-slate-50 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-[#2563EB] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Buscar documentos..."
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-white border border-[#2563EB] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Mis Documentos
            </h1>
            <p className="text-xs text-[#64748B]">
              Gestiona todos tus archivos desde aquí
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="h-11 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Subir</span>
          </button>
        </div>
      )}

      {/* Buscador interno en Mis Documentos */}
      {mode === 'documents' && (
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full h-11 pl-10 pr-9 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpiar texto de búsqueda"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Indicador de Filtro Activo por Categoría o Favoritos */}
      {(selectedCategory !== 'All' || onlyStarred) && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#DBEAFE]/60 border border-[#2563EB]/20 text-xs">
          <span className="font-semibold text-[#1E3A8A]">
            Filtro activo:{' '}
            {selectedCategory !== 'All'
              ? selectedCategory
              : 'Archivos favoritos'}
          </span>
          <button
            type="button"
            onClick={() => {
              onSelectCategory('All');
              onToggleOnlyStarred(false);
            }}
            className="text-[#2563EB] font-semibold hover:underline flex items-center gap-1"
          >
            <span>Quitar</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filtros por Tipo de Archivo */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {filterButtons.map((btn) => {
          const active = fileFilter === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => onFileFilterChange(btn.id)}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                active
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Ordenamiento y Selector Lista / Cuadrícula */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-xl px-2.5 h-10">
          <ArrowUpDown className="w-4 h-4 text-[#2563EB] shrink-0" />
          <label htmlFor="sort-select" className="sr-only">
            Ordenar documentos por
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortOption)}
            className="bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none pr-1"
          >
            <option value="date">Fecha de modificación</option>
            <option value="name">Nombre (A-Z)</option>
            <option value="size">Tamaño</option>
          </select>
        </div>

        <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl p-1">
          <button
            type="button"
            aria-label="Vista de lista"
            onClick={() => handleLayoutChange('list')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              layoutMode === 'list'
                ? 'bg-[#DBEAFE] text-[#2563EB]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Vista de cuadrícula"
            onClick={() => handleLayoutChange('grid')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              layoutMode === 'grid'
                ? 'bg-[#DBEAFE] text-[#2563EB]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resumen de resultados en modo Búsqueda */}
      {mode === 'search' && (
        <p className="text-xs text-[#64748B] tabular-nums">
          <strong className="text-[#0F172A]">{filteredDocs.length}</strong>{' '}
          {filteredDocs.length === 1
            ? 'resultado encontrado'
            : 'resultados encontrados'}
          {searchQuery.trim() ? ` para “${searchQuery.trim()}”` : ''}
        </p>
      )}

      {/* CASO 1: Estado Vacío cuando el usuario no tiene documentos */}
      {documents.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-4 mt-2">
          <div className="w-16 h-16 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#0F172A]">
              Sin documentos guardados
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed max-w-[280px] mx-auto">
              Todavía no tienes documentos. Sube tu primer archivo para comenzar
              a organizar tu información
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <UploadCloud className="w-5 h-5" />
            <span>Subir documento</span>
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        /* CASO 2: El usuario tiene documentos, pero la búsqueda/filtro no arrojó coincidencias */
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 text-center space-y-4">
          <svg
            className="w-28 h-28 mx-auto"
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="28"
              y="46"
              width="90"
              height="68"
              rx="12"
              fill="#DBEAFE"
            />
            <rect x="44" y="34" width="60" height="68" rx="8" fill="#FFFFFF" />
            <line
              x1="54"
              y1="50"
              x2="86"
              y2="50"
              stroke="#93C5FD"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="54"
              y1="62"
              x2="92"
              y2="62"
              stroke="#DBEAFE"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle
              cx="94"
              cy="92"
              r="24"
              fill="#FFFFFF"
              stroke="#2563EB"
              strokeWidth="5"
            />
            <line
              x1="112"
              y1="110"
              x2="132"
              y2="130"
              stroke="#1E3A8A"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#0F172A]">
              No se encontraron documentos
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              No hay archivos que coincidan con los términos de búsqueda ni con
              los filtros seleccionados en tu bóveda segura.
            </p>
          </div>

          <div className="space-y-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="w-full h-11 rounded-xl bg-[#DBEAFE] text-[#2563EB] font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <FilterX className="w-4 h-4" />
                <span>Limpiar búsqueda y filtros</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="w-full h-11 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Subir nuevo documento</span>
            </button>
          </div>

          {/* Consejos de búsqueda */}
          <div className="text-left p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
              <Lightbulb className="w-4 h-4 text-[#2563EB]" />
              <span>Consejos de búsqueda</span>
            </div>
            <ul className="text-[11px] text-[#64748B] space-y-1 list-disc pl-4">
              <li>
                Revisa que no existan errores ortográficos o guiones bajos
                innecesarios.
              </li>
              <li>Cambia el filtro de tipo de archivo nuevamente a &quot;Todos&quot;.</li>
            </ul>
          </div>
        </div>
      ) : layoutMode === 'list' ? (
        /* VISTA DE LISTA CON ACCIONES PRINCIPALES: ABRIR DOCUMENTO Y DESCARGAR */
        <div className="space-y-2.5">
          {filteredDocs.map((doc) => (
            <article
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
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-semibold text-[#0F172A] truncate">
                        {renderHighlightedTitle(doc.name, searchQuery)}
                      </h2>
                      {doc.starred && (
                        <Star className="w-3.5 h-3.5 text-[#2563EB] fill-[#2563EB] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] truncate mt-0.5 tabular-nums">
                      {doc.category} ·{' '}
                      {formatDocDate(doc.updatedAt, user.dateFormat)} ·{' '}
                      {formatBytes(doc.sizeBytes)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Opciones de archivo para ${doc.name}`}
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
            </article>
          ))}
        </div>
      ) : (
        /* VISTA DE CUADRÍCULA CON ACCIONES: ABRIR DOCUMENTO Y DESCARGAR */
        <div className="grid grid-cols-2 gap-2.5">
          {filteredDocs.map((doc) => (
            <article
              key={doc.id}
              className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex flex-col justify-between gap-2.5 hover:border-[#2563EB]/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDocumentDetails(doc)}
                  aria-label={`Ver detalles de ${doc.name}`}
                >
                  <FileTypeBadgeIcon type={doc.type} size="sm" />
                </button>
                <button
                  type="button"
                  aria-label={`Opciones de archivo para ${doc.name}`}
                  onClick={() => onOpenContextMenu(doc)}
                  className="w-8 h-8 -mr-1.5 -mt-1 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenDocumentDetails(doc)}
                className="text-left min-w-0"
              >
                <h2 className="text-xs font-bold text-[#0F172A] truncate">
                  {doc.name}
                </h2>
                <p className="text-[11px] text-[#64748B] mt-0.5 truncate tabular-nums">
                  {doc.category} · {formatBytes(doc.sizeBytes)}
                </p>
              </button>
              <div className="flex flex-col gap-1.5 pt-1 border-t border-[#E2E8F0]/70">
                <button
                  type="button"
                  onClick={() => onOpenViewer(doc)}
                  className="w-full h-8 px-2 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Eye className="w-3 h-3 shrink-0" />
                  <span>Abrir documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadDocument(doc)}
                  className="w-full h-8 px-2 rounded-lg bg-[#F8FAFC] hover:bg-[#DBEAFE] border border-[#E2E8F0] text-[#1E3A8A] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3 h-3 text-[#2563EB] shrink-0" />
                  <span>Descargar</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Sugerencias rápidas en modo Búsqueda */}
      {mode === 'search' && documents.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 space-y-2">
          <p className="text-xs font-semibold text-[#0F172A]">
            ¿Buscabas también?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTerms.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSearchQueryChange(term)}
                className="px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#DBEAFE] border border-[#E2E8F0] text-xs text-[#0F172A] font-medium transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
