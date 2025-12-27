import React, { useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonitoringRecord, Plot, LotSummary, PlotAssignment, Crop, Field } from '../../types';
import { TrackSession } from '../../types/tracking';
import { calculateDistance } from '../../services/trackingService';
import { Layers, Maximize2, Minimize2, Circle as CircleIcon, Square, BookOpen } from 'lucide-react';
import { useData } from '../../contexts/DataContext';

interface MapSectionProps {
    monitorings: MonitoringRecord[];
    plots: Plot[];
    fields?: Field[]; // New
    assignments?: PlotAssignment[];
    crops?: Crop[];
    seasonId?: string;
    isVisible?: boolean;
    mapColorMode?: 'date' | 'status' | 'pest' | 'track';
    selectedPestForMap?: string;
    summaries?: LotSummary[];
    isExporting?: boolean;
    onSelectSummary?: (summary: LotSummary) => void;
    showHistory?: boolean;
    tracks?: TrackSession[];
    onOpenHistory?: (plotId: string) => void;
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
    fields = [], // New
    isVisible = true,
    mapColorMode = 'date',
    selectedPestForMap = '',
    summaries = [],
    isExporting = false,
    onSelectSummary,
    showHistory = false,
    assignments = [],
    crops = [],
    seasonId = '',
    tracks = [],
    onOpenHistory
}, ref) => {
    const { data } = useData();
    const mapDivRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const tileLayerRef = useRef<any>(null);

    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite');
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => { setActiveFilter(null); }, [mapColorMode, selectedPestForMap, monitorings, showHistory]);

    // Helper to get crop icon (centralized)
    const getCropIcon = (cropName: string) => {
        const n = cropName.toLowerCase();
        if (n.includes('maiz') || n.includes('maíz')) return '🌽';
        if (n.includes('soja') || n.includes('soy')) return '🌿';
        if (n.includes('trigo') || n.includes('cebada') || n.includes('avena') || n.includes('centeno')) return '🌾';
        if (n.includes('girasol')) return '🌻';
        if (n.includes('algodon') || n.includes('algodón')) return '☁️';
        if (n.includes('sorgo')) return '🎋';
        if (n.includes('papa')) return '🥔';
        if (n.includes('arroz')) return '🥘';
        return '🌱';
    };

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

    const calculateCentroid = (coords: { lat: number, lng: number }[]) => {
        if (coords.length === 0) return null;
        const total = coords.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
        return { lat: total.lat / coords.length, lng: total.lng / coords.length };
    };

    // --- DYNAMIC CROPS ---
    const uniqueCrops = useMemo(() => {
        const cropSet = new Set<string>();
        plots.forEach(p => {
            if (seasonId) {
                const assignment = assignments.find(a => a.plotId === p.id && a.seasonId === seasonId);
                if (assignment) {
                    const crop = crops.find(c => c.id === assignment.cropId);
                    if (crop) cropSet.add(crop.name);
                }
            }
        });
        return Array.from(cropSet).sort();
    }, [plots, assignments, crops, seasonId]);

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

        // Re-initialize map if container changed (e.g. Portal move)
        if (mapInstanceRef.current && mapInstanceRef.current.getContainer() !== mapDivRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

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
            const monitoringsMap = new Map<string, MonitoringRecord[]>();
            monitorings.forEach(m => {
                if (m.plotId) {
                    if (!monitoringsMap.has(m.plotId)) monitoringsMap.set(m.plotId, []);
                    monitoringsMap.get(m.plotId)?.push(m);
                }
            });

            plots.forEach((plot) => {
                if (!plot || plot.lat === undefined || plot.lng === undefined) return;
                const plotId = plot.id;

                // We use specific plot location, or fallback to monitoring location if strict plot location missing (though we check plot.lat above)
                // actually we only use plot.lat/lng now as per requirement.

                // Logic to get status
                // We can't rely on plotGroups loop anymore

                const plotName = plot.name;
                const centroid = { lat: plot.lat, lng: plot.lng };

                const plotSummaries = summaries.filter(s => s.plotId === plotId);
                plotSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const latestSummary = plotSummaries[0];
                const status = latestSummary ? (latestSummary.engineerStatus || latestSummary.status) : 'none';

                // --- CROP ICON LOGIC (Moved up for filtering) ---
                let cropName = 'Sin Cultivo';
                let cropIcon = '🌱'; // Default generic
                if (seasonId) {
                    const assignment = assignments.find(a => a.plotId === plotId && a.seasonId === seasonId);
                    if (assignment) {
                        const crop = crops.find(c => c.id === assignment.cropId);
                        if (crop) {
                            cropName = crop.name;
                            cropIcon = getCropIcon(crop.name);
                        }
                    }
                }

                // --- FILTERING LOGIC ---
                // Determine the exact label this point belongs to
                let markerLabel = 'Sin Cierre';
                if (status === 'verde') markerLabel = 'Bien (Verde)';
                else if (status === 'amarillo') markerLabel = 'Alerta (Amarillo)';
                else if (status === 'rojo') markerLabel = 'Peligro (Rojo)';

                const isDimmed = activeFilter && activeFilter !== markerLabel && activeFilter !== cropName;
                const opacity = isDimmed ? 0.1 : 1.0;
                // Boost Z-Index if it matches the filter so it stays on top
                let zIndex = status === 'rojo' ? 500 : 100;
                if (activeFilter) {
                    if (!isDimmed) zIndex = 5000;
                    else zIndex = -100;
                }

                const color = getStatusColor(status);
                const isCritical = status === 'rojo';

                // --- CROP ICON LOGIC (Already calculated above) ---

                // Check pending recipes
                const pendingRecipesDetails = data?.prescriptions?.filter(p =>
                    p.status !== 'archived' &&
                    p.plotIds.includes(plotId) &&
                    !p.executionData?.[plotId]?.executed
                ) || [];
                const pendingCount = pendingRecipesDetails.length;

                const markerHtml = `
                  <div style="
                    background-color: ${color}; 
                    width: 30px; height: 30px; 
                    border-radius: 50%; 
                    border: 2px solid white; 
                    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 18px;
                    line-height: 1;
                    position: relative;
                    ${isCritical ? 'animation: pulse 2s infinite;' : ''}
                  ">
                    ${cropIcon}
                    ${pendingCount > 0 ? `
                        <div style="
                            position: absolute;
                            top: -6px;
                            right: -6px;
                            background-color: #ef4444;
                            color: white;
                            font-size: 10px;
                            font-weight: bold;
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border: 2px solid white;
                            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                            z-index: 10;
                        ">
                            ${pendingCount}
                        </div>
                    ` : ''}
                  </div>
                  ${isCritical ? `<style>@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }</style>` : ''}
                `;

                const customIcon = L.divIcon({
                    className: 'custom-status-marker',
                    html: markerHtml,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                const fieldName = fields.find(f => f.id === plot.fieldId)?.name || '?';

                const marker = L.marker([centroid.lat, centroid.lng], { icon: customIcon, zIndexOffset: zIndex, opacity })
                    .addTo(map);

                // Show label only if not dimmed (filtered out) to avoid saturation
                if (!isDimmed) {
                    marker.bindTooltip(`<div class="text-center leading-none"><span class="font-bold block text-xs text-gray-900">${plotName}</span></div>`, {
                        permanent: true,
                        direction: 'bottom',
                        offset: [0, 16],
                        className: '!bg-white/95 !backdrop-blur-sm !border-gray-300 !border !shadow-sm !px-1.5 !py-0.5 !rounded !text-gray-800'
                    });
                }

                const popupContent = document.createElement('div');
                popupContent.innerHTML = `
                    <div class="text-sm font-sans p-1 min-w-[150px]">
                        <strong class="block mb-2 text-gray-800 text-center border-b pb-1">${plotName}</strong>
                        <div class="flex flex-col gap-2">
                             <button id="btn-history-${plotId}" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded w-full flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                                BITÁCORA
                             </button>
                             <button id="btn-status-${plotId}" class="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-1.5 px-3 rounded w-full flex items-center justify-center gap-2 border border-gray-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                                SITUACIÓN LOTE
                             </button>
                        </div>
                    </div>
                `;

                marker.bindPopup(popupContent);

                marker.on('popupopen', () => {
                    const btnHistory = document.getElementById(`btn-history-${plotId}`);
                    const btnStatus = document.getElementById(`btn-status-${plotId}`);

                    if (btnHistory) {
                        btnHistory.onclick = (e) => {
                            e.stopPropagation();
                            if (onOpenHistory) onOpenHistory(plotId);
                            map.closePopup();
                        };
                    }

                    if (btnStatus) {
                        btnStatus.onclick = (e) => {
                            e.stopPropagation();
                            if (latestSummary && onSelectSummary) {
                                onSelectSummary(latestSummary);
                            } else {
                                // Fallback if no summary, maybe show toast? For now just try.
                                const fakeSummary = { plotId, fieldId: plot.fieldId, date: new Date().toISOString(), status: 'none' } as any;
                                if (onSelectSummary) onSelectSummary(fakeSummary);
                            }
                            map.closePopup();
                        };
                    }
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
                            markerLabel = pestAnalytics.ranges[pestAnalytics.ranges.length - 1].label; // Fallback
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

        // --- TRACKS RENDERING ---
        if (tracks.length > 0) {
            tracks.forEach(track => {
                if (!track.points || track.points.length === 0) return;

                // 1. Draw Polyline
                const latlngs = track.points.map(p => [p.lat, p.lng] as [number, number]);
                const polyline = L.polyline(latlngs, {
                    color: '#8b5cf6', // Violeta
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '10, 10'
                }).addTo(map);

                polyline.bindPopup(`<b>Recorrido: ${track.userName}</b><br/>${getShortDate(track.startTime)}<br/>Distancia: ${track.distance.toFixed(2)} km`);
                markers.push(polyline); // Add to markers to fit bounds if needed

                // 2. Stop Detection Algorithm (> 1 min in 30m radius)
                const STOPS_THRESHOLD_KM = 0.03; // 30 meters
                const STOP_MIN_MINUTES = 1;

                let groupStartIdx = 0;

                for (let i = 1; i < track.points.length; i++) {
                    const pStart = track.points[groupStartIdx];
                    const pCurr = track.points[i];

                    const dist = calculateDistance(pStart.lat, pStart.lng, pCurr.lat, pCurr.lng);

                    if (dist > STOPS_THRESHOLD_KM) {
                        // Check duration of previous group
                        const startTime = track.points[groupStartIdx].timestamp;
                        const endTime = track.points[i - 1].timestamp;
                        const durationMins = (endTime - startTime) / 1000 / 60;

                        if (durationMins >= STOP_MIN_MINUTES) {
                            // Add STOP Marker
                            const markerHtml = `
                                <div style="background-color: #ef4444; color: white; border-radius: 4px; padding: 2px 4px; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">
                                    STOP ${Math.round(durationMins)}m
                                </div>
                            `;
                            const customIcon = L.divIcon({
                                className: 'custom-stop-marker',
                                html: markerHtml,
                                iconSize: [60, 20],
                                iconAnchor: [30, 25] // Offset above
                            });

                            const stopMarker = L.marker([pStart.lat, pStart.lng], { icon: customIcon, zIndexOffset: 1000 })
                                .addTo(map)
                                .bindPopup(`<b>Parada: ${Math.round(durationMins)} min</b><br/>Hora: ${new Date(startTime).toLocaleTimeString()}`);

                            markers.push(stopMarker);
                        }
                        groupStartIdx = i;
                    }
                }

                // Check last group
                const lastIdx = track.points.length - 1;
                const lastStartTime = track.points[groupStartIdx].timestamp;
                const lastEndTime = track.points[lastIdx].timestamp;
                const lastDuration = (lastEndTime - lastStartTime) / 1000 / 60;

                if (lastDuration >= STOP_MIN_MINUTES) {
                    const pStart = track.points[groupStartIdx];
                    const markerHtml = `
                        <div style="background-color: #ef4444; color: white; border-radius: 4px; padding: 2px 4px; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">
                            STOP ${Math.round(lastDuration)}m
                        </div>
                    `;
                    const customIcon = L.divIcon({
                        className: 'custom-stop-marker',
                        html: markerHtml,
                        iconSize: [60, 20],
                        iconAnchor: [30, 25]
                    });
                    const stopMarker = L.marker([pStart.lat, pStart.lng], { icon: customIcon, zIndexOffset: 1000 })
                        .addTo(map)
                        .bindPopup(`<b>Parada: ${Math.round(lastDuration)} min</b><br/>Hora: ${new Date(lastStartTime).toLocaleTimeString()}`);
                    markers.push(stopMarker);
                }
            });
        }

    }, [monitorings, plots, mapColorMode, summaries, isExporting, selectedPestForMap, pestAnalytics, activeFilter, mapType, onSelectSummary, showHistory, isMaximized, tracks]);

    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const LegendItem: React.FC<{ label: string; color?: string; icon?: string }> = ({ label, color, icon }) => {
        const isActive = activeFilter === label;
        const isDimmed = activeFilter && !isActive;
        return (
            <div onClick={() => handleLegendClick(label)} className={`flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer transition-opacity ${isDimmed ? 'opacity-40' : 'opacity-100'} ${isActive ? 'font-bold' : ''}`}>
                {color && <span style={{ backgroundColor: color }} className={`w-3 h-3 rounded-full border border-white mr-2 shadow-sm shrink-0 ${isActive ? 'ring-2 ring-gray-400' : ''}`}></span>}
                {icon && <span className="text-sm mr-1.5">{icon}</span>}
                {label}
            </div>
        );
    };

    const mapContent = (
        <div ref={wrapperRef} className={`bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-300 ${isMaximized ? 'fixed inset-0 z-[99999] h-screen w-screen rounded-none border-none m-0' : 'relative z-0 h-[400px]'}`}>
            <div ref={mapDivRef} className="w-full h-full rounded-lg z-0" />
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setIsMaximized(prev => !prev)} className="p-2 text-gray-700 dark:text-gray-300 hover:text-agro-600 dark:hover:text-agro-400 transition-colors" title={isMaximized ? "Minimizar" : "Maximizar"}>
                        {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <div className="h-px bg-gray-200 dark:bg-gray-700 w-full" />
                    <button onClick={() => setMapType(prev => prev === 'satellite' ? 'street' : 'satellite')} className="p-2 text-gray-700 dark:text-gray-300 hover:text-agro-600 dark:hover:text-agro-400 transition-colors" title="Cambiar mapa">
                        <Layers className="w-5 h-5" />
                    </button>
                </div>
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
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
                        <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">Cultivos</h4>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                            {uniqueCrops.length > 0 ? (
                                uniqueCrops.map(crop => (
                                    <LegendItem key={crop} label={crop} icon={getCropIcon(crop)} />
                                ))
                            ) : (
                                <div className="text-xs text-gray-400 italic col-span-2">Sin cultivos asignados</div>
                            )}
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
                {mapColorMode === 'track' && (
                    <>
                        <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">Recorrido</h4>
                        <div className="flex flex-col gap-1">
                            <LegendItem label="Trayecto" color="#8b5cf6" />
                            <div className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                                <span className="w-10 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded mr-2">STOP</span>
                                Parada (+1min)
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    if (isMaximized) {
        return createPortal(mapContent, document.body);
    }

    return mapContent;
});

MapSection.displayName = 'MapSection';
