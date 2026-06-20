/**
 * client/src/App.jsx
 *
 * Root application component.
 * - Redux Provider + PersistGate
 * - NyayaThemeProvider (MUI + CSS vars)
 * - React Router v6 with AnimatePresence page transitions
 * - Auth bootstrap (getMe on load)
 * - Global Snackbar toasts
 * - RTL for Urdu
 * - Service Worker registration
 */

import React, { useEffect, Suspense, lazy } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import store, { persistor } from "./store/store";
import { TYPOGRAPHY } from "./theme/tokens";
import NyayaThemeProvider from "./theme/ThemeProvider";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import AnimatedPage from "./components/ui/AnimatedPage";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import NyayaBotWidget from "./components/nyayabot/NyayaBotWidget";
import ScrollProgressBar from "./components/ui/ScrollProgressBar";
import ErrorBoundaryWithDispatch from "./components/ui/ErrorBoundary";
import { ErrorNotificationSnackbar } from "./hooks/useErrorHandling";
import socketService from "./services/socket";
import {
  receiveMessage,
  incrementUnread,
} from "./store/slices/consultationChatSlice";
import { pushRealtimeNotification } from "./store/slices/notificationSlice";

import {
  selectIsAuthenticated,
  selectUserPersona,
  selectAuthLoading,
  getMe,
  forceLogout,
} from "./store/slices/authSlice";
import {
  selectSnackbars,
  dismissSnackbar,
  selectLanguage,
} from "./store/slices/uiSlice";

// ─── Lazy-loaded pages ─────────────────────────────────────────────────────────
// Auth
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));

// Citizen
const CitizenHome = lazy(() => import("./pages/citizen/CitizenHome"));
const NewDocument = lazy(() => import("./pages/citizen/NewDocument"));
const ChatFlow = lazy(() => import("./pages/citizen/ChatFlow"));
const DocumentPreview = lazy(() => import("./pages/citizen/DocumentPreview"));
const MyDocuments = lazy(() => import("./pages/citizen/MyDocuments"));
const CaseDashboard = lazy(() => import("./pages/citizen/CaseDashboard"));
const LawyerProfile = lazy(() => import("./pages/citizen/LawyerProfile"));

// Lawyer
const LawyerHome = lazy(() => import("./pages/lawyer/LawyerHome"));
const LawyerDashboard = lazy(() => import("./pages/lawyer/LawyerDashboard"));
const ClientList = lazy(() => import("./pages/lawyer/ClientList"));
const ClientDetail = lazy(() => import("./pages/lawyer/ClientDetail"));
const CaseManagement = lazy(() => import("./pages/lawyer/CaseManagement"));
const EarningsPanel = lazy(() => import("./pages/lawyer/EarningsPanel"));

// Shared
const Pricing = lazy(() => import("./pages/shared/Pricing"));
const Settings = lazy(() => import("./pages/shared/Settings"));
const SharedDocumentView = lazy(() => import("./pages/shared/SharedDocumentView"));
const CalendarPage = lazy(() => import("./pages/shared/CalendarPage"));

// Layout 
const ThemeSwitcher = lazy(() => import("./components/layout/ThemeSwitcher"));
const LawyerSearch = lazy(() => import("./components/lawyer/LawyerSearch"));
const ConsultationsPage = lazy(() => import("./pages/lawyer/ConsultationsPage"));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers     = lazy(() => import('./pages/admin/AdminUsers'));
const AdminLawyers   = lazy(() => import('./pages/admin/AdminLawyers'));
const AdminTemplates = lazy(() => import('./pages/admin/AdminTemplates'));
const AdminAuditLog  = lazy(() => import('./pages/admin/AdminAuditLog'));
const LawSearch           = lazy(() => import('./pages/shared/LawSearch'));
const EmergencyHelpline   = lazy(() => import('./pages/citizen/EmergencyHelpline'));
const LandingPage         = lazy(() => import('./pages/public/LandingPage'));

// Notary
const NotaryHome            = lazy(() => import('./pages/notary/NotaryHome'));
const NotaryDashboard       = lazy(() => import('./pages/notary/NotaryDashboard'));
const NotarizationRequests  = lazy(() => import('./pages/notary/NotarizationRequests'));

// ─── Page loading fallback ────────────────────────────────────────────────────

function PageLoader() {
  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress sx={{ color: "var(--color-primary)" }} size={40} />
    </Box>
  );
}

// ─── Root redirect ─────────────────────────────────────────────────────────────

function RootRedirect() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona)?.toLowerCase();
  const loading = useSelector(selectAuthLoading);
  const hasLiveToken = !!localStorage.getItem('nyayasetu_token');

  if (loading && hasLiveToken) return <PageLoader />;
  if (!isAuthenticated || !hasLiveToken) return <Navigate to="/login" replace />;
  const home = persona === 'admin' ? '/admin/dashboard' : `/${persona}/home`;
  return <Navigate to={home} replace />;
}

// ─── /settings redirect ───────────────────────────────────────────────────────

function SettingsRedirect() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona);
  const loading = useSelector(selectAuthLoading);
  const hasLiveToken = !!localStorage.getItem('nyayasetu_token');

  if (loading && hasLiveToken) return <PageLoader />;
  if (!isAuthenticated || !hasLiveToken) {
    const returnUrl = encodeURIComponent('/settings');
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }
  return <Navigate to={`/${persona}/settings`} replace />;
}

// ─── Main app layout (Navbar + Sidebar + Content + BottomNav) ─────────────────

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const location = useLocation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      <ScrollProgressBar />
      <Navbar />

      <Box sx={{ display: "flex", flex: 1 }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: "hidden",
            transition: "margin-left 0.25s ease",
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <React.Fragment key={location.pathname}>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </React.Fragment>
          </AnimatePresence>
        </Box>
      </Box>

      <BottomNav />
      <NyayaBotWidget /> 
      {/* <Suspense fallback={null}>
        <ThemeSwitcher />
      </Suspense> */}
    </Box>
  );
}

// ─── 404 page ─────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <AnimatedPage>
      <Box sx={{ textAlign: "center", py: 10 }}>
        <Box sx={{ fontSize: 64, mb: 2 }}>⚖️</Box>
        <Box
          sx={{
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--color-text)",
            mb: 1,
          }}
        >
          404 — Page Not Found
        </Box>
        <Box sx={{ color: "var(--color-text-secondary)", mb: 3 }}>
          The page you're looking for doesn't exist.
        </Box>
        <a href="/" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
          ← Go Home
        </a>
      </Box>
    </AnimatedPage>
  );
}

// ─── Router definition ────────────────────────────────────────────────────────

const router = createBrowserRouter([
  // Public landing page — shown to everyone
  {
    path: "/",
    element: (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    ),
  },

  // /app — dashboard redirect for authenticated users (for bookmarks / deep links)
  { path: "/app", element: <RootRedirect /> },

  // /settings → /<persona>/settings (handles bookmarks and direct URL access)
  { path: "/settings", element: <SettingsRedirect /> },

  // Auth pages — no layout
  {
    path: "/login",
    element: (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/register",
    element: (
      <Suspense fallback={<PageLoader />}>
        <Register />
      </Suspense>
    ),
  },

  // Public pages
  {
    path: "/pricing",
    element: (
      <Suspense fallback={<PageLoader />}>
        <Pricing />
      </Suspense>
    ),
  },
  // Shared document link (no auth)
  {
    path: "/shared/:shareToken",
    element: (
      <Suspense fallback={<PageLoader />}>
        <SharedDocumentView />
      </Suspense>
    ),
  },

  // ── Citizen routes ─────────────────────────────────────────────────────────
  {
    path: "/citizen",
    element: (
      <ProtectedRoute allowedPersonas={["citizen"]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/citizen/home" replace /> },
      { path: "home", element: <CitizenHome /> },
      { path: "documents", element: <MyDocuments /> },
      { path: "documents/new", element: <NewDocument /> },
      { path: "chat/:templateSlug", element: <ChatFlow /> },
      { path: "documents/:documentId", element: <DocumentPreview /> },
      { path: "cases", element: <CaseDashboard /> },
      {
        path: "lawyers",
        element: (
          <Suspense fallback={<PageLoader />}>
            <LawyerSearch />
          </Suspense>
        ),
      },
      { path: "lawyers/:lawyerId", element: <LawyerProfile /> },
      { path: "profile", element: <Navigate to="/citizen/settings" replace /> },
      { path: "settings", element: <Settings /> },
      { path: "helpline", element: <EmergencyHelpline /> },
      { path: "calendar", element: <CalendarPage /> },
    ],
  },

  // ── Lawyer routes ──────────────────────────────────────────────────────────
  {
    path: "/lawyer",
    element: (
      <ProtectedRoute allowedPersonas={["lawyer", "paralegal"]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/lawyer/home" replace /> },
      { path: "home", element: <LawyerHome /> },
      { path: "profile", element: <LawyerDashboard /> },
      { path: "clients", element: <ClientList /> },
      { path: "clients/:userId", element: <ClientDetail /> },
      { path: "cases", element: <CaseManagement /> },
      {
        path: "consultations",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ConsultationsPage />
          </Suspense>
        ),
      },
      { path: "earnings", element: <EarningsPanel /> },
      { path: "settings", element: <Settings /> },
      { path: "calendar", element: <CalendarPage /> },
    ],
  },

  // ── Admin routes ───────────────────────────────────────────────────────────
  {
    path: "/admin",
    element: (
      <ProtectedRoute allowedPersonas={["admin"]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminDashboard />
          </Suspense>
        ),
      },
      {
        path: "users",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminUsers />
          </Suspense>
        ),
      },
      {
        path: "lawyers",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminLawyers />
          </Suspense>
        ),
      },
      {
        path: "templates",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminTemplates />
          </Suspense>
        ),
      },
      {
        path: "audit-logs",
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminAuditLog />
          </Suspense>
        ),
      },
    ],
  },

  // ── Notary routes ──────────────────────────────────────────────────────────
  {
    path: "/notary",
    element: (
      <ProtectedRoute allowedPersonas={["notary"]}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/notary/home" replace /> },
      {
        path: "home",
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotaryHome />
          </Suspense>
        ),
      },
      {
        path: "requests",
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotarizationRequests />
          </Suspense>
        ),
      },
      {
        path: "profile",
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotaryDashboard />
          </Suspense>
        ),
      },
      { path: "settings", element: <Settings /> },
      { path: "calendar", element: <CalendarPage /> },
    ],
  },

  // Law search — shared across all personas
  {
    path: '/laws/search',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <LawSearch />
          </Suspense>
        ),
      },
    ],
  },

  // 404
  { path: "*", element: <NotFound /> },
]);

// Stub admin pages (replace with real implementations)
// ─── Global Snackbar ──────────────────────────────────────────────────────────

function GlobalSnackbars() {
  const dispatch = useDispatch();
  const snackbars = useSelector(selectSnackbars);
  const active = snackbars[0] || null;

  return (
    <Snackbar
      open={!!active}
      autoHideDuration={active?.duration || 4000}
      onClose={() => active && dispatch(dismissSnackbar(active.id))}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ mb: { xs: 8, md: 2 } }}
    >
      {active ? (
        <Alert
          severity={active.severity || "info"}
          onClose={() => dispatch(dismissSnackbar(active.id))}
          sx={{
            borderRadius: '14px',
            background: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderLeft: `4px solid ${{
              error: 'var(--color-error)',
              success: 'var(--color-success)',
              warning: 'var(--color-secondary)',
            }[active.severity] || 'var(--color-primary)'}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          }}
        >
          {active.message}
        </Alert>
      ) : (
        <div />
      )}
    </Snackbar>
  );
}

// ─── Auth bootstrap + startup effects ────────────────────────────────────────

function AppBootstrap() {
  const dispatch = useDispatch();
  const language = useSelector(selectLanguage);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Fetch user profile on load if token exists; otherwise purge any stale
  // redux-persist rehydration so protected routes immediately redirect to login.
  useEffect(() => {
    const token = localStorage.getItem("nyayasetu_token");
    if (token) {
      dispatch(getMe());
    } else {
      dispatch(forceLogout());
      localStorage.removeItem('nyayasetu_auth');
    }
  }, [dispatch]);

  // Connect / disconnect socket based on auth state
  useEffect(() => {
    const token = localStorage.getItem("nyayasetu_token");
    if (isAuthenticated && token) {
      socketService.connect(token);

      // Forward consultation messages to Redux
      const handleMessage = (msg) => {
        if (msg?.consultation) {
          dispatch(receiveMessage({ consultationId: msg.consultation, message: msg }));
        }
      };
      const handleNewMessage = ({ consultationId }) => {
        dispatch(incrementUnread({ consultationId }));
      };

      const handleNotification = (notification) => {
        dispatch(pushRealtimeNotification(notification));
      };

      socketService.on("consultation:message", handleMessage);
      socketService.on("consultation:new_message", handleNewMessage);
      socketService.on("notification", handleNotification);

      return () => {
        socketService.off("consultation:message", handleMessage);
        socketService.off("consultation:new_message", handleNewMessage);
        socketService.off("notification", handleNotification);
        socketService.disconnect();
      };
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, dispatch]);

  // Set document direction for RTL languages
  useEffect(() => {
    const RTL = ["ur", "ar"];
    document.documentElement.dir = RTL.includes(language) ? "rtl" : "ltr";
    document.documentElement.lang = language || "en";
  }, [language]);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.info("[SW] Registered:", reg.scope))
        .catch((err) => console.warn("[SW] Registration failed:", err));
    }

    // Signal to index.html loader that React is ready
    window.dispatchEvent(new Event("nyayasetu:ready"));
  }, []);

  return (
    <ErrorBoundaryWithDispatch>
      <ErrorNotificationSnackbar />
      <GlobalSnackbars />
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundaryWithDispatch>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<PageLoader />} persistor={persistor}>
        <NyayaThemeProvider>
          <AppBootstrap />
        </NyayaThemeProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
