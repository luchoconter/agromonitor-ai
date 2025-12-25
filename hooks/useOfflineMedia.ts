// Hook para enriquecer monitoreos, lot summaries y prescriptions con multimedia offline de IndexedDB
// Uso monitorings: const enrichedMonitorings = useOfflineMedia(monitorings)
// Uso summaries: const enrichedSummaries = useOfflineLotSummaries(summaries)
// Uso prescriptions: const enrichedPrescriptions = useOfflinePrescriptions(prescriptions)

import { useState, useEffect } from 'react';
import { MonitoringRecord, LotSummary } from '../types/models';
import { 
  enrichWithOfflineMedia, 
  enrichLotSummaryWithOfflineMedia, 
  enrichPrescriptionWithOfflineMedia,
  revokeOfflineBlobUrls 
} from '../services/offlineMediaResolver';

/**
 * Hook que enriquece automáticamente monitoreos con multimedia offline
 * Si los documentos tienen _offlineMedia, recupera los blobs de IndexedDB
 * y crea URLs temporales para visualización
 */
export const useOfflineMedia = (monitorings: MonitoringRecord[]): MonitoringRecord[] => {
  const [enriched, setEnriched] = useState<MonitoringRecord[]>(monitorings);

  useEffect(() => {
    let isMounted = true;

    const enrich = async () => {
      try {
        // Enriquecer cada documento en paralelo
        const enrichedDocs = await Promise.all(
          monitorings.map(doc => enrichWithOfflineMedia(doc))
        );

        if (isMounted) {
          setEnriched(enrichedDocs);
        }
      } catch (error) {
        console.error('Error enriqueciendo multimedia offline:', error);
        // En caso de error, usar documentos originales
        if (isMounted) {
          setEnriched(monitorings);
        }
      }
    };

    enrich();

    // Cleanup: revocar blob URLs al desmontar
    return () => {
      isMounted = false;
      enriched.forEach(doc => revokeOfflineBlobUrls(doc));
    };
  }, [monitorings]);

  return enriched;
};

/**
 * Hook que enriquece automáticamente lot summaries con audio offline
 * Si los documentos tienen _offlineMedia, recupera el audio de IndexedDB
 * y crea URLs temporales para reproducción
 */
export const useOfflineLotSummaries = (summaries: LotSummary[]): LotSummary[] => {
  const [enriched, setEnriched] = useState<LotSummary[]>(summaries);

  useEffect(() => {
    let isMounted = true;

    const enrich = async () => {
      try {
        // Enriquecer cada resumen en paralelo
        const enrichedSummaries = await Promise.all(
          summaries.map(summary => enrichLotSummaryWithOfflineMedia(summary))
        );

        if (isMounted) {
          setEnriched(enrichedSummaries);
        }
      } catch (error) {
        console.error('Error enriqueciendo audio offline de resúmenes:', error);
        // En caso de error, usar documentos originales
        if (isMounted) {
          setEnriched(summaries);
        }
      }
    };

    enrich();

    // Cleanup: revocar blob URLs al desmontar
    return () => {
      isMounted = false;
      enriched.forEach(summary => revokeOfflineBlobUrls(summary));
    };
  }, [summaries]);

  return enriched;
};

/**
 * Hook que enriquece automáticamente prescriptions con audio offline
 * Si los documentos tienen _offlineMedia, recupera el audio de IndexedDB
 * y crea URLs temporales para reproducción
 */
export const useOfflinePrescriptions = (prescriptions: any[]): any[] => {
  const [enriched, setEnriched] = useState<any[]>(prescriptions);

  useEffect(() => {
    let isMounted = true;

    const enrich = async () => {
      try {
        // Enriquecer cada receta en paralelo
        const enrichedPrescriptions = await Promise.all(
          prescriptions.map(prescription => enrichPrescriptionWithOfflineMedia(prescription))
        );

        if (isMounted) {
          setEnriched(enrichedPrescriptions);
        }
      } catch (error) {
        console.error('Error enriqueciendo audio offline de recetas:', error);
        // En caso de error, usar documentos originales
        if (isMounted) {
          setEnriched(prescriptions);
        }
      }
    };

    enrich();

    // Cleanup: revocar blob URLs al desmontar
    return () => {
      isMounted = false;
      enriched.forEach(prescription => revokeOfflineBlobUrls(prescription));
    };
  }, [prescriptions]);

  return enriched;
};
