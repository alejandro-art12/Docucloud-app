import React, { useState } from 'react';
import {
  Search,
  X,
  Plus,
  Clock,
  Star,
  FileText,
  FolderSearch,
} from 'lucide-react';
import {
  AppRoute,
  CATEGORIES,
  DocumentCategory,
  DocucloudDocument,
} from '../types/docucloud';
import { formatBytes } from '../utils/formatters';
import { CategoryIcon } from './FileTypeIcon';

interface CategoriesViewProps {
  documents: DocucloudDocument[];
  onSelectCategory: (category: DocumentCategory) => void;
  onQuickFilterRecent: () => void;
  onQuickFilterStarred: () => void;
  onQuickFilterPdf: () => void;
  onNavigate: (route: AppRoute) => void;
}

const CATEGORY_DESCRIPTIONS: Record<DocumentCategory, string> = {
  Académicos: 'Diplomas, apuntes, tesis e informes',
  Personales: 'Identificaciones, contratos y hogar',
  Trabajo: 'Proyectos, reportes y nóminas',
  Certificados: 'Constancias, licencias y talleres',
  Otros: 'Respaldos y documentos generales',
};

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  documents,
  onSelectCategory,
  onQuickFilterRecent,
  onQuickFilterStarred,
  onQuickFilterPdf,
  onNavigate,
}) => {
  const [filterText, setFilterText] = useState('');

  const totalBytes = documents.reduce((acc, d) => acc + d.sizeBytes, 0);

  const visibleCategories = CATEGORIES.filter((cat) =>
    cat.toLowerCase().includes(filterText.trim().toLowerCase())
  );

  return (
    <div id="view-categories" className="px-4 pt-4 pb-6 space-y-5">
      {/* Encabezado */}
      <section className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Categorías
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            5 categorías activas · {documents.length}{' '}
            {documents.length === 1
              ? 'documento en total'
              : 'documentos en total'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          className="h-10 px-3.5 rounded-xl bg-[#DBEAFE] hover:bg-[#2563EB] text-[#2563EB] hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Subir</span>
        </button>
      </section>

      {/* Buscador de Categorías */}
      <section className="relative flex items-center">
        <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filtrar categorías..."
          className="w-full h-11 pl-10 pr-9 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
        />
        {filterText && (
          <button
            type="button"
            aria-label="Limpiar búsqueda de categoría"
            onClick={() => setFilterText('')}
            className="absolute right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </section>

      {/* 5 Tarjetas Principales de Categorías */}
      {visibleCategories.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center space-y-2">
          <FolderSearch className="w-8 h-8 text-[#64748B] mx-auto" />
          <p className="text-sm font-bold text-[#0F172A]">Sin resultados</p>
          <p className="text-xs text-[#64748B]">
            No hay categorías que coincidan con &quot;{filterText}&quot;.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3">
          {visibleCategories.map((category) => {
            const catDocs = documents.filter((d) => d.category === category);
            const count = catDocs.length;
            const catBytes = catDocs.reduce((acc, d) => acc + d.sizeBytes, 0);
            const sharePct =
              totalBytes > 0 ? Math.round((catBytes / totalBytes) * 100) : 0;

            return (
              <button
                key={category}
                type="button"
                onClick={() => onSelectCategory(category)}
                className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-3.5 text-left flex flex-col justify-between gap-3 shadow-2xs active:scale-[0.98] transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white flex items-center justify-center transition-colors">
                    <CategoryIcon category={category} className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-[#64748B] font-mono-num">
                    {formatBytes(catBytes, 1)}
                  </span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                    {category}
                  </h2>
                  <p className="text-xs font-medium text-[#64748B] tabular-nums">
                    {count} {count === 1 ? 'archivo' : 'archivos'}
                  </p>
                  <p className="text-[11px] text-[#64748B] line-clamp-1">
                    {CATEGORY_DESCRIPTIONS[category]}
                  </p>
                </div>

                <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                    style={{
                      width: `${count > 0 ? Math.max(sharePct, 8) : 0}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Acceso Rápido a Etiquetas */}
      <section className="space-y-2.5 pt-1">
        <h2 className="text-sm font-bold text-[#0F172A]">
          Acceso rápido a etiquetas
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={onQuickFilterRecent}
            className="h-10 px-3.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span>Recientes</span>
          </button>
          <button
            type="button"
            onClick={onQuickFilterStarred}
            className="h-10 px-3.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Star className="w-4 h-4 text-[#2563EB]" />
            <span>Favoritos</span>
          </button>
          <button
            type="button"
            onClick={onQuickFilterPdf}
            className="h-10 px-3.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#2563EB] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileText className="w-4 h-4 text-[#DC2626]" />
            <span>Archivos PDF</span>
          </button>
        </div>
      </section>
    </div>
  );
};
