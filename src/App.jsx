import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { useEffect } from 'react';

// Aether pages
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import GoalExecution from '@/pages/GoalExecution';
import MemoryBrowser from '@/pages/MemoryBrowser';
import VoiceMode from '@/pages/VoiceMode';
import ToolsApprovals from '@/pages/ToolsApprovals';
import Settings from '@/pages/Settings';
import AetherLayout from '@/components/AetherLayout';

// Aether store & WS
import useAetherStore, { CONNECTION_STATUS } from '@/lib/aetherStore';
import wsClient from '@/lib/wsClient';

// ── Auto-connect on mount ─────────────────────────────────────────────────────
function AetherApp() {
  const { onboardingComplete, settings, connectionStatus, loadMockData } = useAetherStore();

  useEffect(() => {
    // Auto-connect if settings exist and auto-connect is enabled
    if (
      onboardingComplete &&
      settings.autoConnect &&
      settings.savedHost &&
      connectionStatus === CONNECTION_STATUS.IDLE
    ) {
      wsClient.connect(settings.savedHost, settings.savedPort || '8765');
    }

    // Load demo data for preview if not connected after 3s
    const timer = setTimeout(() => {
      const status = useAetherStore.getState().connectionStatus;
      if (status === CONNECTION_STATUS.IDLE || status === CONNECTION_STATUS.DISCONNECTED) {
        if (useAetherStore.getState().onboardingComplete) {
          loadMockData();
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const location = useLocation();

  // Show onboarding if not complete
  if (!onboardingComplete) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <Onboarding
              onComplete={() => {
                useAetherStore.getState().completeOnboarding();
                window.location.href = '/';
              }}
            />
          }
        />
      </Routes>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -24, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Routes location={location}>
          <Route element={<AetherLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goals" element={<GoalExecution />} />
            <Route path="/memory" element={<MemoryBrowser />} />
            <Route path="/voice" element={<VoiceMode />} />
            <Route path="/tools" element={<ToolsApprovals />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route
            path="/onboarding"
            element={<Onboarding onComplete={() => window.location.href = '/'} />}
          />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--aether-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center animate-breathe"
            style={{ background: 'var(--aether-cyan-dim)', border: '1px solid rgba(0,212,255,0.3)' }}
          >
            <div className="w-6 h-6 border-2 rounded-full border-t-transparent animate-spin" style={{ borderColor: 'var(--aether-cyan)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--aether-text-muted)' }}>Initializing Aether…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return <AetherApp />;
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App