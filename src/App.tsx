import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell, type AppRoute } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchHealthStatus } from './lib/api';
import { AuthPage } from './pages/AuthPage';
import { BiodiversityPage } from './pages/BiodiversityPage';
import { ControlCenterPage } from './pages/ControlCenterPage';
import { DashboardPage } from './pages/DashboardPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { LandingPage } from './pages/LandingPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { TaxonomyResultsPage } from './pages/TaxonomyResultsPage';
import { UploadDatasetPage } from './pages/UploadDatasetPage';
import type { HealthStatus } from './types/ecodna';

type PagePath =
  | '/'
  | '/login'
  | '/register'
  | '/dashboard'
  | '/upload'
  | '/datasets'
  | '/taxonomy'
  | '/biodiversity'
  | '/reports'
  | '/profile'
  | '/control-center';

function normalizePath(pathname: string): PagePath {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const valid: PagePath[] = [
    '/',
    '/login',
    '/register',
    '/dashboard',
    '/upload',
    '/datasets',
    '/taxonomy',
    '/biodiversity',
    '/reports',
    '/profile',
    '/control-center',
  ];
  return (valid.includes(clean as PagePath) ? clean : '/') as PagePath;
}

const ROUTE_TO_PATH: Record<AppRoute, PagePath> = {
  dashboard: '/dashboard',
  upload: '/upload',
  datasets: '/datasets',
  taxonomy: '/taxonomy',
  biodiversity: '/biodiversity',
  reports: '/reports',
  profile: '/profile',
};

const EcoDnaRouter: React.FC = () => {
  const { firebaseUser, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<PagePath>(() => normalizePath(window.location.pathname));
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const navigatePath = (nextPath: PagePath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navigateApp = (route: AppRoute, jobId?: string) => {
    if (jobId) setSelectedJobId(jobId);
    navigatePath(ROUTE_TO_PATH[route]);
  };

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    void fetchHealthStatus()
      .then(setHealth)
      .catch(() => null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7FAF9] flex items-center justify-center gap-3 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        <span>Initializing EcoDNA workspace...</span>
      </div>
    );
  }

  // Hidden Protected Admin Route (/control-center)
  if (currentPath === '/control-center') {
    return (
      <ControlCenterPage
        onNavigateHome={() => navigatePath(firebaseUser ? '/dashboard' : '/')}
        onOpenAuth={() => navigatePath('/login')}
      />
    );
  }

  // Public Auth Routes
  if (currentPath === '/login' || currentPath === '/register') {
    if (firebaseUser) {
      return (
        <AppShell currentRoute="dashboard" onNavigate={navigateApp} health={health}>
          <DashboardPage onNavigate={navigateApp} />
        </AppShell>
      );
    }
    return (
      <AuthPage
        initialMode={currentPath === '/register' ? 'register' : 'login'}
        onBackHome={() => navigatePath('/')}
        onSuccess={() => navigatePath('/dashboard')}
      />
    );
  }

  // Public Landing Page
  if (currentPath === '/') {
    return (
      <LandingPage
        isAuthenticated={Boolean(firebaseUser)}
        onOpenAuth={(mode) => navigatePath(mode === 'register' ? '/register' : '/login')}
        onEnterWorkspace={() => navigatePath('/dashboard')}
      />
    );
  }

  // Protected Researcher Workspace Routes
  if (!firebaseUser) {
    return (
      <AuthPage
        initialMode="login"
        onBackHome={() => navigatePath('/')}
        onSuccess={() => navigatePath(currentPath)}
      />
    );
  }

  const activeRoute: AppRoute =
    currentPath === '/upload'
      ? 'upload'
      : currentPath === '/datasets'
        ? 'datasets'
        : currentPath === '/taxonomy'
          ? 'taxonomy'
          : currentPath === '/biodiversity'
            ? 'biodiversity'
            : currentPath === '/reports'
              ? 'reports'
              : currentPath === '/profile'
                ? 'profile'
                : 'dashboard';

  return (
    <AppShell currentRoute={activeRoute} onNavigate={navigateApp} health={health}>
      {activeRoute === 'dashboard' && <DashboardPage onNavigate={navigateApp} />}
      {activeRoute === 'upload' && <UploadDatasetPage health={health} onNavigate={navigateApp} />}
      {activeRoute === 'datasets' && <DatasetsPage onNavigate={navigateApp} />}
      {activeRoute === 'taxonomy' && (
        <TaxonomyResultsPage selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
      )}
      {activeRoute === 'biodiversity' && (
        <BiodiversityPage selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
      )}
      {activeRoute === 'reports' && (
        <ReportsPage selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
      )}
      {activeRoute === 'profile' && <ProfilePage onNavigate={navigateApp} />}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <EcoDnaRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
