
import React, { useEffect } from 'react';
import {
  Building2, Map, Grid3X3, Calendar, AlertTriangle, Loader2, BarChart3, LayoutList, FlaskConical, ListTodo, FileText, Layers, ArrowRight
} from 'lucide-react';
import { ViewState } from './types';
import { Button } from './components/UI';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { TrackingProvider } from './contexts/TrackingContext';

// Offline sync
import { initAutoSync } from './services/autoSyncService';

// Diagnostics (para debugging en consola)
import './services/diagnosticsService';

// Components & Views
import { Layout } from './components/Layout';
import { LoginView } from './views/LoginView';
import { HomeView } from './views/HomeView';
import { HistoryView } from './views/HistoryView';
import { TeamView } from './views/TeamView';
import { ManagementHub } from './views/ManagementHub';
import { CropAssignmentsView } from './views/CropAssignmentsView';
import { DashboardView } from './views/DashboardView';
import { RecipesView } from './views/RecipesView';
import { NotificationManager } from './components/NotificationManager';

// --- Main Inner App (Access to Contexts) ---
const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const { data, isLoading: isLoadingData, connectionError, userCompanies, dataOwnerId } = useData();
  const { view, setView } = useUI();

  // Inicializar auto-sincronización offline
  useEffect(() => {
    initAutoSync();
  }, []);

  // Redirect Logic: Smart Onboarding (solo primera carga)
  const [hasRedirected, setHasRedirected] = React.useState(false);

  useEffect(() => {
    // Solo ejecutamos UNA VEZ en la primera carga, no cada vez que navegan a home
    if (!hasRedirected && !isLoadingData && currentUser && currentUser.role !== 'operator' && view === 'home') {
      setHasRedirected(true); // Marcar como ya redirigido

      // Si no hay empresas creadas, enviar a structure-hub para configuración inicial
      if (userCompanies.length === 0) {
        setView('structure-hub');
      }
      // Si ya tiene estructura, permitir que se quede en home (muestreo)
      // Ya no forzamos ir al dashboard
    }
  }, [currentUser, isLoadingData, userCompanies.length, view, hasRedirected]);

  // --- Handlers & Renders ---

  const renderStructureHub = () => (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Estructura Agronómica</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configura los 4 pilares fundamentales de tu monitoreo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: '1. Empresas',
            count: userCompanies.length,
            icon: Building2,
            target: 'manage-companies' as ViewState,
            desc: 'Clientes o Razones Sociales',
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20'
          },
          {
            title: '2. Campos',
            count: data.fields.filter(f => userCompanies.some(c => c.id === f.companyId)).length,
            icon: Map,
            target: 'manage-fields' as ViewState,
            desc: 'Establecimientos físicos',
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20'
          },
          {
            title: '3. Lotes',
            count: data.plots.length,
            icon: Grid3X3,
            target: 'manage-plots' as ViewState,
            desc: 'Unidades de manejo',
            color: 'text-amber-600',
            bg: 'bg-amber-50 dark:bg-amber-900/20'
          },
          {
            title: '4. Campañas',
            count: data.seasons.length,
            icon: Calendar,
            target: 'manage-seasons' as ViewState,
            desc: 'Ciclos (Ej: 23/24)',
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20'
          },
        ].map((item) => (
          <div key={item.title} onClick={() => setView(item.target)} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-agro-300 dark:hover:border-agro-500 transition-all flex flex-col items-center text-center group h-full relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${item.bg.split(' ')[0].replace('50', '500')}`}></div>
            <div className={`${item.bg} p-4 rounded-full mb-4 group-hover:scale-110 transition-transform`}>
              <item.icon className={`w-8 h-8 ${item.color} dark:text-gray-200`} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">{item.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{item.desc}</p>
            <div className="mt-auto pt-3 w-full border-t border-gray-100 dark:border-gray-700">
              <span className="text-2xl font-bold text-gray-700 dark:text-white">{item.count}</span>
              <span className="text-[10px] text-gray-400 uppercase ml-1">Registros</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center gap-6">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full shrink-0">
          <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 dark:text-blue-300 text-base mb-2">Flujo de Carga Recomendado</h4>
          <div className="flex flex-col md:flex-row items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold bg-white dark:bg-gray-800 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm">1. Crea la Empresa</span>
            <ArrowRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
            <span className="font-semibold bg-white dark:bg-gray-800 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm">2. Agrega Campos</span>
            <ArrowRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
            <span className="font-semibold bg-white dark:bg-gray-800 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm">3. Dibuja Lotes</span>
            <ArrowRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
            <span className="font-semibold bg-white dark:bg-gray-800 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm">4. Activa Campaña</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return <LoginView />;
  }

  if (connectionError) return <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-red-50 dark:bg-gray-900 text-red-600"><AlertTriangle className="w-12 h-12 mb-4" /><p className="font-bold mb-2">Error de Conexión</p><p className="mb-4">{connectionError}</p><Button onClick={() => window.location.reload()}>Reintentar</Button></div>;
  if (isLoadingData) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-gray-900"><Loader2 className="w-12 h-12 animate-spin mb-4 text-agro-600" /><p className="animate-pulse text-gray-600 dark:text-gray-400">Sincronizando datos...</p></div>;

  return (
    <Layout>
      <NotificationManager />

      {view === 'home' && <HomeView />}

      {view === 'history' && dataOwnerId && <HistoryView />}

      {view === 'manage-team' && <TeamView />}

      {view === 'structure-hub' && renderStructureHub()}

      {view.startsWith('manage-') && view !== 'manage-team' && dataOwnerId && (
        <ManagementHub />
      )}

      {view === 'analytics' && <DashboardView />}

      {view === 'recipes' && <RecipesView />}

      {view === 'crop-assignments' && <CropAssignmentsView />}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <UIProvider>
          <TrackingProvider>
            <MainApp />
          </TrackingProvider>
        </UIProvider>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
