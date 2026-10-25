import React, { useState } from 'react';
import {
  Home,
  Folder,
  LayoutGrid,
  User,
  Bell,
  ArrowLeft,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AppRoute,
  DocucloudDocument,
  DocucloudUser,
  ToastMessage,
} from '../types/docucloud';
import {
  formatBytes,
  formatRelativeTime,
  getInitials,
} from '../utils/formatters';
import { DocucloudLogo } from './FileTypeIcon';
import { ToastContainer } from './ToastContainer';

interface AppShellProps {
  route: AppRoute;
  currentUser: DocucloudUser | null;
  recentDocs: DocucloudDocument[];
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
  onNavigate: (route: AppRoute) => void;
  onBack?: () => void;
  stackTitle?: string;
  children: React.ReactNode;
  overlayModals?: React.ReactNode;
}

const PUBLIC_ROUTES: AppRoute[] = [
  'login',
  'register',
  'forgot-password',
  'unregistered-account',
];

const STACK_HEADER_ROUTES: AppRoute[] = ['edit-profile', 'change-password'];

export const AppShell: React.FC<AppShellProps> = ({
  route,
  currentUser,
  recentDocs,
  toasts,
  onDismissToast,
  onNavigate,
  onBack,
  stackTitle,
  children,
  overlayModals,
}) => {
  const [showNotifs, setShowNotifs] = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(route) || !currentUser;
  const isStackHeader = STACK_HEADER_ROUTES.includes(route);
  const showBottomNav = !isPublic && !isStackHeader;

  const activeBottomTab: 'dashboard' | 'documents' | 'categories' | 'profile' =
    route === 'dashboard'
      ? 'dashboard'
      : route === 'categories'
      ? 'categories'
      : route === 'profile' ||
        route === 'edit-profile' ||
        route === 'change-password'
      ? 'profile'
      : 'documents';

  const navItems: {
    id: 'dashboard' | 'documents' | 'categories' | 'profile';
    hash: string;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'dashboard', hash: '#view-dashboard', label: 'Inicio', icon: Home },
    {
      id: 'documents',
      hash: '#view-documents',
      label: 'Mis Documentos',
      icon: Folder,
    },
    {
      id: 'categories',
      hash: '#view-categories',
      label: 'Categorías',
      icon: LayoutGrid,
    },
    { id: 'profile', hash: '#view-profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-dvh w-full bg-[#E2E8F0] sm:py-5 flex items-center justify-center">
      {/* Contenedor Mobile-First Centrado (393px x 852px en escritorio, adaptable en móvil) */}
      <div className="relative w-full h-dvh sm:w-[393px] sm:h-[852px] bg-[#F8FAFC] sm:rounded-[34px] sm:shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)] sm:border-[6px] sm:border-[#0F172A] flex flex-col overflow-hidden">
        {/* Notificaciones Toast Flotantes */}
        <ToastContainer toasts={toasts} onDismiss={onDismissToast} />

        {/* Barra Superior Autenticada */}
        {!isPublic && currentUser && (
          <header className="h-14 px-4 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between shrink-0 z-20">
            {isStackHeader ? (
              <>
                <button
                  type="button"
                  aria-label="Volver atrás"
                  onClick={() => (onBack ? onBack() : onNavigate('profile'))}
                  className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-[#0F172A] truncate">
                  {stackTitle || 'Docucloud'}
                </h1>
                <div className="w-8" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="flex items-center gap-2 text-left"
                >
                  <DocucloudLogo size="sm" />
                  <span className="text-base font-bold tracking-tight text-[#1E3A8A] whitespace-nowrap">
                    Docucloud
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Notificaciones de la bóveda"
                    onClick={() => setShowNotifs((prev) => !prev)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#2563EB] hover:bg-[#DBEAFE]/50 transition-colors relative"
                  >
                    <Bell className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Abrir perfil de usuario"
                    onClick={() => onNavigate('profile')}
                    className="w-9 h-9 rounded-full bg-[#DBEAFE] text-[#1E3A8A] font-bold text-xs flex items-center justify-center border border-[#2563EB]/20 hover:bg-[#2563EB] hover:text-white transition-colors"
                  >
                    {getInitials(currentUser.fullName)}
                  </button>
                </div>
              </>
            )}
          </header>
        )}

        {/* Panel de Actividad y Notificaciones */}
        {showNotifs && currentUser && !isPublic && (
          <div className="absolute inset-x-3 top-16 z-30 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0F172A]">
                Actividad y Seguridad
              </span>
              <button
                type="button"
                aria-label="Cerrar panel de actividad"
                onClick={() => setShowNotifs(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <div className="text-xs text-[#64748B] leading-relaxed">
                <p className="font-semibold text-[#0F172A]">
                  Bóveda aislada de 10 GB activa
                </p>
                <p>
                  Usando {formatBytes(currentUser.usedStorageBytes)} de tu cuota
                  personal de 10.00 GB.
                </p>
              </div>
            </div>
            {recentDocs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#64748B]">
                  Últimos archivos sincronizados
                </p>
                {recentDocs.slice(0, 2).map((d) => (
                  <div
                    key={d.id}
                    className="text-xs flex items-center justify-between py-1 text-[#0F172A]"
                  >
                    <span className="truncate max-w-[200px] font-medium">
                      {d.name}
                    </span>
                    <span className="text-[#64748B] shrink-0 ml-2">
                      {formatRelativeTime(d.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contenido Principal Desplazable */}
        <main
          onClick={() => {
            if (showNotifs) setShowNotifs(false);
          }}
          className="flex-1 overflow-y-auto no-scrollbar bg-[#F8FAFC] flex flex-col"
        >
          {children}
        </main>

        {/* Barra de Navegación Inferior Persistente (4 Destinos Exactos) */}
        {showBottomNav && (
          <nav
            aria-label="Navegación principal inferior"
            className="h-16 px-2 bg-white border-t border-[#E2E8F0] grid grid-cols-4 items-center gap-1 shrink-0 z-20"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeBottomTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-route={item.hash}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    isActive
                      ? 'bg-[#DBEAFE] text-[#2563EB] font-semibold'
                      : 'bg-transparent text-[#64748B] hover:text-[#0F172A] font-medium'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[11px] leading-tight whitespace-nowrap truncate max-w-[84px]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Modales y Hojas Inferiores dentro del Marco Móvil */}
        {overlayModals}
      </div>
    </div>
  );
};
