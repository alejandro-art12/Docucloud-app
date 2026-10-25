import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from './lib/firebase';
import {
  AppRoute,
  DocumentCategory,
  DocucloudDocument,
  DocucloudUser,
  FileFilterOption,
  ProfileUpdatePayload,
  SortOption,
  ToastMessage,
} from './types/docucloud';
import {
  changeLocalPassword,
  deleteVaultDocument,
  ensureDemoSeedInLocalStorage,
  ensureFirestoreUserRecord,
  getSavedLocalSessionUser,
  loadLocalDocsForUserFromIndexedDB,
  loginLocalAccount,
  registerLocalAccount,
  renameOrMoveVaultDocument,
  seedSampleFilesForCurrentUser,
  signInWithGoogleVault,
  signOutVault,
  subscribeToFirestoreVault,
  toggleStarVaultDocument,
  UnregisteredEmailError,
  UploadDocumentInput,
  uploadVaultDocument,
  updateVaultUserProfile,
} from './services/vaultService';
import {
  downloadVaultDocument,
  VIEWER_LOAD_ERROR_MESSAGE,
} from './services/fileBlobService';
import {
  readUiPreferences,
  syncSessionSnapshotInLocalStorage,
  updateUiPreferences,
} from './services/uiPreferencesService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import { AuthViews } from './components/AuthViews';
import { DashboardView } from './components/DashboardView';
import { DocumentsView } from './components/DocumentsView';
import { CategoriesView } from './components/CategoriesView';
import { UploadView } from './components/UploadView';
import { DocumentDetailsView } from './components/DocumentDetailsView';
import {
  ContextMenuSheet,
  DeleteDocumentModal,
  RenameDocumentModal,
} from './components/DocumentModals';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import {
  ChangePasswordView,
  EditProfileView,
  ProfileMainView,
} from './components/ProfileViews';

const PUBLIC_ROUTES: AppRoute[] = [
  'login',
  'register',
  'forgot-password',
  'unregistered-account',
];

function parseRouteFromHash(hash: string): AppRoute | null {
  switch (hash) {
    case '#view-login':
      return 'login';
    case '#view-register':
      return 'register';
    case '#view-forgot-password':
      return 'forgot-password';
    case '#view-unregistered':
      return 'unregistered-account';
    case '#view-dashboard':
      return 'dashboard';
    case '#view-documents':
      return 'documents';
    case '#view-categories':
      return 'categories';
    case '#view-upload':
      return 'upload';
    case '#view-details':
      return 'details';
    case '#view-search':
      return 'search';
    case '#view-profile':
      return 'profile';
    case '#view-edit-profile':
      return 'edit-profile';
    case '#view-change-password':
      return 'change-password';
    default:
      return null;
  }
}

function getHashForRoute(route: AppRoute): string {
  switch (route) {
    case 'login':
      return '#view-login';
    case 'register':
      return '#view-register';
    case 'forgot-password':
      return '#view-forgot-password';
    case 'unregistered-account':
      return '#view-unregistered';
    case 'dashboard':
      return '#view-dashboard';
    case 'documents':
      return '#view-documents';
    case 'categories':
      return '#view-categories';
    case 'upload':
      return '#view-upload';
    case 'details':
      return '#view-details';
    case 'search':
      return '#view-search';
    case 'profile':
      return '#view-profile';
    case 'edit-profile':
      return '#view-edit-profile';
    case 'change-password':
      return '#view-change-password';
  }
}

function DocucloudInnerApp() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<DocucloudUser | null>(null);
  const [documents, setDocuments] = useState<DocucloudDocument[]>([]);
  const [route, setRoute] = useState<AppRoute>('login');

  // Unregistered email flow state
  const [pendingEmail, setPendingEmail] = useState('');

  // Filtering, search & selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    DocumentCategory | 'All'
  >('All');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [fileFilter, setFileFilter] = useState<FileFilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>(
    () => readUiPreferences().sortBy
  );

  const handleSortByChange = useCallback((nextSort: SortOption) => {
    setSortBy(nextSort);
    updateUiPreferences({ sortBy: nextSort });
  }, []);

  // Selected document & modals
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<DocucloudDocument | null>(null);
  const [contextMenuDoc, setContextMenuDoc] =
    useState<DocucloudDocument | null>(null);
  const [renameModalDoc, setRenameModalDoc] =
    useState<DocucloudDocument | null>(null);
  const [deleteModalDoc, setDeleteModalDoc] =
    useState<DocucloudDocument | null>(null);

  const [isSeedingSamples, setIsSeedingSamples] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const currentUserRef = React.useRef<DocucloudUser | null>(null);
  currentUserRef.current = currentUser;

  // Strict Route Guard Navigation Helper
  const navigateTo = useCallback(
    (targetRoute: AppRoute, activeUserOverride?: DocucloudUser | null) => {
      const effectiveUser =
        activeUserOverride !== undefined
          ? activeUserOverride
          : currentUserRef.current;
      const isTargetPublic = PUBLIC_ROUTES.includes(targetRoute);

      let resolvedRoute = targetRoute;
      if (!effectiveUser && !isTargetPublic) {
        resolvedRoute = 'login';
      } else if (effectiveUser && isTargetPublic) {
        resolvedRoute = 'dashboard';
      }

      setRoute(resolvedRoute);
      const nextHash = getHashForRoute(resolvedRoute);
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    },
    []
  );

  // Boot & Firebase / Local Session Synchronization
  useEffect(() => {
    ensureDemoSeedInLocalStorage();

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser && fbUser.emailVerified) {
          const cloudUser = await ensureFirestoreUserRecord(fbUser);
          setCurrentUser(cloudUser);
          syncSessionSnapshotInLocalStorage(cloudUser);
          setAuthReady(true);
          const requested = parseRouteFromHash(window.location.hash);
          if (!requested || PUBLIC_ROUTES.includes(requested)) {
            navigateTo('dashboard', cloudUser);
          } else {
            navigateTo(requested, cloudUser);
          }
          return;
        }

        // Check isolated LocalStorage session metadata & load documents from Docucloud_DB -> documents_store
        const localUser = getSavedLocalSessionUser();
        if (localUser) {
          const { docs, syncedUser } =
            await loadLocalDocsForUserFromIndexedDB(localUser);
          setCurrentUser(syncedUser);
          syncSessionSnapshotInLocalStorage(syncedUser);
          setDocuments(docs);
          setAuthReady(true);
          const requested = parseRouteFromHash(window.location.hash);
          if (!requested || PUBLIC_ROUTES.includes(requested)) {
            navigateTo('dashboard', syncedUser);
          } else {
            navigateTo(requested, syncedUser);
          }
          return;
        }

        syncSessionSnapshotInLocalStorage(null);

        setCurrentUser(null);
        setDocuments([]);
        setAuthReady(true);
        const requested = parseRouteFromHash(window.location.hash);
        if (requested && PUBLIC_ROUTES.includes(requested)) {
          navigateTo(requested, null);
        } else {
          navigateTo('login', null);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        setAuthReady(true);
        navigateTo('login', null);
      }
    });

    return () => unsubAuth();
  }, [navigateTo]);

  // Attach real-time Firestore listeners ONLY when authenticated in Firebase mode
  useEffect(() => {
    if (!authReady || !currentUser || currentUser.storageMode !== 'firebase') {
      return;
    }

    const unsubscribe = subscribeToFirestoreVault(
      currentUser.uid,
      (updatedUser) => {
        setCurrentUser(updatedUser);
        syncSessionSnapshotInLocalStorage(updatedUser);
      },
      (updatedDocs) => setDocuments(updatedDocs)
    );

    return () => unsubscribe();
  }, [authReady, currentUser?.uid, currentUser?.storageMode]);

  // Listen to browser hash navigation and enforce Route Guards
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRouteFromHash(window.location.hash);
      if (!parsed) return;
      navigateTo(parsed);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [navigateTo]);

  // Enforce Route Guard whenever currentUser changes
  useEffect(() => {
    if (!authReady) return;
    const isCurrentPublic = PUBLIC_ROUTES.includes(route);
    if (!currentUser && !isCurrentPublic) {
      navigateTo('login', null);
    } else if (currentUser && isCurrentPublic) {
      navigateTo('dashboard', currentUser);
    }
  }, [authReady, currentUser, route, navigateTo]);

  // AUTH HANDLERS
  const handleLoginSubmit = async (
    email: string,
    password: string,
    rememberMe: boolean
  ) => {
    try {
      const loggedUser = loginLocalAccount(email, password, rememberMe);
      const { docs, syncedUser } =
        await loadLocalDocsForUserFromIndexedDB(loggedUser);
      setCurrentUser(syncedUser);
      syncSessionSnapshotInLocalStorage(syncedUser);
      setDocuments(docs);
      addToast(
        `¡Bienvenido de nuevo, ${syncedUser.fullName.split(' ')[0]}!`,
        'success'
      );
      navigateTo('dashboard', syncedUser);
    } catch (err) {
      if (err instanceof UnregisteredEmailError) {
        setPendingEmail(err.email);
        navigateTo('unregistered-account', null);
      }
      throw err;
    }
  };

  const handleRegisterSubmit = async (
    fullName: string,
    email: string,
    password: string
  ) => {
    const createdUser = registerLocalAccount(fullName, email, password);
    setCurrentUser(createdUser);
    syncSessionSnapshotInLocalStorage(createdUser);
    setDocuments([]);
    addToast('¡Cuenta creada con éxito!', 'success');
    navigateTo('dashboard', createdUser);
  };

  const handleGoogleSignIn = async () => {
    const cloudUser = await signInWithGoogleVault();
    setCurrentUser(cloudUser);
    syncSessionSnapshotInLocalStorage(cloudUser);
    addToast('Sesión iniciada de forma segura con Cloud Firestore', 'success');
    navigateTo('dashboard', cloudUser);
  };

  const handleConfirmLogout = async () => {
    await signOutVault(currentUser);
    setCurrentUser(null);
    setDocuments([]);
    setSelectedDocId(null);
    setViewerDoc(null);
    setContextMenuDoc(null);
    setRenameModalDoc(null);
    setDeleteModalDoc(null);
    setSearchQuery('');
    setSelectedCategory('All');
    setOnlyStarred(false);
    setFileFilter('all');
    addToast('Sesión cerrada', 'info');
    navigateTo('login', null);
  };

  // DOCUMENT CRUD HANDLERS
  const handleUploadConfirm = async (input: UploadDocumentInput) => {
    if (!currentUser) return;
    const { updatedUser, createdDoc } = await uploadVaultDocument(
      currentUser,
      input
    );
    if (currentUser.storageMode === 'local') {
      setCurrentUser(updatedUser);
      syncSessionSnapshotInLocalStorage(updatedUser);
      setDocuments((prev) => [createdDoc, ...prev]);
    }
    addToast('Documento subido con éxito', 'success');
    navigateTo('documents', updatedUser);
  };

  const handleRenameConfirm = async (
    docId: string,
    newFullName: string,
    newCategory: DocumentCategory
  ) => {
    if (!currentUser) return;
    const updatedItem = await renameOrMoveVaultDocument(
      currentUser,
      docId,
      newFullName,
      newCategory
    );
    if (currentUser.storageMode === 'local' && updatedItem) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? updatedItem : d))
      );
    }
    addToast('Documento renombrado', 'success');
  };

  const handleDeleteConfirm = async (targetDoc: DocucloudDocument) => {
    if (!currentUser) return;
    const updatedUser = await deleteVaultDocument(currentUser, targetDoc);
    if (currentUser.storageMode === 'local') {
      setCurrentUser(updatedUser);
      syncSessionSnapshotInLocalStorage(updatedUser);
      setDocuments((prev) => prev.filter((d) => d.id !== targetDoc.id));
    }
    if (viewerDoc?.id === targetDoc.id) {
      setViewerDoc(null);
    }
    if (selectedDocId === targetDoc.id && route === 'details') {
      setSelectedDocId(null);
      navigateTo('documents', updatedUser);
    }
    addToast('Archivo eliminado', 'success');
  };

  const handleToggleStar = async (targetDoc: DocucloudDocument) => {
    if (!currentUser) return;
    const nextStarred = !targetDoc.starred;
    const updatedItem = await toggleStarVaultDocument(
      currentUser,
      targetDoc.id,
      nextStarred
    );
    if (currentUser.storageMode === 'local' && updatedItem) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === targetDoc.id ? updatedItem : d))
      );
    }
    addToast(
      nextStarred ? 'Añadido a favoritos' : 'Eliminado de favoritos',
      'info'
    );
  };

  const handleDownloadDocument = useCallback(
    async (targetDoc: DocucloudDocument) => {
      if (!currentUser) return;
      try {
        await downloadVaultDocument(currentUser, targetDoc);
        addToast(`Descargando ${targetDoc.name}`, 'success');
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : VIEWER_LOAD_ERROR_MESSAGE,
          'error'
        );
      }
    },
    [currentUser, addToast]
  );

  const handleSeedSampleDocs = async () => {
    if (!currentUser) return;
    setIsSeedingSamples(true);
    try {
      const updatedUser = await seedSampleFilesForCurrentUser(currentUser);
      if (currentUser.storageMode === 'local') {
        const { docs, syncedUser } =
          await loadLocalDocsForUserFromIndexedDB(updatedUser);
        setCurrentUser(syncedUser);
        syncSessionSnapshotInLocalStorage(syncedUser);
        setDocuments(docs);
      }
      addToast('Documentos de ejemplo añadidos a tu bóveda', 'success');
    } catch (err) {
      addToast(
        err instanceof Error
          ? err.message
          : 'No se pudieron agregar los documentos de ejemplo',
        'error'
      );
    } finally {
      setIsSeedingSamples(false);
    }
  };

  // MANEJADORES DE PERFIL
  const handleSaveProfile = async (payload: ProfileUpdatePayload) => {
    if (!currentUser) return;
    const updatedUser = await updateVaultUserProfile(currentUser, payload);
    setCurrentUser(updatedUser);
    syncSessionSnapshotInLocalStorage(updatedUser);
    addToast('Perfil actualizado con éxito', 'success');
    navigateTo('profile', updatedUser);
  };

  const handleUpdatePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (!currentUser) return;
    changeLocalPassword(currentUser.uid, currentPassword, newPassword);
    addToast('Contraseña actualizada con éxito', 'success');
    navigateTo('profile', currentUser);
  };

  const activeDetailsDoc =
    documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  if (!authReady) {
    return (
      <div className="min-h-dvh w-full bg-[#E2E8F0] flex items-center justify-center">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl px-6 py-5 shadow-md flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
          <span className="text-sm font-semibold text-[#0F172A]">
            Desbloqueando bóveda de Docucloud...
          </span>
        </div>
      </div>
    );
  }

  const stackTitle =
    route === 'edit-profile'
      ? 'Editar perfil'
      : route === 'change-password'
      ? 'Cambiar contraseña'
      : undefined;

  return (
    <AppShell
      route={route}
      currentUser={currentUser}
      recentDocs={[...documents].sort((a, b) => b.updatedAt - a.updatedAt)}
      toasts={toasts}
      onDismissToast={dismissToast}
      onNavigate={(next) => {
        if (next === 'documents') {
          // Keep filters clean when tapping bottom tab directly if in search
          if (route === 'search') setSearchQuery('');
        }
        navigateTo(next);
      }}
      onBack={() => navigateTo('profile')}
      stackTitle={stackTitle}
      overlayModals={
        <>
          <ContextMenuSheet
            document={contextMenuDoc}
            onClose={() => setContextMenuDoc(null)}
            onOpenViewer={(doc) => setViewerDoc(doc)}
            onDownload={handleDownloadDocument}
            onOpenDetails={(doc) => {
              setSelectedDocId(doc.id);
              navigateTo('details');
            }}
            onRename={(doc) => setRenameModalDoc(doc)}
            onDelete={(doc) => setDeleteModalDoc(doc)}
            onShare={async (doc) => {
              const url = `${window.location.origin}/#doc=${encodeURIComponent(
                doc.id
              )}`;
              try {
                await navigator.clipboard.writeText(url);
                addToast('Enlace cifrado copiado al portapapeles', 'success');
              } catch {
                addToast('Enlace seguro listo para compartir', 'info');
              }
            }}
          />
          <RenameDocumentModal
            document={renameModalDoc}
            onClose={() => setRenameModalDoc(null)}
            onConfirmRename={handleRenameConfirm}
          />
          <DeleteDocumentModal
            document={deleteModalDoc}
            onClose={() => setDeleteModalDoc(null)}
            onConfirmDelete={handleDeleteConfirm}
          />
          {currentUser && (
            <DocumentViewerModal
              user={currentUser}
              document={viewerDoc}
              onClose={() => setViewerDoc(null)}
              onNotify={addToast}
            />
          )}
        </>
      }
    >
      {/* PUBLIC ROUTES */}
      {(!currentUser || PUBLIC_ROUTES.includes(route)) && (
        <AuthViews
          route={
            PUBLIC_ROUTES.includes(route)
              ? (route as
                  | 'login'
                  | 'register'
                  | 'forgot-password'
                  | 'unregistered-account')
              : 'login'
          }
          pendingEmail={pendingEmail}
          onSetPendingEmail={setPendingEmail}
          onNavigate={navigateTo}
          onLoginSubmit={handleLoginSubmit}
          onRegisterSubmit={handleRegisterSubmit}
          onGoogleSignIn={handleGoogleSignIn}
          onNotify={addToast}
        />
      )}

      {/* PRIVATE ROUTES (STRICTLY GUARDED) */}
      {currentUser && route === 'dashboard' && (
        <DashboardView
          user={currentUser}
          documents={documents}
          onNavigate={navigateTo}
          onStartSearch={(q) => {
            setSearchQuery(q);
            navigateTo('search');
          }}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setOnlyStarred(false);
            setFileFilter('all');
            navigateTo('documents');
          }}
          onOpenViewer={(doc) => setViewerDoc(doc)}
          onDownloadDocument={handleDownloadDocument}
          onOpenDocumentDetails={(doc) => {
            setSelectedDocId(doc.id);
            navigateTo('details');
          }}
          onOpenContextMenu={(doc) => setContextMenuDoc(doc)}
          onSeedSampleDocs={handleSeedSampleDocs}
          isSeedingSamples={isSeedingSamples}
        />
      )}

      {currentUser && (route === 'documents' || route === 'search') && (
        <DocumentsView
          mode={route === 'search' ? 'search' : 'documents'}
          user={currentUser}
          documents={documents}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onlyStarred={onlyStarred}
          onToggleOnlyStarred={setOnlyStarred}
          fileFilter={fileFilter}
          onFileFilterChange={setFileFilter}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          onNavigate={navigateTo}
          onOpenViewer={(doc) => setViewerDoc(doc)}
          onDownloadDocument={handleDownloadDocument}
          onOpenDocumentDetails={(doc) => {
            setSelectedDocId(doc.id);
            navigateTo('details');
          }}
          onOpenContextMenu={(doc) => setContextMenuDoc(doc)}
        />
      )}

      {currentUser && route === 'categories' && (
        <CategoriesView
          documents={documents}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setOnlyStarred(false);
            setFileFilter('all');
            setSearchQuery('');
            navigateTo('documents');
          }}
          onQuickFilterRecent={() => {
            setSelectedCategory('All');
            setOnlyStarred(false);
            setFileFilter('all');
            handleSortByChange('date');
            navigateTo('documents');
          }}
          onQuickFilterStarred={() => {
            setSelectedCategory('All');
            setOnlyStarred(true);
            setFileFilter('all');
            navigateTo('documents');
          }}
          onQuickFilterPdf={() => {
            setSelectedCategory('All');
            setOnlyStarred(false);
            setFileFilter('pdf');
            navigateTo('documents');
          }}
          onNavigate={navigateTo}
        />
      )}

      {currentUser && route === 'upload' && (
        <UploadView
          user={currentUser}
          onUploadConfirm={handleUploadConfirm}
          onNavigate={navigateTo}
          onNotify={addToast}
        />
      )}

      {currentUser && route === 'details' && activeDetailsDoc && (
        <DocumentDetailsView
          user={currentUser}
          document={activeDetailsDoc}
          onNavigate={navigateTo}
          onOpenViewer={(doc) => setViewerDoc(doc)}
          onDownloadDocument={handleDownloadDocument}
          onToggleStar={handleToggleStar}
          onOpenRenameModal={(doc) => setRenameModalDoc(doc)}
          onOpenDeleteModal={(doc) => setDeleteModalDoc(doc)}
          onNotify={addToast}
        />
      )}

      {currentUser && route === 'details' && !activeDetailsDoc && (
        <DocumentsView
          mode="documents"
          user={currentUser}
          documents={documents}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onlyStarred={onlyStarred}
          onToggleOnlyStarred={setOnlyStarred}
          fileFilter={fileFilter}
          onFileFilterChange={setFileFilter}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          onNavigate={navigateTo}
          onOpenViewer={(doc) => setViewerDoc(doc)}
          onDownloadDocument={handleDownloadDocument}
          onOpenDocumentDetails={(doc) => {
            setSelectedDocId(doc.id);
            navigateTo('details');
          }}
          onOpenContextMenu={(doc) => setContextMenuDoc(doc)}
        />
      )}

      {currentUser && route === 'profile' && (
        <ProfileMainView
          user={currentUser}
          documentCount={documents.length}
          onNavigate={navigateTo}
          onConfirmLogout={handleConfirmLogout}
          onSeedSampleDocs={handleSeedSampleDocs}
          isSeedingSamples={isSeedingSamples}
        />
      )}

      {currentUser && route === 'edit-profile' && (
        <EditProfileView
          user={currentUser}
          onSaveProfile={handleSaveProfile}
          onCancel={() => navigateTo('profile')}
        />
      )}

      {currentUser && route === 'change-password' && (
        <ChangePasswordView
          user={currentUser}
          onUpdatePassword={handleUpdatePassword}
          onCancel={() => navigateTo('profile')}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DocucloudInnerApp />
    </ErrorBoundary>
  );
}
