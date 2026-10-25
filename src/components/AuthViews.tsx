import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Edit3,
  X,
} from 'lucide-react';
import {
  AppRoute,
  OFFICIAL_APP_NAME,
  OFFICIAL_SLOGAN,
  OFFICIAL_SUBTITLE,
} from '../types/docucloud';
import { DocucloudLogo } from './FileTypeIcon';

interface AuthViewsProps {
  route: 'login' | 'register' | 'forgot-password' | 'unregistered-account';
  pendingEmail: string;
  onSetPendingEmail: (email: string) => void;
  onNavigate: (route: AppRoute) => void;
  onLoginSubmit: (
    email: string,
    password: string,
    rememberMe: boolean
  ) => Promise<void>;
  onRegisterSubmit: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  route,
  pendingEmail,
  onSetPendingEmail,
  onNavigate,
  onLoginSubmit,
  onRegisterSubmit,
  onGoogleSignIn,
  onNotify,
}) => {
  // Estado de Inicio de Sesión
  const [loginEmail, setLoginEmail] = useState(pendingEmail || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Estado de Registro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState(pendingEmail || '');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirmPwd, setShowRegConfirmPwd] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false); // Desmarcada obligatoriamente

  // Estado de Recuperación de Contraseña
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  // Edición rápida de correo en cuenta no registrada
  const [isEditingPendingEmail, setIsEditingPendingEmail] = useState(false);
  const [editedEmailDraft, setEditedEmailDraft] = useState(pendingEmail);

  // Modal legal en Registro
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(
    null
  );

  const switchRoute = (next: AppRoute) => {
    setFormError('');
    setRecoverySent(false);
    onNavigate(next);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!loginEmail.trim() || !loginPassword) {
      setFormError('Por favor, ingresa tu correo electrónico y contraseña.');
      return;
    }
    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 450));
      await onLoginSubmit(loginEmail, loginPassword, rememberMe);
    } catch (err) {
      if (err instanceof Error && err.name !== 'UnregisteredEmailError') {
        setFormError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemoAccount = () => {
    setLoginEmail('carlos@docucloud.com');
    setLoginPassword('Demo1234!');
    setFormError('');
    onNotify(
      'Credenciales de demostración cargadas. Pulsa Iniciar sesión.',
      'info'
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!regName.trim()) {
      setFormError('Por favor, ingresa tu nombre completo.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setFormError('Por favor, ingresa un correo electrónico válido.');
      return;
    }
    if (regPassword.length < 6) {
      setFormError('La contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setFormError('Las contraseñas no coinciden. Verifica ambos campos.');
      return;
    }
    if (!acceptedTerms) {
      setFormError(
        'Debes aceptar los términos y condiciones y la política de privacidad.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      await onRegisterSubmit(regName, regEmail, regPassword);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No fue posible crear la cuenta.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setFormError('');
    setIsSubmitting(true);
    try {
      await onGoogleSignIn();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'El inicio de sesión con Google fue cancelado.';
      if (!msg.includes('popup-closed-by-user')) {
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setFormError('Por favor, ingresa un correo electrónico válido.');
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 550));
    setIsSubmitting(false);
    setRecoverySent(true);
  };

  // 1. PANTALLA DE INICIO DE SESIÓN (LOGIN)
  if (route === 'login') {
    return (
      <div
        id="view-login"
        className="flex-1 flex flex-col justify-between px-5 py-6 bg-[#F8FAFC]"
      >
        <div className="space-y-6">
          {/* Encabezado con Logo conceptual de Docucloud */}
          <div className="flex flex-col items-center text-center pt-2 space-y-2.5">
            <DocucloudLogo size="lg" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#1E3A8A]">
                {OFFICIAL_APP_NAME}
              </p>
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
                Bienvenido de nuevo
              </h1>
              <p className="text-sm text-[#64748B]">
                Accede a tus documentos de forma segura
              </p>
            </div>
          </div>

          {/* Tarjeta de Formulario */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Correo electrónico */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  Correo electrónico
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-5 h-5 text-[#64748B] absolute left-3.5 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu.correo@ejemplo.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-5 h-5 text-[#64748B] absolute left-3.5 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showLoginPwd ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                  <button
                    type="button"
                    aria-label={
                      showLoginPwd
                        ? 'Ocultar contraseña'
                        : 'Mostrar contraseña'
                    }
                    onClick={() => setShowLoginPwd((v) => !v)}
                    className="absolute right-1.5 w-10 h-10 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#2563EB] transition-colors"
                  >
                    {showLoginPwd ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Recordarme y Olvidaste tu contraseña */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-[#64748B] select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#2563EB]"
                  />
                  <span>Recordarme</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchRoute('forgot-password')}
                  className="text-xs font-semibold text-[#2563EB] hover:underline min-h-[36px] flex items-center"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Botón Principal Iniciar sesión */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar sesión</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative py-1 flex items-center justify-center">
              <div className="w-full border-t border-[#E2E8F0]" />
              <span className="bg-white px-3 text-[11px] text-[#64748B] whitespace-nowrap">
                o acceso en la nube
              </span>
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>

            {/* Acceso con Google Cloud Firestore */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleClick}
              className="w-full h-11 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continuar con Google (Cloud Firestore)</span>
            </button>

            <button
              type="button"
              onClick={handleFillDemoAccount}
              className="w-full h-10 rounded-xl bg-[#DBEAFE]/60 hover:bg-[#DBEAFE] text-[#1E3A8A] font-semibold text-xs transition-colors"
            >
              Autocompletar cuenta demo (carlos@docucloud.com)
            </button>
          </div>
        </div>

        {/* Enlace inferior hacia Registro */}
        <div className="pt-5 space-y-3 text-center">
          <p className="text-sm text-[#64748B]">
            ¿No tienes una cuenta?{' '}
            <button
              type="button"
              onClick={() => switchRoute('register')}
              className="font-semibold text-[#2563EB] hover:underline"
            >
              Crear cuenta
            </button>
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#64748B]">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <span>Bóveda cifrada AES-256 aislada por cuenta</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. PANTALLA DE CUENTA NO REGISTRADA
  if (route === 'unregistered-account') {
    return (
      <div
        id="view-unregistered"
        className="flex-1 flex flex-col justify-between px-5 py-6 bg-[#F8FAFC]"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Volver al inicio de sesión"
              onClick={() => switchRoute('login')}
              className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:bg-slate-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-[#1E3A8A]">Docucloud</span>
            <div className="w-10" />
          </div>

          <div className="flex flex-col items-center text-center space-y-2.5 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shadow-sm">
              <UserPlus className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Esta cuenta aún no está registrada
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed">
              No encontramos ninguna bóveda asociada a este correo en nuestra
              base de datos. Regístrate en segundos para proteger y gestionar
              tus documentos.
            </p>
          </div>

          {/* Correo ingresado */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] text-[#2563EB] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#64748B]">
                    Correo a registrar
                  </p>
                  <p className="text-sm font-semibold text-[#0F172A] truncate">
                    {pendingEmail || 'usuario@ejemplo.com'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditedEmailDraft(pendingEmail);
                  setIsEditingPendingEmail((v) => !v);
                }}
                className="px-3 h-9 rounded-lg bg-[#DBEAFE] text-[#2563EB] text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modificar</span>
              </button>
            </div>

            {isEditingPendingEmail && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={editedEmailDraft}
                  onChange={(e) => setEditedEmailDraft(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  placeholder="Escribe el correo correcto"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editedEmailDraft.trim()) {
                      onSetPendingEmail(editedEmailDraft.trim());
                      setRegEmail(editedEmailDraft.trim());
                      setLoginEmail(editedEmailDraft.trim());
                    }
                    setIsEditingPendingEmail(false);
                  }}
                  className="h-10 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-semibold"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>

          {/* Beneficios */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-[#0F172A]">
              Beneficios incluidos al registrarte:
            </p>
            <ul className="space-y-2 text-xs text-[#64748B]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>
                  <strong className="text-[#0F172A]">10.00 GB</strong> de
                  almacenamiento gratuito cifrado y aislado
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>Privacidad total con protocolo Zero-Knowledge</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>Organización por categorías y búsqueda instantánea</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-2.5 pt-4">
          <button
            type="button"
            onClick={() => {
              setRegEmail(pendingEmail);
              switchRoute('register');
            }}
            className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <span>Crear cuenta con este correo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => switchRoute('login')}
            className="w-full h-11 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors"
          >
            <span>Probar con otro correo</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. PANTALLA DE RECUPERACIÓN DE CONTRASEÑA
  if (route === 'forgot-password') {
    return (
      <div
        id="view-forgot-password"
        className="flex-1 flex flex-col justify-between px-5 py-6 bg-[#F8FAFC]"
      >
        <div className="space-y-6">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Volver al inicio de sesión"
              onClick={() => switchRoute('login')}
              className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] hover:bg-slate-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center text-center space-y-2.5 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shadow-sm">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Recuperar contraseña
            </h1>
            <p className="text-sm text-[#64748B] max-w-xs leading-relaxed">
              Ingresa el correo electrónico asociado a tu cuenta para recibir
              las instrucciones de recuperación.
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]"
              >
                {formError}
              </div>
            )}

            {recoverySent ? (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 space-y-2 text-center">
                <CheckCircle2 className="w-7 h-7 text-[#16A34A] mx-auto" />
                <p className="text-sm font-semibold text-[#0F172A]">
                  Solicitud procesada
                </p>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Si el correo está registrado, recibirás un enlace de
                  recuperación
                </p>
              </div>
            ) : (
              <form onSubmit={handlePasswordRecovery} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="recovery-email"
                    className="block text-xs font-semibold text-[#0F172A]"
                  >
                    Correo electrónico
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-5 h-5 text-[#64748B] absolute left-3.5 pointer-events-none" />
                    <input
                      id="recovery-email"
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="tu.correo@ejemplo.com"
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar instrucciones</span>
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => switchRoute('login')}
              className="w-full h-11 rounded-xl bg-[#F8FAFC] hover:bg-[#E2E8F0]/60 text-[#0F172A] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Regresar al Inicio de sesión</span>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-[#64748B]">
          Protegido bajo protocolo Zero-Knowledge de Docucloud
        </div>
      </div>
    );
  }

  // 4. PANTALLA DE REGISTRO DE USUARIO (CON ESLOGAN OFICIAL OBLIGATORIO)
  const hasMinLen = regPassword.length >= 6;
  const hasUpper = /[A-Z]/.test(regPassword);
  const hasNum = /[0-9]/.test(regPassword);

  return (
    <div
      id="view-register"
      className="flex-1 flex flex-col justify-between px-5 py-6 bg-[#F8FAFC] relative"
    >
      <div className="space-y-5">
        {/* Encabezado con Eslogan Oficial Obligatorio */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <DocucloudLogo size="md" />
          <div className="space-y-1 max-w-[310px]">
            <h1
              className="text-xl font-bold text-[#1E3A8A] tracking-tight leading-snug"
              style={{ textWrap: 'balance' }}
            >
              “{OFFICIAL_SLOGAN}”
            </h1>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {OFFICIAL_SUBTITLE}
            </p>
          </div>
        </div>

        {/* Tarjeta de Registro */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-sm space-y-3.5">
          {formError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Nombre completo */}
            <div className="space-y-1">
              <label
                htmlFor="reg-fullname"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Nombre completo
              </label>
              <div className="relative flex items-center">
                <UserIcon className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-fullname"
                  type="text"
                  required
                  maxLength={100}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Carlos Mendoza"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                />
              </div>
            </div>

            {/* Correo electrónico */}
            <div className="space-y-1">
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Correo electrónico
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-email"
                  type="email"
                  required
                  maxLength={254}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="carlos.mendoza@email.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-password"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-password"
                  type={showRegPwd ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                />
                <button
                  type="button"
                  aria-label={
                    showRegPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  onClick={() => setShowRegPwd((v) => !v)}
                  className="absolute right-1 w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#2563EB]"
                >
                  {showRegPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Indicadores de contraseña */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 ${
                    hasMinLen
                      ? 'text-[#16A34A] font-semibold'
                      : 'text-[#64748B]'
                  }`}
                >
                  {hasMinLen ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  6+ caracteres
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    hasUpper ? 'text-[#16A34A] font-semibold' : 'text-[#64748B]'
                  }`}
                >
                  {hasUpper ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  1 mayúscula
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    hasNum ? 'text-[#16A34A] font-semibold' : 'text-[#64748B]'
                  }`}
                >
                  {hasNum ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  1 número
                </span>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1">
              <label
                htmlFor="reg-confirm-password"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Confirmar contraseña
              </label>
              <div className="relative flex items-center">
                <ShieldCheck className="w-4 h-4 text-[#64748B] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-confirm-password"
                  type={showRegConfirmPwd ? 'text' : 'password'}
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                />
                <button
                  type="button"
                  aria-label={
                    showRegConfirmPwd
                      ? 'Ocultar confirmación de contraseña'
                      : 'Mostrar confirmación de contraseña'
                  }
                  onClick={() => setShowRegConfirmPwd((v) => !v)}
                  className="absolute right-1 w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#2563EB]"
                >
                  {showRegConfirmPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Casilla obligatoria desmarcada por defecto */}
            <label className="flex items-start gap-2.5 pt-1 text-xs text-[#64748B] select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-[#2563EB] shrink-0"
              />
              <span className="leading-snug">
                Acepto los{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLegalModal('terms');
                  }}
                  className="text-[#2563EB] font-semibold hover:underline"
                >
                  términos y condiciones
                </button>{' '}
                y la{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLegalModal('privacy');
                  }}
                  className="text-[#2563EB] font-semibold hover:underline"
                >
                  política de privacidad
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <>
                  <span>Crear cuenta</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGoogleClick}
            className="w-full h-11 rounded-xl bg-[#F8FAFC] hover:bg-[#DBEAFE]/50 border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <span>Registrarse con Google (Bóveda Cloud 10 GB)</span>
          </button>
        </div>
      </div>

      {/* Enlace inferior hacia Inicio de Sesión */}
      <div className="pt-4 text-center">
        <p className="text-sm text-[#64748B]">
          ¿Ya tienes una cuenta?{' '}
          <button
            type="button"
            onClick={() => switchRoute('login')}
            className="font-semibold text-[#2563EB] hover:underline"
          >
            Iniciar sesión
          </button>
        </p>
      </div>

      {/* Modal de vista previa legal */}
      {legalModal && (
        <div className="fixed sm:absolute inset-0 z-40 bg-[#0F172A]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="w-full bg-white rounded-2xl p-5 shadow-2xl space-y-3 max-h-[75%] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">
                {legalModal === 'terms'
                  ? 'Términos y condiciones'
                  : 'Política de privacidad'}
              </h2>
              <button
                type="button"
                aria-label="Cerrar diálogo legal"
                onClick={() => setLegalModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#64748B] leading-relaxed overflow-y-auto space-y-2 pr-1">
              {legalModal === 'terms' ? (
                <>
                  <p>
                    Bienvenido a Docucloud. Cada cuenta registrada recibe una
                    bóveda personal aislada con una cuota estricta de 10.00 GB
                    (10,737,418,240 bytes) de almacenamiento.
                  </p>
                  <p>
                    Conservas la titularidad exclusiva de todos los archivos y
                    metadatos cargados. Las subidas que superen tu cuota
                    disponible se bloquean automáticamente para preservar la
                    integridad de tu cuenta.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Docucloud aísla los documentos y métricas de almacenamiento
                    estrictamente por el identificador único de cada usuario.
                    Tus archivos jamás se mezclan con los de otra cuenta.
                  </p>
                  <p>
                    Todas las consultas validan la identidad del propietario y
                    aplican transmisión segura cifrada.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setAcceptedTerms(true);
                setLegalModal(null);
              }}
              className="w-full h-11 rounded-xl bg-[#2563EB] text-white font-semibold text-xs"
            >
              Aceptar y cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
