
import { useState, useEffect, useMemo } from 'react';
import { AppState, User } from '../types';
import * as Storage from '../services/storageService';

export const useDataSync = (currentUser: User | null) => {
  const [data, setData] = useState<AppState>({
    companies: [], fields: [], plots: [], seasons: [], pests: [], crops: [], 
    agrochemicals: [], tasks: [], prescriptions: [], templates: [], 
    assignments: [], monitorings: [], lotSummaries: []
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

  // Subscription Logic
  useEffect(() => {
      if (!dataOwnerId) {
          setIsLoading(false);
          return;
      }
      setIsLoading(true);
      const unsubscribe = Storage.subscribeToData(
        dataOwnerId, 
        (newData) => {
          setData(newData);
          setIsLoading(false);
          setConnectionError(null);
        },
        (error) => {
            console.error("Sync Error:", error);
            setIsLoading(false);
            if (error?.code === 'permission-denied') setConnectionError("Acceso denegado (Firebase Rules).");
            else setConnectionError("Error de conexión con la base de datos.");
        }
      );
      return () => unsubscribe();
  }, [dataOwnerId]);

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

  return {
      data,
      isLoading,
      connectionError,
      dataOwnerId,
      dataOwnerName,
      userCompanies
  };
};