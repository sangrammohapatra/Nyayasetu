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
import NyayaThemeProvider from "./theme/ThemeProvider";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import AnimatedPage from "./components/ui/AnimatedPage";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import NyayaBotWidget from "./components/nyayabot/NyayaBotWidget";
import ErrorBoundaryWithDispatch from "./components/ui/ErrorBoundary";
import { ErrorNotificationSnackbar } from "./hooks/useErrorHandling";

import {
  selectIsAuthenticated,
  selectUserPersona,
  selectAuthLoading,
  getMe,
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
const CitizenProfile = lazy(() => import("./pages/citizen/CitizenProfile"));

// Lawyer
const LawyerHome = lazy(() => import("./pages/lawyer/LawyerHome"));
const LawyerDashboard = lazy(() => import("./pages/lawyer/LawyerDashboard"));
const ClientList = lazy(() => import("./pages/lawyer/ClientList"));
const CaseManagement = lazy(() => import("./pages/lawyer/CaseManagement"));
const EarningsPanel = lazy(() => import("./pages/lawyer/EarningsPanel"));

// Shared
const Pricing = lazy(() => import("./pages/shared/Pricing"));
const Settings = lazy(() => import("./pages/shared/Settings"));
const NyayaBotPage = lazy(() => import("./pages/NyayaBotPage"));

// Layout 
const ThemeSwitcher = lazy(() => import("./components/layout/ThemeSwitcher"));
const LawyerSearch = lazy(() => import("./components/lawyer/LawyerSearch"));
const ConsultationsPage = lazy(() => import("./pages/lawyer/ClientList")); // placeholder
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers     = lazy(() => import('./pages/admin/AdminUsers'));
const AdminLawyers   = lazy(() => import('./pages/admin/AdminLawyers'));
const AdminTemplates = lazy(() => import('./pages/admin/AdminTemplates'));

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

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const home = persona === 'admin' ? '/admin/dashboard' : `/${persona}/home`;
  return <Navigate to={home} replace />;
}

// ─── /settings redirect ───────────────────────────────────────────────────────

function SettingsRedirect() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const persona = useSelector(selectUserPersona);
  const loading = useSelector(selectAuthLoading);

  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
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
            fontFamily: "'Playfair Display',serif",
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

// ─── Shared document view (no auth required) ──────────────────────────────────

const SharedDocumentView = lazy(
  () => import("./pages/citizen/DocumentPreview"),
);

// ─── Router definition ────────────────────────────────────────────────────────

const router = createBrowserRouter([
  // Root redirect
  { path: "/", element: <RootRedirect /> },

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
  {
    path: "/nyayabot",
    element: (
      <ProtectedRoute>
        <NyayaBotPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/nyayabot/:sessionId",
    element: (
      <ProtectedRoute>
        <NyayaBotPage />
      </ProtectedRoute>
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
      { path: "profile", element: <CitizenProfile /> },
      { path: "settings", element: <Settings /> },
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
      }
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
            borderRadius: 2,
            background: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
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

  // Fetch user profile on load if token exists
  useEffect(() => {
    const token = localStorage.getItem("nyayasetu_token");
    if (token) {
      dispatch(getMe());
    }
  }, [dispatch]);

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
