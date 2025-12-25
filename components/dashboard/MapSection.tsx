
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { MonitoringRecord, Plot, LotSummary } from '../../types';
import { Layers } from 'lucide-react';

interface MapSectionProps {
  monitorings: MonitoringRecord[];
  plots: Plot[];
  isVisible?: boolean;
  mapColorMode?: 'date' | 'status' | 'pest';
  selectedPestForMap?: string;
  summaries?: LotSummary[];
  isExporting?: boolean;
  onSelectSummary?: (summary: LotSummary) => void;
  showHistory?: boolean;
}

const DATE_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7', 
    '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'
];

const NUMERIC_SCALE_COLORS = [
    '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'
];

interface NumericRange {
    min: number;
    max: number;
    color: string;
    label: string;
}

export const MapSection = forwardRef<HTMLDivElement, MapSectionProps>(({ 
  monitorings, 
  plots, 
  isVisible = true, 
  mapColorMode = 'date', 
  selectedPestForMap = '',
  summaries = [],
  isExporting = false,
  onSelectSummary,
  showHistory = false
}, ref) => {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite');

  useEffect(() => { setActiveFilter(null); }, [mapColorMode, selectedPestForMap, monitorings, showHistory]);

  useImperativeHandle(ref, () => wrapperRef.current as HTMLDivElement);

  const getShortDate = (isoString: string) => {
      const date = new Date(isoString);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const handleLegendClick = (label: string) => {
      if (isExporting) return;
      setActiveFilter(prev => prev === label ? null : label);
  };

  const pestAnalytics = useMemo(() => {
      if (mapColorMode !== 'pest' || !selectedPestForMap) return null;
      let isNumeric = true;
      let unit = '';
      const values: number[] = [];
      monitorings.forEach(m => {
          if (m.pestData) {
              const pd = m.pestData.find(p => p.name === selectedPestForMap);
              if (pd) {
                  if (unit === '') unit = pd.unit;
                  const valStr = String(pd.value).toLowerCase();
                  if (valStr.includes('alta') || valStr.includes('media') || valStr.includes('baja') || valStr === '') isNumeric = false;
                  else {
                      const num = parseFloat(pd.value as string);
                      if (!isNaN(num)) values.push(num); else isNumeric = false;
                  }
              }
          }
      });
      if (!isNumeric || values.length === 0) return { type: 'categorical', unit };
      const min = Math.min(...values);
      const max = Math.max(...values);
      const ranges: NumericRange[] = [];
      if (min === max) ranges.push({ min, max, color: NUMERIC_SCALE_COLORS[2], label: `${min}` });
      else {
          const step = (max - min) / 5;
          for (let i = 0; i < 5; i++) {
              const rMin = min + (step * i);
              const rMax = i === 4 ? max : min + (step * (i + 1));
              const rMinStr = Number.isInteger(rMin) ? rMin.toString() : rMin.toFixed(1);
              const rMaxStr = Number.isInteger(rMax) ? rMax.toString() : rMax.toFixed(1);
              ranges.push({ min: rMin, max: rMax, color: NUMERIC_SCALE_COLORS[i], label: `${rMinStr} - ${rMaxStr}` });
          }
      }
      return { type: 'numeric', unit, ranges, min, max };
  }, [monitorings, mapColorMode, selectedPestForMap]);

  const getStatusColor = (status?: string) => {
      switch (status) {
          case 'verde': return '#22c55e';
          case 'amarillo': return '#eab308';
          case 'rojo': return '#ef4444';
          default: return '#9ca3af'; 
      }
  };

  const calculateCentroid = (coords: {lat: number, lng: number}[]) => {
      if (coords.length === 0) return null;
      const total = coords.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
      return { lat: total.lat / coords.length, lng: total.lng / coords.length };
  };

  // Force map refresh when visible or exporting
  useEffect(() => {
      if ((isVisible || isExporting) && mapInstanceRef.current) {
          const timeout = isExporting ? 0 : 200;
          setTimeout(() => mapInstanceRef.current.invalidateSize(), timeout);
      }
  }, [isVisible, isExporting]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapDivRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapDivRef.current, { preferCanvas: true }).setView([-34.6037, -58.3816], 5);
    }
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tileUrl = mapType === 'satellite' 
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' 
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution: '© Google Maps', crossOrigin: true }).addTo(map);

    map.eachLayer((layer: any) => { if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline) map.removeLayer(layer); });

    const markers: any[] = [];

    // --- RENDER LOGIC ---
    if (mapColorMode === 'status') {
        const plotGroups = new Map<string, MonitoringRecord[]>();
        monitorings.forEach(m => {
            if (m.location && m.location.lat && m.location.lng && m.plotId) {
                if (!plotGroups.has(m.plotId)) plotGroups.set(m.plotId, []);
                plotGroups.get(m.plotId)?.push(m);
            }
        });

        plotGroups.forEach((plotRecs, plotId) => {
            const centroid = calculateCentroid(plotRecs.map(r => r.location!).filter(Boolean));
            if (!centroid) return;
            const plotName = plots.find(p => p.id === plotId)?.name || 'Lote';
            
            const plotSummaries = summaries.filter(s => s.plotId === plotId);
            plotSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestSummary = plotSummaries[0];
            const status = latestSummary ? (latestSummary.engineerStatus || latestSummary.status) : 'none';
            
            // --- FILTERING LOGIC ---
            // Determine the exact label this point belongs to
            let markerLabel = 'Sin Cierre';
            if (status === 'verde') markerLabel = 'Bien (Verde)';
            else if (status === 'amarillo') markerLabel = 'Alerta (Amarillo)';
            else if (status === 'rojo') markerLabel = 'Peligro (Rojo)';

            const isDimmed = activeFilter && activeFilter !== markerLabel;
            const opacity = isDimmed ? 0.2 : 1.0;
            // Boost Z-Index if it matches the filter so it stays on top
            let zIndex = status === 'rojo' ? 500 : 100;
            if (activeFilter && !isDimmed) zIndex = 1000;
            if (isDimmed) zIndex = 10;

            const color = getStatusColor(status);
            const isCritical = status === 'rojo';
            
            let markerHtml = '';
            if (status === 'rojo') {
                markerHtml = `
                  <div style="width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-bottom: 24px solid ${color}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); ${isCritical ? 'animation: pulse-tri 1.5s infinite;' : ''}"></div>
                  <div style="position: absolute; top: 12px; left: -2px; font-weight: bold; color: white; font-size: 10px;">!</div>
                  ${isCritical ? `<style>@keyframes pulse-tri { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }</style>` : ''}
                `;
            } else {
                markerHtml = `
                  <div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);"></div>
                `;
            }

            const customIcon = L.divIcon({
                className: 'custom-status-marker',
                html: markerHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const marker = L.marker([centroid.lat, centroid.lng], { icon: customIcon, zIndexOffset: zIndex, opacity })
            .addTo(map)
            .bindTooltip(`<div class="text-center leading-tight"><span class="font-bold block text-xs text-gray-900">${plotName}</span></div>`, {
                permanent: true,
                direction: 'bottom',
                offset: [0, 10],
                className: '!bg-white/90 !backdrop-blur-sm !border-gray-300 !border !shadow-sm !px-2 !py-0.5 !rounded !text-gray-800'
            });

            marker.on('click', () => {
                if (latestSummary && onSelectSummary) onSelectSummary(latestSummary);
                else marker.bindPopup(`<div class="text-sm font-sans p-1"><strong class="block mb-1 text-gray-800">${plotName}</strong><span class="text-xs text-gray-500 italic">Sin cierre registrado</span></div>`).openPopup();
            });
            markers.push(marker);
        });
    } else if (mapColorMode === 'date') {
        const validMonitorings = monitorings.filter(m => m.location && m.location.lat && m.location.lng);
        validMonitorings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const pointsToShow = showHistory 
            ? validMonitorings 
            : Array.from(validMonitorings.reduce((acc, curr) => acc.set(curr.plotId, curr), new Map()).values());

        if (showHistory) {
            const routes = new Map<string, MonitoringRecord[]>();
            validMonitorings.forEach(m => {
                const key = `${m.userId}_${getShortDate(m.date)}`;
                if (!routes.has(key)) routes.set(key, []);
                routes.get(key)?.push(m);
            });
            routes.forEach((routePoints) => {
                const latlngs = routePoints.map(m => [m.location!.lat, m.location!.lng]);
                L.polyline(latlngs, { color: '#6b7280', weight: 2, opacity: 0.5, dashArray: '5, 5' }).addTo(map);
            });
        }

        pointsToShow.forEach(m => {
            const plotName = plots.find(p => p.id === m.plotId)?.name || 'Lote';
            let opacity = 1.0;
            if (showHistory) {
                const daysDiff = (new Date().getTime() - new Date(m.date).getTime()) / (1000 * 3600 * 24);
                if (daysDiff > 7) opacity = 0.4;
                else if (daysDiff > 3) opacity = 0.7;
            }
            const color = '#3b82f6';
            const markerHtml = `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`;
            const customIcon = L.divIcon({ className: 'custom-map-marker', html: markerHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
            const marker = L.marker([m.location!.lat, m.location!.lng], { icon: customIcon, opacity })
                .addTo(map)
                .bindPopup(`<b>${plotName}</b><br/>${getShortDate(m.date)}<br/>${m.userName || ''}`);
            markers.push(marker);
        });
    } else if (mapColorMode === 'pest') {
        const validMonitorings = monitorings.filter(m => m.location && m.location.lat && m.location.lng);
        validMonitorings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const pointsToShow = showHistory 
            ? validMonitorings 
            : Array.from(validMonitorings.reduce((acc, curr) => acc.set(curr.plotId, curr), new Map()).values());

        pointsToShow.forEach(m => {
            const plotName = plots.find(p => p.id === m.plotId)?.name || 'Lote';
            let found = false;
            let valNum = 0;
            let valStr = '';
            
            if (m.pestData) {
                const pd = m.pestData.find(p => p.name === selectedPestForMap);
                if (pd) {
                    found = true;
                    valStr = String(pd.value).toLowerCase();
                    valNum = parseFloat(pd.value as string);
                }
            }

            let color = '#e5e7eb'; 
            let opacity = 1.0;
            let zIndex = 100;
            
            // --- FILTERING LOGIC ---
            let markerLabel = 'No Detectada'; // Default

            if (found) {
                if (pestAnalytics?.type === 'numeric' && pestAnalytics.ranges) {
                    const bucket = pestAnalytics.ranges.find(r => valNum >= r.min && valNum <= r.max);
                    if (bucket) {
                        color = bucket.color;
                        markerLabel = bucket.label;
                    }
                    else if (valNum > (pestAnalytics.max || 0)) {
                        color = NUMERIC_SCALE_COLORS[4];
                        markerLabel = pestAnalytics.ranges[pestAnalytics.ranges.length-1].label; // Fallback
                    }
                    else if (valNum < (pestAnalytics.min || 0)) {
                        color = NUMERIC_SCALE_COLORS[0];
                        markerLabel = pestAnalytics.ranges[0].label;
                    }
                } else {
                    if (valStr.includes('alta')) { color = '#ef4444'; markerLabel = 'Alta'; }
                    else if (valStr.includes('media')) { color = '#f97316'; markerLabel = 'Media'; }
                    else if (valStr.includes('baja')) { color = '#22c55e'; markerLabel = 'Baja / Leve'; }
                    else { color = '#3b82f6'; markerLabel = 'Detectada (Gral)'; }
                }
                zIndex = 200;
            } else {
                color = '#9ca3af';
                opacity = 0.5;
                zIndex = 50;
            }

            const isDimmed = activeFilter && activeFilter !== markerLabel;
            if (isDimmed) {
                opacity = 0.2;
                zIndex = 10;
            } else if (activeFilter) {
                zIndex = 1000;
                opacity = 1.0;
            }

            const markerHtml = `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`;
            const customIcon = L.divIcon({ className: 'custom-map-marker', html: markerHtml, iconSize: [18, 18], iconAnchor: [9, 9] });
            const pestSummary = m.pestData?.map(p => `${p.name} (${p.value} ${p.unit})`).join(', ') || 'Sin plagas';
            const marker = L.marker([m.location!.lat, m.location!.lng], { icon: customIcon, opacity, zIndexOffset: zIndex })
            .addTo(map)
            .bindPopup(`<div class="text-sm font-sans"><strong class="block mb-1 text-gray-800">${plotName}</strong><span class="text-xs text-gray-500 block">Muestra #${m.sampleNumber || '?'}</span><span class="text-xs text-gray-500 block">${getShortDate(m.date)}</span><div class="mt-2 text-xs border-t border-gray-100 pt-1"><strong class="text-gray-700">Plagas:</strong> <span class="text-gray-600">${pestSummary}</span></div></div>`);
            markers.push(marker);
        });
    }

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      // IMPORTANT: Explicitly fit bounds during export to ensure everything is captured
      if (isExporting) {
          map.fitBounds(group.getBounds(), { padding: [50, 50], animate: false });
          map.invalidateSize(); // Ensure tiles render
      } else {
          map.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    } else {
      if (isExporting) map.setView([-34.6037, -58.3816], 5, { animate: false });
    }

  }, [monitorings, plots, mapColorMode, summaries, isExporting, selectedPestForMap, pestAnalytics, activeFilter, mapType, onSelectSummary, showHistory]); 

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const LegendItem: React.FC<{ label: string; color: string }> = ({ label, color }) => {
      const isActive = activeFilter === label;
      const isDimmed = activeFilter && !isActive;
      return (
        <div onClick={() => handleLegendClick(label)} className={`flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer transition-opacity ${isDimmed ? 'opacity-40' : 'opacity-100'} ${isActive ? 'font-bold' : ''}`}>
            <span style={{ backgroundColor: color }} className={`w-3 h-3 rounded-full border border-white mr-2 shadow-sm shrink-0 ${isActive ? 'ring-2 ring-gray-400' : ''}`}></span>{label}
        </div>
      );
  };

  return (
    <div ref={wrapperRef} className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[400px] relative z-0">
      <div ref={mapDivRef} className="w-full h-full rounded-lg z-0" />
      <div className="absolute top-4 right-4 z-[400] bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <button onClick={() => setMapType(prev => prev === 'satellite' ? 'street' : 'satellite')} className="p-2 text-gray-700 dark:text-gray-300 hover:text-agro-600 dark:hover:text-agro-400 transition-colors">
            <Layers className="w-5 h-5" />
        </button>
      </div>
      
      <div className="absolute bottom-4 left-4 z-[400] bg-white/90 dark:bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 max-h-[180px] overflow-y-auto min-w-[140px]">
        {mapColorMode === 'status' && (
            <>
                <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">Semáforo</h4>
                <div className="flex flex-col gap-1">
                    <LegendItem label="Bien (Verde)" color="#22c55e" />
                    <LegendItem label="Alerta (Amarillo)" color="#eab308" />
                    <LegendItem label="Peligro (Rojo)" color="#ef4444" />
                    <LegendItem label="Sin Cierre" color="#9ca3af" />
                </div>
            </>
        )}
        {mapColorMode === 'pest' && (
            <>
                <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">{selectedPestForMap || 'Plaga'} {pestAnalytics?.unit && <span className="opacity-70">({pestAnalytics.unit})</span>}</h4>
                <div className="flex flex-col gap-1">
                    {pestAnalytics?.type === 'numeric' && pestAnalytics.ranges ? pestAnalytics.ranges.map((range, idx) => <LegendItem key={idx} label={range.label} color={range.color} />) : 
                    <>
                        <LegendItem label="Alta" color="#ef4444" />
                        <LegendItem label="Media" color="#f97316" />
                        <LegendItem label="Baja / Leve" color="#22c55e" />
                        <LegendItem label="Detectada (Gral)" color="#3b82f6" />
                    </>}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1"><LegendItem label="No Detectada" color="#9ca3af" /></div>
                </div>
            </>
        )}
        {mapColorMode === 'date' && (
            <>
                <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">Recorrida</h4>
                <div className="text-xs text-gray-500 italic">Puntos por fecha</div>
            </>
        )}
      </div>
    </div>
  );
});

MapSection.displayName = 'MapSection';
