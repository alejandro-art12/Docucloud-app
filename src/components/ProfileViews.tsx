import React, { useState } from 'react';
import {
  User,
  Edit3,
  KeyRound,
  ShieldCheck,
  FileText,
  Info,
  LogOut,
  ChevronRight,
  HardDrive,
  QrCode,
  X,
  Check,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  Phone,
  AtSign,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import {
  AccountTypeOption,
  APP_VERSION,
  AppRoute,
  DateFormatOption,
  DocucloudUser,
  MAX_STORAGE_BYTES,
  OFFICIAL_APP_NAME,
  OFFICIAL_SLOGAN,
  OFFICIAL_SUBTITLE,
  ProfileUpdatePayload,
} from '../types/docucloud';
import {
  formatBytes,
  formatPercentageLabel,
  getInitials,
  getStoragePercentage,
} from '../utils/formatters';
import { DocucloudLogo } from './FileTypeIcon';

interface ProfileMainViewProps {
  user: DocucloudUser;
  documentCount: number;
  onNavigate: (route: AppRoute) => void;
  onConfirmLogout: () => Promise<void>;
  onSeedSampleDocs: () => Promise<void>;
  isSeedingSamples: boolean;
}

export const ProfileMainView: React.FC<ProfileMainViewProps> = ({
  user,
  documentCount,
  onNavigate,
  onConfirmLogout,
  onSeedSampleDocs,
  isSeedingSamples,
}) => {
  const [activeModal, setActiveModal] = useState<
    null | 'privacy-security' | 'terms' | 'about' | 'qr' | 'logout'
  >(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const usedBytes = user.usedStorageBytes;
  const remainingBytes = Math.max(0, MAX_STORAGE_BYTES - usedBytes);
  const usagePct = getStoragePercentage(usedBytes, MAX_STORAGE_BYTES);
  const isCriticalQuota = usagePct > 90;

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirmLogout();
    } finally {
      setIsLoggingOut(false);
      setActiveModal(null);
    }
  };

  return (
    <div id="view-profile" className="px-4 pt-4 pb-6 space-y-5 relative">
      {/* Encabezado de pantalla */}
      <section>
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
          Perfil y Configuración
        </h1>
        <p className="text-xs text-[#64748B]">
          Gestiona tu cuenta, tu cuota de 10 GB y tu seguridad
        </p>
      </section>

      {/* Tarjeta de identidad del usuario */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-15 h-15 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
            {getInitials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#0F172A] truncate">
              {user.fullName}
            </h2>
            <p className="text-xs text-[#64748B] truncate">{user.email}</p>
            <p className="text-[11px] font-medium text-[#2563EB] mt-1">
              @{user.username} ·{' '}
              {user.storageMode === 'firebase'
                ? 'Sincronizado en Cloud Firestore'
                : 'Bóveda Local Aislada'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('edit-profile')}
            className="flex-1 h-11 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE]/50 border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Edit3 className="w-4 h-4 text-[#2563EB]" />
            <span>Editar perfil</span>
          </button>
          <button
            type="button"
            aria-label="Mostrar huella de seguridad de la bóveda"
            onClick={() => setActiveModal('qr')}
            className="w-11 h-11 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE]/50 border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] transition-colors"
          >
            <QrCode className="w-5 h-5 text-[#2563EB]" />
          </button>
        </div>
      </section>

      {/* Resumen del Plan de Almacenamiento (10 GB) */}
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
              <h3 className="text-sm font-bold text-[#0F172A]">
                Plan Gratuito - 10 GB de almacenamiento seguro
              </h3>
              <p className="text-xs text-[#64748B] tabular-nums mt-0.5">
                {formatBytes(usedBytes)} de 10.00 GB (
                {formatPercentageLabel(usagePct)})
              </p>
            </div>
          </div>
        </div>

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
            {documentCount}{' '}
            {documentCount === 1 ? 'archivo guardado' : 'archivos guardados'}
          </span>
          <span>{formatBytes(remainingBytes)} disponibles</span>
        </div>
      </section>

      {/* Opciones de Cuenta y Seguridad */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-[#64748B] px-1">
          Cuenta y seguridad
        </h3>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl divide-y divide-[#E2E8F0] overflow-hidden">
          <button
            type="button"
            onClick={() => onNavigate('edit-profile')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Editar perfil
                </p>
                <p className="text-xs text-[#64748B]">
                  Nombre, datos de contacto y preferencias
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('change-password')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Cambiar contraseña
                </p>
                <p className="text-xs text-[#64748B]">
                  Actualiza tus credenciales y reglas de protección
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('privacy-security')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Privacidad y seguridad
                </p>
                <p className="text-xs text-[#64748B]">
                  Aislamiento Zero-Knowledge y estado de bóveda
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
          </button>
        </div>
      </section>

      {/* Opciones Legales e Información */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-[#64748B] px-1">
          Información y legal
        </h3>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl divide-y divide-[#E2E8F0] overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveModal('terms')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#64748B] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Términos y condiciones
                </p>
                <p className="text-xs text-[#64748B]">
                  Condiciones del servicio y política de 10 GB
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('about')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#64748B] flex items-center justify-center shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Acerca de Docucloud
                </p>
                <p className="text-xs text-[#64748B]">Versión {APP_VERSION}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
          </button>
        </div>
      </section>

      {/* Botón Rojo Cerrar sesión (#DC2626) */}
      <section className="pt-1">
        <button
          type="button"
          onClick={() => setActiveModal('logout')}
          className="w-full h-12 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-[#DC2626] font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-5 h-5 text-[#DC2626]" />
          <span>Cerrar sesión</span>
        </button>
      </section>

      {/* MODALES DE SUB-SECCIONES DEL PERFIL */}
      {activeModal === 'about' && (
        <div
          className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#E2E8F0] text-center space-y-4"
          >
            <div className="flex justify-center">
              <DocucloudLogo size="lg" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#0F172A]">
                {OFFICIAL_APP_NAME}
              </h2>
              <p className="text-xs font-mono-num text-[#64748B]">
                Versión {APP_VERSION}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#DBEAFE]/50 border border-[#2563EB]/20 space-y-1">
              <p className="text-sm font-bold text-[#1E3A8A]">
                “{OFFICIAL_SLOGAN}”
              </p>
              <p className="text-xs text-[#64748B]">{OFFICIAL_SUBTITLE}</p>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Bóveda móvil de documentos diseñada para ofrecer 10.00 GB de
              almacenamiento estrictamente aislado por cada cuenta registrada.
            </p>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full h-11 rounded-xl bg-[#2563EB] text-white font-semibold text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {activeModal === 'privacy-security' && (
        <div
          className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">
                Privacidad y seguridad
              </h2>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
              <p className="font-bold text-[#0F172A]">
                Motor de almacenamiento activo:{' '}
                {user.storageMode === 'firebase'
                  ? 'Firebase Cloud Firestore'
                  : 'Bóveda Local Aislada'}
              </p>
              <p className="text-[#64748B] leading-relaxed">
                Todas las consultas aplican filtrado estricto por propietario (
                <code className="font-mono-num text-[#1E3A8A]">
                  userId == {user.uid.slice(0, 10)}...
                </code>
                ). Tus documentos y estadísticas de uso están completamente
                aislados.
              </p>
            </div>

            <button
              type="button"
              disabled={isSeedingSamples}
              onClick={async () => {
                await onSeedSampleDocs();
                setActiveModal(null);
              }}
              className="w-full h-11 rounded-xl bg-[#DBEAFE] text-[#1E3A8A] font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isSeedingSamples
                  ? 'Agregando documentos de ejemplo...'
                  : 'Agregar 4 documentos de ejemplo a la bóveda'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full h-11 rounded-xl bg-[#2563EB] text-white font-semibold text-xs"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {activeModal === 'terms' && (
        <div
          className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">
                Términos y condiciones
              </h2>
              <button
                type="button"
                aria-label="Cerrar términos"
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#64748B] leading-relaxed space-y-2 max-h-60 overflow-y-auto">
              <p>
                1. <strong>Cuota de almacenamiento:</strong> Cada cuenta
                registrada en Docucloud incluye un límite aislado de 10.00 GB
                (10,737,418,240 bytes).
              </p>
              <p>
                2. <strong>Aislamiento por cuenta:</strong> Los archivos,
                categorías y contadores de almacenamiento pertenecen
                exclusivamente al titular autenticado y nunca se comparten con
                otros usuarios.
              </p>
              <p>
                3. <strong>Eliminaciones:</strong> Al eliminar un documento se
                borra permanentemente su registro y se libera de inmediato su
                espacio en tu cuota disponible de 10 GB.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full h-11 rounded-xl bg-[#2563EB] text-white font-semibold text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {activeModal === 'qr' && (
        <div
          className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-3"
          >
            <h2 className="text-base font-bold text-[#0F172A]">
              Clave de identidad de la bóveda
            </h2>
            <div className="w-36 h-36 mx-auto rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center">
              <QrCode className="w-24 h-24 text-[#1E3A8A]" />
            </div>
            <p className="text-[11px] font-mono-num text-[#64748B] break-all">
              UID: {user.uid}
            </p>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full h-11 rounded-xl bg-[#2563EB] text-white font-semibold text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación para Cerrar sesión */}
      {activeModal === 'logout' && (
        <div
          className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-[#E2E8F0] text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2
                id="logout-dialog-title"
                className="text-base font-bold text-[#0F172A]"
              >
                ¿Cerrar sesión en Docucloud?
              </h2>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Tu sesión activa se cerrará y los datos en memoria se limpiarán
                de forma segura.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleLogoutClick}
                className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white font-semibold text-xs flex items-center justify-center gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cerrando sesión...</span>
                  </>
                ) : (
                  <span>Confirmar cierre de sesión</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full h-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface EditProfileViewProps {
  user: DocucloudUser;
  onSaveProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  onCancel: () => void;
}

export const EditProfileView: React.FC<EditProfileViewProps> = ({
  user,
  onSaveProfile,
  onCancel,
}) => {
  const [accountType, setAccountType] = useState<AccountTypeOption>(
    user.accountType
  );
  const [fullName, setFullName] = useState(user.fullName);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [countryCode, setCountryCode] = useState(user.countryCode || '+54');
  const [phone, setPhone] = useState(user.phone);
  const [bio, setBio] = useState(user.bio);
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(
    user.dateFormat
  );
  const [securityAlerts, setSecurityAlerts] = useState<boolean>(
    user.securityAlerts
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!fullName.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }
    setIsSaving(true);
    try {
      await onSaveProfile({
        fullName,
        email,
        username,
        phone,
        countryCode,
        bio,
        accountType,
        dateFormat,
        securityAlerts,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No fue posible guardar los cambios del perfil.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setAccountType(user.accountType);
    setFullName(user.fullName);
    setUsername(user.username);
    setEmail(user.email);
    setCountryCode(user.countryCode || '+54');
    setPhone(user.phone);
    setBio(user.bio);
    setDateFormat(user.dateFormat);
    setSecurityAlerts(user.securityAlerts);
    onCancel();
  };

  return (
    <div id="view-edit-profile" className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] text-white font-bold text-2xl flex items-center justify-center shadow-sm">
          {getInitials(fullName || user.fullName)}
        </div>
        <div>
          <p className="text-sm font-bold text-[#0F172A]">
            {fullName || user.fullName}
          </p>
          <p className="text-xs text-[#64748B]">Bóveda Personal Protegida</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Tipo de uso del perfil */}
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-[#0F172A]">
            Tipo de uso del perfil
          </span>
          <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-[#E2E8F0] rounded-xl">
            <button
              type="button"
              onClick={() => setAccountType('personal')}
              className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                accountType === 'personal'
                  ? 'bg-[#DBEAFE] text-[#2563EB]'
                  : 'text-[#64748B]'
              }`}
            >
              Personal / Familiar
            </button>
            <button
              type="button"
              onClick={() => setAccountType('independent')}
              className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                accountType === 'independent'
                  ? 'bg-[#DBEAFE] text-[#2563EB]'
                  : 'text-[#64748B]'
              }`}
            >
              Independiente
            </button>
          </div>
        </div>

        {/* Nombre completo */}
        <div className="space-y-1">
          <label
            htmlFor="edit-fullname"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Nombre completo
          </label>
          <div className="relative flex items-center">
            <User className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
            <input
              id="edit-fullname"
              type="text"
              required
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        {/* Alias de la bóveda */}
        <div className="space-y-1">
          <label
            htmlFor="edit-username"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Usuario o alias de la bóveda
          </label>
          <div className="relative flex items-center">
            <AtSign className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
            <input
              id="edit-username"
              type="text"
              required
              maxLength={40}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        {/* Correo electrónico */}
        <div className="space-y-1">
          <label
            htmlFor="edit-email"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Correo electrónico principal
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
            <input
              id="edit-email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={user.storageMode === 'firebase'}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] read-only:opacity-70"
            />
          </div>
        </div>

        {/* Teléfono móvil */}
        <div className="space-y-1">
          <label
            htmlFor="edit-phone"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Número de teléfono móvil
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Código telefónico de país"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="h-11 px-2.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]"
            >
              <option value="+54">+54 (AR)</option>
              <option value="+52">+52 (MX)</option>
              <option value="+57">+57 (CO)</option>
              <option value="+34">+34 (ES)</option>
              <option value="+56">+56 (CL)</option>
              <option value="+51">+51 (PE)</option>
              <option value="+1">+1 (EE. UU.)</option>
            </select>
            <div className="relative flex-1 flex items-center">
              <Phone className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
              <input
                id="edit-phone"
                type="tel"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9 11 4523-8890"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

        {/* Ocupación o biografía breve */}
        <div className="space-y-1">
          <label
            htmlFor="edit-bio"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Ocupación o descripción breve
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3.5 pointer-events-none" />
            <textarea
              id="edit-bio"
              maxLength={300}
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Usuario particular de bóveda digital..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] resize-none"
            />
          </div>
        </div>

        {/* Preferencias */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">
                Formato de fecha
              </p>
              <p className="text-[11px] text-[#64748B]">
                Usado en las listas de documentos
              </p>
            </div>
            <select
              aria-label="Formato de fecha"
              value={dateFormat}
              onChange={(e) =>
                setDateFormat(e.target.value as DateFormatOption)
              }
              className="h-9 px-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]"
            >
              <option value="DD/MM/YYYY">DD/MM/AAAA</option>
              <option value="MM/DD/YYYY">MM/DD/AAAA</option>
              <option value="YYYY-MM-DD">AAAA-MM-DD</option>
            </select>
          </div>

          <div className="border-t border-[#E2E8F0] pt-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">
                Alertas de seguridad
              </p>
              <p className="text-[11px] text-[#64748B]">
                Notificar cambios de acceso en la bóveda
              </p>
            </div>
            <input
              type="checkbox"
              checked={securityAlerts}
              onChange={(e) => setSecurityAlerts(e.target.checked)}
              className="w-4 h-4 rounded accent-[#2563EB]"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
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
                <Check className="w-4 h-4" />
                <span>Guardar cambios</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            className="w-full h-11 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs"
          >
            Descartar cambios
          </button>
        </div>
      </form>
    </div>
  );
};

interface ChangePasswordViewProps {
  user: DocucloudUser;
  onUpdatePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  onCancel: () => void;
}

export const ChangePasswordView: React.FC<ChangePasswordViewProps> = ({
  user,
  onUpdatePassword,
  onCancel,
}) => {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const reqLen = newPwd.length >= 8;
  const reqCase = /[A-Z]/.test(newPwd) && /[a-z]/.test(newPwd);
  const reqNum = /[0-9]/.test(newPwd);
  const reqSpec = /[^A-Za-z0-9]/.test(newPwd);

  const strengthScore =
    newPwd.length === 0
      ? 0
      : [newPwd.length >= 6, reqLen && reqCase, reqNum, reqSpec].filter(Boolean)
          .length;

  const strengthLabel =
    strengthScore === 0
      ? 'Sin ingresar'
      : strengthScore === 1
      ? 'Débil'
      : strengthScore === 2
      ? 'Regular'
      : strengthScore === 3
      ? 'Buena'
      : 'Fuerte';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (user.storageMode === 'firebase') {
      setErrorMsg(
        'Tu cuenta está autenticada con Google. Administra tu contraseña desde la configuración de seguridad de tu Cuenta de Google.'
      );
      return;
    }

    if (!currentPwd) {
      setErrorMsg('Por favor, ingresa tu contraseña actual.');
      return;
    }
    if (newPwd.length < 6) {
      setErrorMsg('La nueva contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setErrorMsg('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdatePassword(currentPwd, newPwd);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No fue posible actualizar la contraseña.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div id="view-change-password" className="px-4 pt-4 pb-8 space-y-4">
      <div className="bg-[#DBEAFE]/50 border border-[#2563EB]/20 rounded-2xl p-3.5 flex items-start gap-2.5">
        <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
        <div className="text-xs text-[#64748B] leading-relaxed">
          <p className="font-bold text-[#1E3A8A]">Protocolo Zero-Knowledge</p>
          <p>
            Mantén tu bóveda de Docucloud protegida con una contraseña única y
            robusta.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contraseña actual */}
        <div className="space-y-1">
          <label
            htmlFor="pwd-current"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Contraseña actual
          </label>
          <div className="relative flex items-center">
            <input
              id="pwd-current"
              type={showCurrent ? 'text' : 'password'}
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
            <button
              type="button"
              aria-label="Mostrar u ocultar contraseña actual"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-1 w-9 h-9 flex items-center justify-center text-[#64748B]"
            >
              {showCurrent ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Nueva contraseña */}
        <div className="space-y-2">
          <label
            htmlFor="pwd-new"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Nueva contraseña
          </label>
          <div className="relative flex items-center">
            <input
              id="pwd-new"
              type={showNew ? 'text' : 'password'}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Ingresa tu nueva contraseña"
              className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
            <button
              type="button"
              aria-label="Mostrar u ocultar nueva contraseña"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-1 w-9 h-9 flex items-center justify-center text-[#64748B]"
            >
              {showNew ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Medidor de seguridad de 4 barras */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748B] font-medium">
                Seguridad calculada
              </span>
              <span className="font-semibold text-[#0F172A]">
                {strengthLabel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 h-1.5">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`rounded-full transition-colors ${
                    strengthScore >= bar
                      ? strengthScore === 1
                        ? 'bg-[#DC2626]'
                        : strengthScore >= 4
                        ? 'bg-[#16A34A]'
                        : 'bg-[#2563EB]'
                      : 'bg-[#E2E8F0]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Lista de verificación de requisitos */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 space-y-2 text-xs">
          <p className="font-semibold text-[#0F172A]">
            Requisitos recomendados
          </p>
          {[
            { met: reqLen, text: 'Al menos 8 caracteres (mínimo 6+)' },
            {
              met: reqCase,
              text: 'Al menos una letra mayúscula y una minúscula',
            },
            { met: reqNum, text: 'Al menos un número (0-9)' },
            {
              met: reqSpec,
              text: 'Al menos un carácter especial (@, #, $)',
            },
          ].map((item) => (
            <div
              key={item.text}
              className={`flex items-center gap-2 ${
                item.met ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'
              }`}
            >
              {item.met ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 shrink-0" />
              )}
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Confirmar nueva contraseña */}
        <div className="space-y-1">
          <label
            htmlFor="pwd-confirm"
            className="block text-xs font-semibold text-[#0F172A]"
          >
            Confirmar nueva contraseña
          </label>
          <div className="relative flex items-center">
            <input
              id="pwd-confirm"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
            <button
              type="button"
              aria-label="Mostrar u ocultar confirmación de contraseña"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-1 w-9 h-9 flex items-center justify-center text-[#64748B]"
            >
              {showConfirm ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Opción de cierre de sesión global */}
        <label className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#0F172A]">
              Cerrar sesión en otros dispositivos
            </p>
            <p className="text-[11px] text-[#64748B]">
              Desconectar otros dispositivos sincronizados tras el cambio
            </p>
          </div>
          <input
            type="checkbox"
            checked={revokeOtherSessions}
            onChange={(e) => setRevokeOtherSessions(e.target.checked)}
            className="w-4 h-4 rounded accent-[#2563EB]"
          />
        </label>

        <div className="space-y-2 pt-1">
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Actualizar contraseña</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-11 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};
