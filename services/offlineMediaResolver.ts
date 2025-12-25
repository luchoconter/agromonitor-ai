// Servicio para resolver multimedia almacenada offline en IndexedDB
// No afecta el flujo de sincronización existente

import { getBlobFromIndexedDB } from './indexedDBService';
import { MonitoringRecord, LotSummary } from '../types/models';

interface OfflineMedia {
  photo?: string;
  audio?: string;
}

/**
 * Enriquece un documento con URLs de blob temporales si tiene multimedia offline
 * @param doc Documento de monitoreo (posiblemente con _offlineMedia)
 * @returns Documento enriquecido con URLs temporales o documento original si falla
 */
export const enrichWithOfflineMedia = async (doc: MonitoringRecord): Promise<MonitoringRecord> => {
  try {
    // Si no tiene metadata offline, retornar sin cambios
    const offlineMedia = (doc as any)._offlineMedia as OfflineMedia | undefined;
    if (!offlineMedia) {
      return doc;
    }

    const enrichedDoc = { ...doc };
    
    // Recuperar foto de IndexedDB si existe
    if (offlineMedia.photo && !doc.media?.photoUrl) {
      try {
        const photoBlob = await getBlobFromIndexedDB(offlineMedia.photo);
        if (photoBlob) {
          const blobUrl = URL.createObjectURL(photoBlob);
          enrichedDoc.media = {
            ...enrichedDoc.media,
            photoUrl: blobUrl
          };
          (enrichedDoc.media as any)._isBlobUrl = true; // Flag para cleanup
          console.log(`📸 Foto offline cargada: ${offlineMedia.photo}`);
        }
      } catch (e) {
        console.warn('⚠️ No se pudo cargar foto offline:', e);
      }
    }

    // Recuperar audio de IndexedDB si existe
    if (offlineMedia.audio && !doc.media?.audioUrl) {
      try {
        const audioBlob = await getBlobFromIndexedDB(offlineMedia.audio);
        if (audioBlob) {
          const blobUrl = URL.createObjectURL(audioBlob);
          enrichedDoc.media = {
            ...enrichedDoc.media,
            audioUrl: blobUrl
          };
          (enrichedDoc.media as any)._isBlobUrl = true; // Flag para cleanup
          console.log(`🎤 Audio offline cargado: ${offlineMedia.audio}`);
        }
      } catch (e) {
        console.warn('⚠️ No se pudo cargar audio offline:', e);
      }
    }

    return enrichedDoc;
  } catch (error) {
    // Si algo falla, retornar documento original sin cambios
    console.error('❌ Error enriqueciendo multimedia offline:', error);
    return doc;
  }
};

/**
 * Limpia URLs de blob temporales para evitar memory leaks
 * @param doc Documento con posibles blob URLs
 */
export const revokeOfflineBlobUrls = (doc: MonitoringRecord | LotSummary) => {
  try {
    if ((doc as any).media?._isBlobUrl) {
      const media = (doc as any).media;
      if (media?.photoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(media.photoUrl);
      }
      if (media?.audioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(media.audioUrl);
      }
    }
    // Para LotSummary, también revisar audioUrl directo
    if ('audioUrl' in doc && (doc as any)._isBlobUrl && doc.audioUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(doc.audioUrl);
    }
  } catch (e) {
    // Silenciar errores de revoke - no son críticos
  }
};

/**
 * Enriquece un LotSummary con URLs de blob temporales si tiene audio offline
 * @param summary LotSummary (posiblemente con _offlineMedia)
 * @returns LotSummary enriquecido con URL temporal o original si falla
 */
export const enrichLotSummaryWithOfflineMedia = async (summary: LotSummary): Promise<LotSummary> => {
  try {
    const offlineMedia = (summary as any)._offlineMedia as OfflineMedia | undefined;
    if (!offlineMedia) {
      return summary;
    }

    const enrichedSummary = { ...summary };
    
    // Recuperar audio de IndexedDB si existe
    if (offlineMedia.audio && !summary.audioUrl) {
      try {
        const audioBlob = await getBlobFromIndexedDB(offlineMedia.audio);
        if (audioBlob) {
          const blobUrl = URL.createObjectURL(audioBlob);
          enrichedSummary.audioUrl = blobUrl;
          (enrichedSummary as any)._isBlobUrl = true; // Flag para cleanup
          console.log(`🎤 Audio offline de resumen cargado: ${offlineMedia.audio}`);
        }
      } catch (e) {
        console.warn('⚠️ No se pudo cargar audio offline de resumen:', e);
      }
    }

    return enrichedSummary;
  } catch (error) {
    console.error('❌ Error enriqueciendo audio offline de resumen:', error);
    return summary;
  }
};

/**
 * Enriquece una Prescription con URLs de blob temporales si tiene audio offline
 * @param prescription Prescription (posiblemente con _offlineMedia)
 * @returns Prescription enriquecida con URL temporal o original si falla
 */
export const enrichPrescriptionWithOfflineMedia = async (prescription: any): Promise<any> => {
  try {
    const offlineMedia = prescription._offlineMedia as OfflineMedia | undefined;
    if (!offlineMedia) {
      return prescription;
    }

    const enrichedPrescription = { ...prescription };
    
    // Recuperar audio de IndexedDB si existe
    if (offlineMedia.audio && !prescription.audioUrl) {
      try {
        const audioBlob = await getBlobFromIndexedDB(offlineMedia.audio);
        if (audioBlob) {
          const blobUrl = URL.createObjectURL(audioBlob);
          enrichedPrescription.audioUrl = blobUrl;
          enrichedPrescription._isBlobUrl = true; // Flag para cleanup
          console.log(`🎙️ Audio offline de receta cargado: ${offlineMedia.audio}`);
        }
      } catch (e) {
        console.warn('⚠️ No se pudo cargar audio offline de receta:', e);
      }
    }

    return enrichedPrescription;
  } catch (error) {
    console.error('❌ Error enriqueciendo audio offline de receta:', error);
    return prescription;
  }
};
