
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { AppState, Company } from '../types';
import * as Storage from '../services/storageService';
import { useAuth } from './AuthContext';
import { loadCachedData, saveCachedData, isCacheValid, getCacheInfo } from '../services/cacheService';
import { getFromLocalCache } from '../services/localCacheService';
// import { cleanCorruptedPrescriptions } from '../services/migrations/cleanCorruptedPrescriptions';

interface DataContextType {
  data: AppState;
  isLoading: boolean;
  connectionError: string | null;
  dataOwnerId: string | null;
  dataOwnerName: string | undefined;
  userCompanies: Company[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Combina y deduplica documentos de Firestore y cache local
 * Prioriza Firestore sobre cache local para evitar duplicados visuales
 */
function mergeDeduplicated(firestoreItems: any[], localItems: any[]): any[] {
  if (localItems.length === 0) return firestoreItems;
  
  // Crear mapa de documentos de Firestore por campos únicos
  const firestoreMap = new Map<string, any>();
  firestoreItems.forEach(item => {
    // Crear clave única basada en campos clave (timestamp + lote + operario)
    const key = `${item.createdAt}_${item.plotId}_${item.operatorId}`;
    firestoreMap.set(key, item);
  });
  
  // Filtrar items del cache local que NO estén en Firestore
  const uniqueLocalItems = localItems.filter(localItem => {
    const key = `${localItem.createdAt}_${localItem.plotId}_${localItem.operatorId}`;
    return !firestoreMap.has(key);
  });
  
  // Combinar: Firestore + items locales únicos
  return [...firestoreItems, ...uniqueLocalItems];
}

/**
 * Combina y deduplica prescriptions de Firestore y cache local
 * USA LA MISMA ESTRATEGIA QUE MONITORINGS (createdAt numérico)
 */
function mergePrescriptions(firestoreItems: any[], localItems: any[]): any[] {
  if (localItems.length === 0) return firestoreItems;
  
  // Crear mapa de documentos de Firestore por campos únicos
  const firestoreMap = new Map<string, any>();
  firestoreItems.forEach(item => {
    // Clave única basada en timestamp numérico + empresa + campo
    const key = `${item.createdAt}_${item.companyId}_${item.fieldId}`;
    firestoreMap.set(key, item);
  });
  
  // Filtrar items del cache local que NO estén en Firestore
  const uniqueLocalItems = localItems.filter(localItem => {
    const key = `${localItem.createdAt}_${localItem.companyId}_${localItem.fieldId}`;
    
    // Si la clave existe en Firestore, este item local ya fue sincronizado
    if (firestoreMap.has(key)) {
      console.log(`🔄 Receta local deduplicada (ya en Firestore): ${key}`);
      return false; // No incluir, ya está en Firestore
    }
    
    return true; // Incluir, aún no sincronizada
  });
  
  // Combinar: Firestore + items locales únicos
  return [...firestoreItems, ...uniqueLocalItems];
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [localCacheVersion, setLocalCacheVersion] = useState(0);
  
  // Ejecutar migración una sola vez al inicio
  // useEffect(() => {
  //   const migrationKey = 'migration_prescription_cleanup_v1';
  //   if (!localStorage.getItem(migrationKey)) {
  //     console.log('🔧 Ejecutando migración de limpieza de prescriptions...');
  //     const success = cleanCorruptedPrescriptions();
  //     if (success) {
  //       localStorage.setItem(migrationKey, 'done');
  //     }
  //   }
  // }, []);
  
  const [data, setData] = useState<AppState>(() => {
    // CRITICAL: Intentar cargar desde cache optimizado al inicio (offline support)
    if (typeof window !== 'undefined') {
      const cachedData = loadCachedData();
      if (cachedData) {
        const cacheInfo = getCacheInfo();
        console.log(`📦 Cache cargado: ${cacheInfo.sizeMB.toFixed(2)}MB, válido por ${cacheInfo.expiresInDays} días`);
        return cachedData;
      }
    }
    return {
      companies: [], fields: [], plots: [], seasons: [], pests: [], crops: [], 
      agrochemicals: [], tasks: [], prescriptions: [], templates: [],
      assignments: [], monitorings: [], lotSummaries: []
    };
  });
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Derived Data Owner
  const dataOwnerId = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === 'admin') return currentUser.id;
    return currentUser.linkedAdminId || null;
  }, [currentUser]);

  const dataOwnerName = useMemo(() => {
    if (!currentUser) return undefined;
    if (currentUser.role === 'admin') return currentUser.name;
    return currentUser.consultancyName;
  }, [currentUser]);

  // Listener para cambios en cache local
  useEffect(() => {
    const handleLocalCacheUpdate = () => {
      setLocalCacheVersion(prev => prev + 1);
      console.log('🔄 Cache local actualizado - recombinando datos');
    };
    
    window.addEventListener('localCacheUpdated', handleLocalCacheUpdate);
    return () => window.removeEventListener('localCacheUpdated', handleLocalCacheUpdate);
  }, []);

  // Subscription Logic
  useEffect(() => {
    if (!dataOwnerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    // Timer de seguridad: si después de 2 segundos no hay datos, usar cache y desbloquear
    const safetyTimer = setTimeout(() => {
      console.warn('⏰ Timeout de carga - desbloqueando UI');
      setIsLoading(false);
    }, 2000);
    
    // Función para combinar Firestore + cache local
    const combineData = (firestoreData: AppState) => {
      const localMonitorings = getFromLocalCache('monitorings');
      const localLotSummaries = getFromLocalCache('lotSummaries');
      const localPrescriptions = getFromLocalCache('prescriptions');
      return {
        ...firestoreData,
        monitorings: mergeDeduplicated(firestoreData.monitorings, localMonitorings),
        lotSummaries: mergeDeduplicated(firestoreData.lotSummaries, localLotSummaries),
        prescriptions: mergePrescriptions(firestoreData.prescriptions, localPrescriptions)
      };
    };
    
    const unsubscribe = Storage.subscribeToData(
      dataOwnerId,
      (newData) => {
        clearTimeout(safetyTimer);
        
        // Combinar datos de Firestore con cache local (pendientes de sincronización)
        const combinedData = combineData(newData);
        
        setData(combinedData);
        setIsLoading(false);
        setConnectionError(null);
        
        // CRITICAL: Guardar en cache optimizado para próximo cold-start offline
        saveCachedData(newData);
      },
      (error) => {
        clearTimeout(safetyTimer);
        console.error("Sync Error:", error);
        setIsLoading(false);
        if (error?.code === 'permission-denied') setConnectionError("Acceso denegado (Firebase Rules).");
        else setConnectionError("Error de conexión con la base de datos.");
      }
    );
    
    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [dataOwnerId]);
  
  // Recombinar datos cuando cambia el cache local
  useEffect(() => {
    if (localCacheVersion === 0) return; // Skip inicial
    
    setData(prevData => {
      const localMonitorings = getFromLocalCache('monitorings');
      const localLotSummaries = getFromLocalCache('lotSummaries');
      const localPrescriptions = getFromLocalCache('prescriptions');
      return {
        ...prevData,
        monitorings: mergeDeduplicated(prevData.monitorings, localMonitorings),
        lotSummaries: mergeDeduplicated(prevData.lotSummaries, localLotSummaries),
        prescriptions: mergePrescriptions(prevData.prescriptions, localPrescriptions)
      };
    });
  }, [localCacheVersion]);

  // Derived User Companies
  const userCompanies = useMemo(() => {
    if (!currentUser) return [];
    return data.companies.filter(company => {
      if (currentUser.role === 'admin') return company.ownerId === currentUser.id;
      if (currentUser.role === 'operator') return company.ownerId === currentUser.linkedAdminId;
      if (currentUser.role === 'company') return company.id === currentUser.linkedCompanyId;
      return false;
    });
  }, [data.companies, currentUser]);

  return (
    <DataContext.Provider value={{ data, isLoading, connectionError, dataOwnerId, dataOwnerName, userCompanies }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
