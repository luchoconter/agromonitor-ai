
import React, { useState, useEffect, useCallback } from 'react';
import { MonitoringPestData, GeoLocation, WeatherData } from '../types';
import * as Storage from '../services/storageService';
import { fetchWeather } from '../services/weatherService'; // Import Service
import { useData } from '../contexts/DataContext';

interface UseMonitoringFormParams {
  currentUser: any;
  dataOwnerId: string | null;
  dataOwnerName?: string;
  selection: {
    companyId: string | null;
    fieldId: string | null;
    plotId: string | null;
    seasonId: string | null;
  };
  editingMonitoringId: string | null;
  onSuccess: () => void;
  showNotification: (msg: string, type: 'success' | 'warning' | 'error') => void;
}

export const useMonitoringForm = ({
  currentUser,
  dataOwnerId,
  dataOwnerName,
  selection,
  editingMonitoringId,
  onSuccess,
  showNotification
}: UseMonitoringFormParams) => {
  const { data } = useData();

  // Form State
  const [selectedPestIds, setSelectedPestIds] = useState<string[]>([]);
  const [pestValues, setPestValues] = useState<Record<string, string | number>>({});
  const [observationText, setObservationText] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [originalLocation, setOriginalLocation] = useState<GeoLocation | undefined | null>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New: Phenology State
  const [phenology, setPhenology] = useState<string>('');

  // New: Stand Data State
  const [plantsPerMeter, setPlantsPerMeter] = useState<string>('');
  const [distanceBetweenRows, setDistanceBetweenRows] = useState<string>('0.52'); // Default to 0.52m (common for Soy/Corn)

  // Weather State
  const [currentWeather, setCurrentWeather] = useState<WeatherData | undefined>(undefined);

  // Load data for editing
  useEffect(() => {
    if (editingMonitoringId) {
      const record = data.monitorings.find(m => m.id === editingMonitoringId);
      if (record) {
        let loadedPestIds: string[] = [];
        let loadedValues: Record<string, string | number> = {};

        if (record.pestData && record.pestData.length > 0) {
          loadedPestIds = record.pestData.map(p => p.pestId);
          record.pestData.forEach(p => loadedValues[p.pestId] = p.value);
        } else if (record.pestIds) {
          loadedPestIds = record.pestIds;
        } else if (record.pestId) {
          loadedPestIds = [record.pestId];
        }

        setSelectedPestIds(loadedPestIds);
        setPestValues(loadedValues);
        setObservationText(record.observations || '');
        setPhotoUrl(record.media?.photoUrl || null);
        setOriginalLocation(record.location);
        setCurrentWeather(record.weather); // Load existing weather
        setPhenology(record.phenology || ''); // Load phenology
        if (record.standData) {
          setPlantsPerMeter(record.standData.plantsPerMeter.toString());
          setDistanceBetweenRows(record.standData.distanceBetweenRows.toString());
        }
      }
    } else {
      resetForm();
    }
  }, [editingMonitoringId, data.monitorings]);

  // NEW: Fetch Weather when submitting if we have location and no weather yet
  const fetchCurrentWeather = async (lat: number, lng: number): Promise<WeatherData | undefined> => {
    const w = await fetchWeather(lat, lng);
    if (w) {
      return {
        temp: w.current.temp,
        humidity: w.current.humidity,
        windSpeed: w.current.windSpeed,
        condition: w.current.conditionLabel,
        rainProb: w.daily[0]?.rainProb || 0
      };
    }
    return undefined;
  };

  const resetForm = useCallback(() => {
    setSelectedPestIds([]);
    setPestValues({});
    setObservationText('');
    setPhotoUrl(null);
    setOriginalLocation(undefined);
    setCurrentWeather(undefined);
    setPhenology('');
    setPlantsPerMeter('');
    setDistanceBetweenRows('0.52');
  }, []);

  const handlePestChange = (selectedIds: string[]) => {
    setSelectedPestIds(selectedIds);
    const newValues = { ...pestValues };
    Object.keys(newValues).forEach(key => {
      if (!selectedIds.includes(key)) delete newValues[key];
    });
    setPestValues(newValues);
  };

  const handlePestValueChange = (pestId: string, value: string | number) => {
    setPestValues(prev => ({ ...prev, [pestId]: value }));
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const compressedBlob = await Storage.compressImage(file);
        const imageUrl = URL.createObjectURL(compressedBlob);
        setPhotoUrl(imageUrl);
      } catch (err) {
        console.error("Error compressing image", err);
        showNotification("Error al procesar la imagen", 'error');
      }
    }
  };

  const submitMonitoring = async (
    currentLocation: GeoLocation | undefined,
    audioBlobUrl: string | null,
    audioDuration: number,
    hasAudio: boolean,
    sampleNumber: number
  ) => {
    if (!selection.companyId || !selection.fieldId || !selection.plotId || !selection.seasonId || !currentUser || !dataOwnerId) {
      showNotification("Faltan datos de contexto", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Fetch weather just before saving if we have location
      let weatherToSave = currentWeather;
      const locationToUse = editingMonitoringId ? originalLocation : currentLocation;

      if (!weatherToSave && locationToUse && navigator.onLine) {
        try {
          weatherToSave = await fetchCurrentWeather(locationToUse.lat, locationToUse.lng);
        } catch (e) { console.warn("Weather fetch failed", e); }
      }

      const pestDataPayload: MonitoringPestData[] = selectedPestIds.map(id => {
        const pest = data.pests.find(p => p.id === id);
        return {
          pestId: id,
          name: pest?.name || 'Desconocido',
          unit: pest?.defaultUnit || '-',
          value: pestValues[id] || 0
        };
      });

      let calculatedSeverity: 'baja' | 'media' | 'alta' = 'baja';
      if (Object.values(pestValues).includes('Alta')) calculatedSeverity = 'alta';
      else if (Object.values(pestValues).includes('Media')) calculatedSeverity = 'media';

      const recordToEdit = editingMonitoringId ? data.monitorings.find(m => m.id === editingMonitoringId) : null;
      const finalHasAudio = hasAudio || !!recordToEdit?.media?.hasAudio;
      const finalAudioDuration = audioDuration > 0 ? audioDuration : (recordToEdit?.media?.audioDuration || 0);
      const locationToSave = editingMonitoringId ? originalLocation : currentLocation;

      // Stand Calculation
      let standDataToSave = undefined;
      if (plantsPerMeter && distanceBetweenRows) {
        const ppm = parseFloat(plantsPerMeter);
        const dist = parseFloat(distanceBetweenRows);
        if (!isNaN(ppm) && !isNaN(dist) && dist > 0) {
          const pph = Math.round((ppm / dist) * 10000);
          standDataToSave = {
            plantsPerMeter: ppm,
            distanceBetweenRows: dist,
            plantsPerHectare: pph
          };
        }
      }

      const commonData = {
        companyId: selection.companyId,
        fieldId: selection.fieldId,
        plotId: selection.plotId,
        seasonId: selection.seasonId,
        pestIds: selectedPestIds,
        pestData: pestDataPayload,
        userId: currentUser.id,
        userName: currentUser.name,
        ownerId: dataOwnerId,
        ownerName: dataOwnerName,
        location: locationToSave || null,
        weather: weatherToSave || null,
        phenology: phenology || null, // Guardar fenología
        standData: standDataToSave, // NUEVO: Guardar Stand
        observations: observationText,
        severity: calculatedSeverity,
        media: {
          photoUrl: photoUrl || null,
          hasAudio: finalHasAudio,
          audioDuration: finalAudioDuration
        }
      };

      if (editingMonitoringId) {
        await Storage.updateMonitoring(editingMonitoringId, commonData, audioBlobUrl || undefined);
        showNotification("Monitoreo actualizado exitosamente.", 'success');
      } else {
        const now = new Date();
        await Storage.addMonitoring({
          ...commonData,
          date: now.toISOString(),
          sampleNumber: sampleNumber,
        }, audioBlobUrl || undefined);

        if (navigator.onLine) showNotification("Guardado. Subiendo...", 'success');
        else showNotification("Guardado local. Pendiente subida.", 'warning');
      }

      // Pequeño delay para permitir que el cache local se actualice antes de resetear
      await new Promise(resolve => setTimeout(resolve, 100));

      onSuccess();
      if (!editingMonitoringId) resetForm();

    } catch (error) {
      console.error(error);
      showNotification("Error al guardar el monitoreo", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCleanMonitoring = async (currentLocation: GeoLocation | undefined, sampleNumber: number) => {
    if (!selection.companyId || !selection.fieldId || !selection.plotId || !selection.seasonId || !currentUser || !dataOwnerId) {
      showNotification("Faltan datos de contexto", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Auto fetch weather
      let weatherToSave: WeatherData | undefined = undefined;
      if (currentLocation && navigator.onLine) {
        weatherToSave = await fetchCurrentWeather(currentLocation.lat, currentLocation.lng);
      }

      const now = new Date();
      await Storage.addMonitoring({
        companyId: selection.companyId,
        fieldId: selection.fieldId,
        plotId: selection.plotId,
        seasonId: selection.seasonId,
        userId: currentUser.id,
        userName: currentUser.name,
        ownerId: dataOwnerId,
        ownerName: dataOwnerName,
        location: currentLocation || null,
        weather: weatherToSave || null,
        phenology: phenology || null, // También guardar fenología en lote limpio
        sampleNumber: sampleNumber,
        date: now.toISOString(),
        pestIds: [],
        pestData: [],
        severity: 'baja',
        observations: "Sin novedades / Lote Limpio",
        media: {
          photoUrl: null,
          hasAudio: false,
          audioDuration: 0
        }
      });

      if (navigator.onLine) showNotification("Lote Limpio registrado.", 'success');
      else showNotification("Lote Limpio guardado localmente.", 'warning');

      onSuccess();
    } catch (error) {
      console.error(error);
      showNotification("Error al guardar lote limpio", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedPestIds,
    pestValues,
    observationText,
    photoUrl,
    isSubmitting,
    originalLocation,
    phenology, // Expose state
    setPhenology, // Expose setter
    plantsPerMeter,
    setPlantsPerMeter,
    distanceBetweenRows,
    setDistanceBetweenRows,
    setObservationText,
    handlePestChange,
    handlePestValueChange,
    handlePhotoSelect,
    submitMonitoring,
    submitCleanMonitoring,
    resetForm
  };
};
