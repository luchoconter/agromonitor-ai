
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { Search, BrainCircuit, FileSpreadsheet, X, PieChart as PieIcon, Bug, Loader2, Share2, FileDown, Map as MapIcon, BarChart2, Calendar, Layers, RotateCcw, Clock, Eye, EyeOff, LayoutList, Send, History } from 'lucide-react';
import { LotSummary } from '../types';
import { TrackSession } from '../types/tracking';
import { Button, Modal, Select } from '../components/UI';
import * as Storage from '../services/storageService';
import * as AI from '../services/geminiService';
import * as Export from '../services/exportService';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { useAuth } from '../contexts/AuthContext';
import { getPlotBudgetStats } from '../hooks/useBudgetCalculator';
import { useOfflineLotSummaries } from '../hooks/useOfflineMedia';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Subcomponents
import { KPISection } from '../components/dashboard/KPISection';
import { ChartsSection } from '../components/dashboard/ChartsSection';
import { MapSection } from '../components/dashboard/MapSection';
import { WeatherWidget } from '../components/weather/WeatherWidget';
import { LotSituationTable } from '../components/dashboard/LotSituationTable';
import { LotHistoryModal } from '../components/dashboard/LotHistoryModal';
import { LotStatusModal } from '../components/dashboard/LotStatusModal';
import { BudgetSection } from '../components/dashboard/BudgetSection';
import { HeatmapSection } from '../components/dashboard/HeatmapSection';

export const DashboardView: React.FC = () => {
    const { data, userCompanies } = useData();
    const { setView, setSelection, showNotification } = useUI();
    const { currentUser } = useAuth();

    const chartsContainerRef = useRef<HTMLDivElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const heatmapContainerRef = useRef<HTMLDivElement>(null);
    const budgetContainerRef = useRef<HTMLDivElement>(null);

    const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedFieldId, setSelectedFieldId] = useState<string>('');
    const [selectedCropId, setSelectedCropId] = useState<string>('');

    const [searchTerm, setSearchTerm] = useState('');

    // Date Range Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [visualMode, setVisualMode] = useState<'list' | 'map' | 'charts'>('list');

    const [mapColorMode, setMapColorMode] = useState<'date' | 'status' | 'pest' | 'track'>('date');
    const [showMapHistory, setShowMapHistory] = useState(false);
    const [selectedMapPest, setSelectedMapPest] = useState<string>('');
    const [selectedTrackUser, setSelectedTrackUser] = useState<string>('');

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [fileToShare, setFileToShare] = useState<File | null>(null);

    const [showAiModal, setShowAiModal] = useState(false);
    const [editableReport, setEditableReport] = useState('');

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'status' | 'name', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackItem, setFeedbackItem] = useState<LotSummary | null>(null);
    const [feedbackStatus, setFeedbackStatus] = useState<'verde' | 'amarillo' | 'rojo' | null>(null);
    const [feedbackNotes, setFeedbackNotes] = useState('');

    const [selectedSummary, setSelectedSummary] = useState<LotSummary | null>(null);

    // NEW: History Modal State
    const [historyPlotId, setHistoryPlotId] = useState<string | null>(null);

    // NEW: Tracks State
    const [tracks, setTracks] = useState<TrackSession[]>([]);

    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();

    // SECURITY
    const effectiveCompanyId = useMemo(() => {
        if (currentUser?.role === 'company' && currentUser.linkedCompanyId) {
            return currentUser.linkedCompanyId;
        }
        return selectedCompanyId;
    }, [currentUser, selectedCompanyId]);

    useEffect(() => {
        if (!selectedSeasonId && data.seasons.length > 0) {
            const active = data.seasons.find(s => s.isActive);
            setSelectedSeasonId(active ? active.id : data.seasons[0].id);
        }

        if (currentUser?.role === 'company' && currentUser.linkedCompanyId) {
            if (selectedCompanyId !== currentUser.linkedCompanyId) {
                setSelectedCompanyId(currentUser.linkedCompanyId);
            }
        }
    }, [data.seasons, currentUser]);

    // --- DYNAMIC CROP FILTER OPTIONS (CONTEXT SENSITIVE) ---
    const availableCropsForFilter = useMemo(() => {
        if (!selectedSeasonId) return [];

        // Get all assignments for the selected season
        let seasonAssignments = data.assignments.filter(a => a.seasonId === selectedSeasonId);

        // Filter assignments by Company/Field context
        const filteredAssignments = seasonAssignments.filter(a => {
            const plot = data.plots.find(p => p.id === a.plotId);
            if (!plot) return false;

            if (selectedFieldId) return plot.fieldId === selectedFieldId;

            if (effectiveCompanyId) {
                const field = data.fields.find(f => f.id === plot.fieldId);
                const plotCompId = plot.companyId || field?.companyId;
                return plotCompId === effectiveCompanyId;
            }

            return true; // Global view: show all crops that have any assignment in this season
        });

        const assignedCropIds = new Set(filteredAssignments.map(a => a.cropId));

        return data.crops
            .filter(c => assignedCropIds.has(c.id))
            .map(c => ({ value: c.id, label: c.name }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
    }, [data.assignments, data.plots, data.fields, data.crops, selectedSeasonId, effectiveCompanyId, selectedFieldId]);

    // Auto-clear crop selection if no longer valid in current context
    useEffect(() => {
        if (selectedCropId && !availableCropsForFilter.some(c => c.value === selectedCropId)) {
            setSelectedCropId('');
        }
    }, [availableCropsForFilter, selectedCropId]);

    // --- FETCH TRACKS ---
    useEffect(() => {
        if (!effectiveCompanyId) return;

        const loadTracks = async () => {
            // Default to last 7 days if no date selected
            let dFrom = dateFrom ? new Date(dateFrom) : new Date();
            let dTo = dateTo ? new Date(dateTo) : new Date();

            if (!dateFrom) {
                // If no "From" date, default to 7 days ago
                dFrom.setDate(dFrom.getDate() - 7);
                dFrom.setHours(0, 0, 0, 0);
            }

            // Limit "To" date to end of day
            dTo.setHours(23, 59, 59, 999);

            try {
                // If historic mode is OFF (implied by !dateFrom check originally?), user wants default view
                // But if they use the date pickers (historic mode), we respect them.
                const fetched = await Storage.getTracks(effectiveCompanyId, undefined, dFrom, dTo);
                setTracks(fetched);
            } catch (err) {
                console.error("Error loading tracks", err);
            }
        };

        loadTracks();
    }, [effectiveCompanyId, dateFrom, dateTo]);

    const filteredTracksForMap = useMemo(() => {
        if (!selectedTrackUser || selectedTrackUser === 'all') return tracks;
        return tracks.filter(t => t.userName === selectedTrackUser);
    }, [tracks, selectedTrackUser]);

    // --- WEATHER LOCATION INFERENCE (ROBUST) ---
    const weatherLocation = useMemo(() => {
        const targetFieldId = selectedFieldId;
        const targetCompanyId = effectiveCompanyId;

        // Sort by date desc to get the LATEST location
        const sortedMonitorings = [...data.monitorings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const relevantMonitoring = sortedMonitorings.find(m => {
            if (!m.location) return false;
            if (targetFieldId && m.fieldId !== targetFieldId) return false;
            if (targetCompanyId && m.companyId !== targetCompanyId) return false;
            return true;
        });

        if (relevantMonitoring && relevantMonitoring.location) {
            const fieldName = data.fields.find(f => f.id === relevantMonitoring.fieldId)?.name;
            return {
                lat: relevantMonitoring.location.lat,
                lng: relevantMonitoring.location.lng,
                name: fieldName || 'Campo'
            };
        }

        // Fallback: Try to find ANY plot with coordinates in the context
        if (targetFieldId) {
            const plotWithLoc = data.plots.find(p => p.fieldId === targetFieldId && p.lat && p.lng);
            if (plotWithLoc && plotWithLoc.lat && plotWithLoc.lng) {
                const fieldName = data.fields.find(f => f.id === targetFieldId)?.name;
                return { lat: plotWithLoc.lat, lng: plotWithLoc.lng, name: fieldName || 'Campo' };
            }
        }

        if (targetCompanyId) {
            // Find any plot in company
            const plotWithLoc = data.plots.find(p => p.companyId === targetCompanyId && p.lat && p.lng);
            if (plotWithLoc && plotWithLoc.lat && plotWithLoc.lng) {
                const field = data.fields.find(f => f.id === plotWithLoc.fieldId);
                return { lat: plotWithLoc.lat, lng: plotWithLoc.lng, name: field ? field.name : 'Campo' };
            }
        }

        return null;
    }, [data.monitorings, selectedFieldId, effectiveCompanyId, data.fields, data.plots]);

    const availableFields = useMemo(() => data.fields.filter(f => f.companyId === effectiveCompanyId), [data.fields, effectiveCompanyId]);

    // --- BASE FILTERS ---
    const baseFilterMatch = (item: any) => {
        if (selectedSeasonId && item.seasonId !== selectedSeasonId) return false;
        if (effectiveCompanyId && item.companyId !== effectiveCompanyId) return false;
        if (selectedFieldId && item.fieldId !== selectedFieldId) return false;
        if (selectedCropId) {
            const assignment = data.assignments.find(a => a.plotId === item.plotId && a.seasonId === item.seasonId);
            if (assignment?.cropId !== selectedCropId) return false;
        }
        return true;
    };

    const filteredMonitorings = useMemo(() => {
        return data.monitorings.filter(m => {
            if (!baseFilterMatch(m)) return false;
            const itemDateStr = m.date.split('T')[0];
            if (dateFrom && itemDateStr < dateFrom) return false;
            if (dateTo && itemDateStr > dateTo) return false;
            return true;
        });
    }, [data.monitorings, selectedSeasonId, effectiveCompanyId, selectedFieldId, selectedCropId, dateFrom, dateTo, data.assignments]);

    const availablePestsForMap = useMemo(() => {
        const pests = new Set<string>();
        filteredMonitorings.forEach(m => {
            if (m.pestData) {
                m.pestData.forEach(p => pests.add(p.name));
            } else if (m.pestIds) {
                m.pestIds.forEach(pid => {
                    const pName = data.pests.find(x => x.id === pid)?.name;
                    if (pName) pests.add(pName);
                });
            }
        });
        return Array.from(pests).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [filteredMonitorings, data.pests]);

    useEffect(() => {
        if (mapColorMode === 'pest' && !selectedMapPest && availablePestsForMap.length > 0) {
            setSelectedMapPest(availablePestsForMap[0]);
        }
    }, [mapColorMode, availablePestsForMap, selectedMapPest]);

    // Available Track Users
    const availableTrackUsers = useMemo(() => {
        const users = new Set<string>();
        tracks.forEach(t => {
            if (t.userName) users.add(t.userName);
        });
        return Array.from(users).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [tracks]);

    // Default select first user if tracks exist and no user selected
    // Default select ALL if tracks exist and no user selected
    useEffect(() => {
        if (mapColorMode === 'track' && !selectedTrackUser) {
            setSelectedTrackUser('all');
        }
    }, [mapColorMode, selectedTrackUser]);


    // FILTER SUMMARIES (For KPIs and Export)
    const filteredSummariesBase = useMemo(() => {
        let result = [...data.lotSummaries];
        result = result.filter(s => baseFilterMatch(s));

        if (dateFrom) result = result.filter(s => s.date.split('T')[0] >= dateFrom);
        if (dateTo) result = result.filter(s => s.date.split('T')[0] <= dateTo);
        return result;
    }, [data.lotSummaries, selectedSeasonId, effectiveCompanyId, selectedFieldId, selectedCropId, dateFrom, dateTo]);

    // Enriquecer summaries con audio offline
    const filteredSummaries = useOfflineLotSummaries(filteredSummariesBase);

    // DATA FOR TABLE: FILTERED PLOTS
    const filteredPlotsForTable = useMemo(() => {
        return data.plots.filter(plot => {
            const field = data.fields.find(f => f.id === plot.fieldId);
            const companyId = plot.companyId || field?.companyId;

            if (effectiveCompanyId && companyId !== effectiveCompanyId) return false;
            if (selectedFieldId && plot.fieldId !== selectedFieldId) return false;

            if (selectedCropId) {
                const assignment = data.assignments.find(a => a.plotId === plot.id && a.seasonId === selectedSeasonId);
                if (assignment?.cropId !== selectedCropId) return false;
            }

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const plotName = plot.name.toLowerCase();
                const fieldName = field?.name.toLowerCase() || '';
                return plotName.includes(term) || fieldName.includes(term);
            }
            return true;
        });
    }, [data.plots, data.fields, effectiveCompanyId, selectedFieldId, selectedCropId, searchTerm, selectedSeasonId, data.assignments]);

    // --- SORTING LOGIC ---
    // 1. Pre-calculate latest summary for each plot to avoid O(N^2) in sort
    const latestSummariesMap = useMemo(() => {
        const map = new Map<string, LotSummary>();
        filteredPlotsForTable.forEach(plot => {
            const plotSummaries = filteredSummaries.filter(s => s.plotId === plot.id);
            if (plotSummaries.length > 0) {
                // Find latest
                const latest = plotSummaries.reduce((prev, current) =>
                    (new Date(prev.date) > new Date(current.date)) ? prev : current
                );
                map.set(plot.id, latest);
            }
        });
        return map;
    }, [filteredPlotsForTable, filteredSummaries]);

    // 2. Sort Plots
    const sortedPlots = useMemo(() => {
        const sorted = [...filteredPlotsForTable];

        sorted.sort((a, b) => {
            const summaryA = latestSummariesMap.get(a.id);
            const summaryB = latestSummariesMap.get(b.id);

            // Helper for sorting by status severity
            const getSeverity = (s?: LotSummary) => {
                if (!s) return 0;
                const status = s.engineerStatus || s.status;
                if (status === 'rojo') return 3;
                if (status === 'amarillo') return 2;
                if (status === 'verde') return 1;
                return 0; // Grey/None
            };

            if (sortConfig.key === 'status') {
                const sevA = getSeverity(summaryA);
                const sevB = getSeverity(summaryB);
                if (sevA !== sevB) {
                    return sortConfig.direction === 'desc' ? sevB - sevA : sevA - sevB;
                }
                // Fallback to name if status matches
                return a.name.localeCompare(b.name);
            }

            if (sortConfig.key === 'date') {
                const dateA = summaryA ? new Date(summaryA.date).getTime() : 0;
                const dateB = summaryB ? new Date(summaryB.date).getTime() : 0;
                if (dateA !== dateB) {
                    return sortConfig.direction === 'desc' ? dateB - dateA : dateA - dateB;
                }
                return a.name.localeCompare(b.name);
            }

            if (sortConfig.key === 'name') {
                return sortConfig.direction === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            }

            return 0;
        });

        return sorted;
    }, [filteredPlotsForTable, latestSummariesMap, sortConfig]);

    const handleSort = (key: 'date' | 'status' | 'name') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // --- TIME SERIES GENERATION ---
    const healthHistoryData = useMemo(() => {
        const dates = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        const relevantPlotIds = new Set(filteredPlotsForTable.map(p => p.id));
        const contextSummaries = data.lotSummaries
            .filter(s => relevantPlotIds.has(s.plotId) && s.seasonId === selectedSeasonId)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return dates.map(dateStr => {
            const dateObj = new Date(dateStr);
            dateObj.setHours(23, 59, 59);

            let verde = 0, amarillo = 0, rojo = 0;

            relevantPlotIds.forEach(plotId => {
                let latest = null;
                for (let i = contextSummaries.length - 1; i >= 0; i--) {
                    const s = contextSummaries[i];
                    if (s.plotId === plotId && new Date(s.date) <= dateObj) {
                        latest = s;
                        break;
                    }
                }
                if (latest) {
                    const st = latest.engineerStatus || latest.status;
                    if (st === 'verde') verde++;
                    else if (st === 'amarillo') amarillo++;
                    else if (st === 'rojo') rojo++;
                }
            });

            const totalKnown = verde + amarillo + rojo;

            if (totalKnown === 0) return { date: dateStr.slice(5), verde: 0, amarillo: 0, rojo: 0 };

            return {
                date: dateStr.slice(5),
                verde: Math.round((verde / totalKnown) * 100),
                amarillo: Math.round((amarillo / totalKnown) * 100),
                rojo: Math.round((rojo / totalKnown) * 100)
            };
        });
    }, [filteredPlotsForTable, data.lotSummaries, selectedSeasonId]);

    const { pestHistoryData, topPests } = useMemo(() => {
        const dates = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        const contextMonitorings = data.monitorings.filter(m => baseFilterMatch(m));
        const pestTotalCounts: Record<string, number> = {};
        contextMonitorings.forEach(m => {
            if (m.pestData) {
                m.pestData.forEach(p => {
                    pestTotalCounts[p.name] = (pestTotalCounts[p.name] || 0) + 1;
                });
            }
        });
        const sortedPests = Object.entries(pestTotalCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(entry => entry[0]);
        const history = dates.map(dateStr => {
            const dayMonitorings = contextMonitorings.filter(m => m.date.startsWith(dateStr));
            const dayCounts: any = { date: dateStr.slice(5) };
            sortedPests.forEach(pest => dayCounts[pest] = 0);
            dayMonitorings.forEach(m => {
                m.pestData?.forEach(p => {
                    if (sortedPests.includes(p.name)) {
                        dayCounts[p.name]++;
                    }
                });
            });
            return dayCounts;
        });
        return { pestHistoryData: history, topPests: sortedPests };
    }, [data.monitorings, selectedSeasonId, effectiveCompanyId, selectedFieldId, selectedCropId]);

    const heatmapData = useMemo(() => {
        const cropMap = new Map<string, { cropName: string, counts: Record<string, number> }>();
        const pestSet = new Set<string>();
        filteredMonitorings.forEach(m => {
            const assignment = data.assignments.find(a => a.plotId === m.plotId && a.seasonId === m.seasonId);
            if (!assignment) return;
            const crop = data.crops.find(c => c.id === assignment.cropId);
            const cropName = crop?.name || 'Sin Cultivo';
            if (!cropMap.has(cropName)) cropMap.set(cropName, { cropName: cropName, counts: {} });
            const cropEntry = cropMap.get(cropName)!;
            if (m.pestData) {
                m.pestData.forEach(p => {
                    pestSet.add(p.name);
                    cropEntry.counts[p.name] = (cropEntry.counts[p.name] || 0) + 1;
                });
            }
        });
        const matrix = Array.from(cropMap.values());
        const allPests = Array.from(pestSet);
        const pestTotals: Record<string, number> = {};
        allPests.forEach(p => {
            pestTotals[p] = matrix.reduce((acc, curr) => acc + (curr.counts[p] || 0), 0);
        });
        const topHeatmapPests = allPests.sort((a, b) => pestTotals[b] - pestTotals[a]).slice(0, 8);
        return { matrix, columns: topHeatmapPests };
    }, [filteredMonitorings, data.assignments, data.crops]);

    const kpis = useMemo(() => {
        const total = filteredSummaries.length;
        const critical = filteredSummaries.filter(s => (s.engineerStatus || s.status) === 'rojo').length;
        const uniquePlotIds = new Set(filteredSummaries.map(s => s.plotId));
        let surveyedHectares = 0;
        uniquePlotIds.forEach(id => {
            const plot = data.plots.find(p => p.id === id);
            if (plot) surveyedHectares += (plot.hectares || 0);
        });
        surveyedHectares = Math.round(surveyedHectares * 10) / 10;
        return { total, critical, topPest: topPests[0] || '-', surveyedHectares };
    }, [filteredSummaries, topPests, data.plots]);

    const handleSubmitFeedback = async () => {
        if (!feedbackItem || !feedbackStatus) return;
        await Storage.updateLotSummaryFeedback(feedbackItem.id, feedbackStatus, feedbackNotes, audioBlobUrl || undefined, audioDuration);
        showNotification("Revisión guardada exitosamente.", "success");
        setIsFeedbackModalOpen(false);
    };

    const getScopeLabel = () => {
        if (selectedFieldId) return "Generar Informe Campo";
        if (effectiveCompanyId) return "Generar Informe Empresa";
        return "Informe Global";
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        let scope = "Global";
        if (effectiveCompanyId) {
            scope = `Empresa: ${userCompanies.find(c => c.id === effectiveCompanyId)?.name}`;
            if (selectedFieldId) {
                scope += `, Campo: ${data.fields.find(f => f.id === selectedFieldId)?.name}`;
            }
        }

        const engineerNotes: string[] = [];
        filteredSummaries.forEach(s => {
            const plotName = data.plots.find(p => p.id === s.plotId)?.name || 'Lote';
            if (s.engineerNotes || (s.engineerStatus || s.status) === 'rojo') {
                const status = s.engineerStatus || s.status;
                const note = s.engineerNotes ? `Nota Ingeniero: "${s.engineerNotes}"` : "Sin nota específica del ingeniero.";
                engineerNotes.push(`Lote ${plotName} (${status.toUpperCase()}): ${note}`);
            }
        });

        const context = {
            totalSummaries: filteredSummaries.length,
            statusCounts: { verde: 0, amarillo: 0, rojo: 0 },
            topPests: topPests.map(p => ({ name: p, count: 0 })),
            allNotes: engineerNotes
        };

        const report = await AI.generateDashboardAnalysis(context, scope);
        setEditableReport(report);
        setIsAnalyzing(false);
        setShowAiModal(true);
    };

    const handleExportExcel = () => {
        const exportData = filteredSummaries.map(s => {
            const company = data.companies.find(c => c.id === s.companyId)?.name || 'Desconocida';
            const field = data.fields.find(f => f.id === s.fieldId)?.name || 'Desconocido';
            const plot = data.plots.find(p => p.id === s.plotId)?.name || 'Desconocido';
            return {
                Fecha: new Date(s.date).toLocaleDateString(),
                Empresa: company,
                Campo: field,
                Lote: plot,
                'Estado Original': s.status,
                'Notas Operario': s.notes || '',
                'Revisado': s.isReviewed ? 'Sí' : 'No',
                'Estado Ingeniero': s.engineerStatus || '',
                'Feedback Ingeniero': s.engineerNotes || '',
                'Audio Operario': s.audioUrl ? 'Sí' : 'No',
                'Audio Ingeniero': s.engineerAudioUrl ? 'Sí' : 'No'
            };
        });
        const dateStr = new Date().toISOString().split('T')[0];
        Export.downloadExcel(exportData, `Cierres_Lotes_${dateStr}`);
    };

    // PDF Export Logic
    const handleExportPDF = async (action: 'download' | 'share' = 'download') => {
        // Reset previous share file if starting new export
        setFileToShare(null);

        setIsExporting(true);
        showNotification("Preparando Informe Profesional...", "success");

        // Switch to status mode for the map capture
        const previousMapMode = mapColorMode;
        setMapColorMode('status');
        // Wait for map to render fully with new mode and fitBounds
        await new Promise(resolve => setTimeout(resolve, 2500));

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const contentWidth = pageWidth - (margin * 2);
            const dateStr = new Date().toLocaleDateString();
            let yPos = 20;

            const checkPageBreak = (heightNeeded: number) => {
                if (yPos + heightNeeded > pageHeight - margin) {
                    doc.addPage();
                    yPos = 20; // Reset to top margin
                    return true;
                }
                return false;
            };

            // --- PAGE 1: EXECUTIVE SUMMARY ---
            doc.setFillColor(22, 163, 74);
            doc.rect(0, 0, pageWidth, 30, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("INFORME DE SITUACIÓN", 15, 20);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Fecha: ${dateStr}`, pageWidth - 15, 15, { align: 'right' });
            doc.text("Ing Marcon", pageWidth - 15, 22, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(15, 40, pageWidth - 30, 25, 2, 2, 'FD');

            doc.setTextColor(50, 50, 50);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("CLIENTE:", 20, 50);
            doc.text("INGENIERO:", 20, 60);
            doc.text("CAMPO:", 110, 50);

            const companyName = userCompanies.find(c => c.id === effectiveCompanyId)?.name || "Todos";
            const fieldName = data.fields.find(f => f.id === selectedFieldId)?.name || "Global";

            doc.setFont("helvetica", "normal");
            doc.text(companyName, 45, 50);
            doc.text(currentUser?.name || '-', 45, 60);
            doc.text(fieldName, 130, 50);

            doc.setFontSize(14);
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
            doc.text("1. ANÁLISIS TÉCNICO Y ESTRATEGIA", 15, 80);

            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            const splitText = doc.splitTextToSize(editableReport || "Sin análisis generado.", pageWidth - 30);
            doc.text(splitText, 15, 90);

            yPos = 90 + (splitText.length * 5) + 10;

            // MAP CAPTURE
            if (mapContainerRef.current) {
                checkPageBreak(100);
                doc.setFontSize(14);
                doc.setTextColor(22, 163, 74);
                doc.setFont("helvetica", "bold");
                doc.text("3. MAPA DE SITUACIÓN", 15, yPos);
                yPos += 5;

                try {
                    const mapCanvas = await html2canvas(mapContainerRef.current, { useCORS: true, scale: 2 });
                    const mapImg = mapCanvas.toDataURL('image/png');
                    const mapRatio = mapCanvas.height / mapCanvas.width;
                    const mapHeight = Math.min((pageWidth - 30) * mapRatio, 120); // Cap height
                    doc.addImage(mapImg, 'PNG', 15, yPos, pageWidth - 30, mapHeight);
                    yPos += mapHeight + 15;
                } catch (e) {
                    console.warn("Map capture failed", e);
                    doc.setFontSize(10);
                    doc.setTextColor(150, 150, 150);
                    doc.text("[Mapa no disponible]", 15, yPos + 10);
                    yPos += 20;
                }
            }

            // CHARTS CAPTURE
            if (chartsContainerRef.current) {
                checkPageBreak(90);
                doc.setFontSize(14);
                doc.setTextColor(22, 163, 74);
                doc.setFont("helvetica", "bold");
                doc.text("4. GRÁFICOS DE EVOLUCIÓN", 15, yPos);
                yPos += 10;

                try {
                    const chartsCanvas = await html2canvas(chartsContainerRef.current, { scale: 2 });
                    const chartsImg = chartsCanvas.toDataURL('image/png');
                    const chartsHeight = 70;
                    doc.addImage(chartsImg, 'PNG', 15, yPos, pageWidth - 30, chartsHeight);
                    yPos += chartsHeight + 15;
                } catch (e) {
                    console.warn("Charts capture failed", e);
                }
            }

            // HEATMAP CAPTURE
            if (heatmapContainerRef.current && heatmapData.matrix.length > 0) {
                checkPageBreak(90);
                doc.setFontSize(14);
                doc.setTextColor(22, 163, 74);
                doc.setFont("helvetica", "bold");
                doc.text("5. MATRIZ DE FOCOS (CULTIVO vs PLAGA)", 15, yPos);
                yPos += 10;

                try {
                    const hmCanvas = await html2canvas(heatmapContainerRef.current, { scale: 2 });
                    const hmImg = hmCanvas.toDataURL('image/png');
                    const hmRatio = hmCanvas.height / hmCanvas.width;
                    const hmHeight = Math.min((pageWidth - 30) * hmRatio, 100);
                    doc.addImage(hmImg, 'PNG', 15, yPos, pageWidth - 30, hmHeight);
                    yPos += hmHeight + 15;
                } catch (e) {
                    console.warn("Heatmap capture failed", e);
                }
            }

            // BUDGET CAPTURE
            if (budgetContainerRef.current) {
                checkPageBreak(120);
                doc.setFontSize(14);
                doc.setTextColor(22, 163, 74);
                doc.setFont("helvetica", "bold");
                doc.text("6. EJECUCIÓN PRESUPUESTARIA", 15, yPos);
                yPos += 10;

                try {
                    const budCanvas = await html2canvas(budgetContainerRef.current, { scale: 2 });
                    const budImg = budCanvas.toDataURL('image/png');
                    const budRatio = budCanvas.height / budCanvas.width;
                    const budHeight = Math.min((pageWidth - 30) * budRatio, 120);
                    doc.addImage(budImg, 'PNG', 15, yPos, pageWidth - 30, budHeight);
                    yPos += budHeight + 15;
                } catch (e) {
                    console.warn("Budget capture failed", e);
                }
            }

            // DETAILS TABLE
            checkPageBreak(40);
            doc.setFontSize(14);
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
            doc.text("7. ESTADO DETALLADO DE LOTES", 15, yPos);
            yPos += 8;

            doc.setFillColor(240, 240, 240);
            doc.rect(15, yPos, pageWidth - 30, 8, 'F');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text("LOTE", 18, yPos + 5);
            doc.text("ESTADO", 60, yPos + 5);
            doc.text("PRESUPUESTO", 85, yPos + 5);
            doc.text("NOTA INGENIERO", 125, yPos + 5);
            doc.text("RECETA", 185, yPos + 5);
            yPos += 8;

            doc.setFont("helvetica", "normal");
            filteredPlotsForTable.forEach((plot) => {
                if (yPos > pageHeight - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                const summary = filteredSummaries.find(s => s.plotId === plot.id);
                const status = summary ? (summary.engineerStatus || summary.status) : '-';

                let statusColor = [200, 200, 200];
                if (status === 'verde') statusColor = [34, 197, 94];
                if (status === 'amarillo') statusColor = [234, 179, 8];
                if (status === 'rojo') statusColor = [239, 68, 68];

                doc.setDrawColor(230, 230, 230);
                doc.line(15, yPos + 8, pageWidth - 15, yPos + 8);

                doc.setTextColor(0, 0, 0);
                doc.text(plot.name, 18, yPos + 5);

                doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
                doc.circle(63, yPos + 4, 2, 'F');
                doc.text(status.toUpperCase(), 68, yPos + 5);

                const assignment = data.assignments.find(a => a.plotId === plot.id && a.seasonId === selectedSeasonId);
                let budgetText = "-";
                if (assignment && assignment.budget) {
                    const stats = getPlotBudgetStats(plot, assignment, data.prescriptions, data.agrochemicals);
                    budgetText = `$${Math.round(stats.spent)} / $${stats.totalBudget}`;
                    if (stats.isOverBudget) doc.setTextColor(220, 38, 38);
                    else doc.setTextColor(0, 0, 0);
                } else {
                    doc.setTextColor(150, 150, 150);
                }
                doc.text(budgetText, 85, yPos + 5);
                doc.setTextColor(0, 0, 0);

                const note = summary?.engineerNotes || summary?.notes || "-";
                const noteLines = doc.splitTextToSize(note, 55);
                doc.text(noteLines[0] + (noteLines.length > 1 ? '...' : ''), 125, yPos + 5);

                const hasRecipe = data.prescriptions.some(p => p.plotIds.includes(plot.id) && p.status === 'active');
                doc.text(hasRecipe ? "Sí" : "-", 187, yPos + 5);

                yPos += 8;
            });

            const totalPages = (doc.internal as any).getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            const fileName = `Informe_${companyName.replace(/\s/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`;

            if (action === 'download') {
                doc.save(fileName);
                showNotification("PDF Descargado", "success");
            } else {
                // STEP 1 of 2: Generate and Prepare File, but DO NOT SHARE yet (to avoid gesture error)
                const pdfBlob = doc.output('blob');
                const file = new File([pdfBlob], fileName, { type: "application/pdf" });
                setFileToShare(file);
                showNotification("Informe generado. Pulsa 'Enviar Ahora' para compartir.", "success");
            }

        } catch (error) {
            console.error(error);
            showNotification("Error al generar el reporte", "error");
        } finally {
            setMapColorMode(previousMapMode);
            setIsExporting(false);
        }
    };

    // STEP 2 of 2: Trigger Native Share with Fresh User Gesture
    const triggerNativeShare = async () => {
        if (!fileToShare) return;
        try {
            if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
                await navigator.share({
                    files: [fileToShare],
                    title: 'Informe Agronómico',
                    text: 'Adjunto el informe de situación.',
                });
            } else {
                showNotification("Tu dispositivo no soporta compartir este archivo.", "warning");
            }
        } catch (e) {
            console.log("Share cancelled or failed", e);
        } finally {
            setFileToShare(null); // Reset state
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    Dashboard Agronómico
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button variant="secondary" onClick={handleExportExcel} className="w-full sm:w-auto text-xs font-bold" disabled={filteredSummaries.length === 0}>
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> EXCEL
                    </Button>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || filteredSummaries.length === 0} className="bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/30 shadow-lg border-none w-full sm:w-auto">
                        {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                        {isAnalyzing ? 'Analizando...' : getScopeLabel()}
                    </Button>
                </div>
            </div>

            {weatherLocation && (
                <div className="mb-4 animate-fade-in">
                    <WeatherWidget
                        lat={weatherLocation.lat}
                        lng={weatherLocation.lng}
                        locationName={weatherLocation.name}
                    />
                </div>
            )}

            {/* <KPISection total={kpis.total} critical={kpis.critical} topPest={kpis.topPest} surveyedHectares={kpis.surveyedHectares} /> */}

            <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                    <Select label="" placeholder="Campaña..." options={data.seasons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(s => ({ value: s.id, label: s.name }))} value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)} className="text-xs h-10" />
                    <Select label="" placeholder="Empresa..." options={userCompanies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))} value={effectiveCompanyId || ''} onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedFieldId(''); }} className="text-xs h-10" disabled={currentUser?.role === 'company'} />
                    <Select label="" placeholder="Campo..." options={availableFields.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))} value={selectedFieldId} onChange={(e) => { setSelectedFieldId(e.target.value); }} disabled={!effectiveCompanyId} className="text-xs h-10" />

                    {/* DYNAMIC CROP SELECTOR */}
                    <Select label="" placeholder="Cultivo..." options={availableCropsForFilter} value={selectedCropId} onChange={(e) => setSelectedCropId(e.target.value)} className="text-xs h-10" />
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                {visualMode === 'map' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setMapColorMode('date')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${mapColorMode === 'date' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                <Calendar className="w-3 h-3 mr-1.5" /> Puntos
                            </button>
                            <button onClick={() => setMapColorMode('status')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${mapColorMode === 'status' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                <Layers className="w-3 h-3 mr-1.5" /> Semáforo
                            </button>
                            <button onClick={() => setMapColorMode('pest')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${mapColorMode === 'pest' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                <Bug className="w-3 h-3 mr-1.5" /> Plaga
                            </button>
                            <button onClick={() => setMapColorMode('track')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${mapColorMode === 'track' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                <History className="w-3 h-3 mr-1.5" /> Recorrido
                            </button>
                        </div>
                        {mapColorMode === 'pest' && (
                            <div className="w-full md:w-48">
                                <Select label="" options={availablePestsForMap.map(p => ({ value: p, label: p }))} value={selectedMapPest} onChange={(e) => setSelectedMapPest(e.target.value)} placeholder="Seleccionar plaga..." className="text-xs h-9 py-1" />
                            </div>
                        )}
                        {mapColorMode === 'track' && (
                            <div className="w-full md:w-48">
                                <Select
                                    label=""
                                    options={[
                                        { value: 'all', label: 'Todos los usuarios' },
                                        ...availableTrackUsers.map(u => ({ value: u, label: u }))
                                    ]}
                                    value={selectedTrackUser}
                                    onChange={(e) => setSelectedTrackUser(e.target.value)}
                                    placeholder="Usuario..."
                                    className="text-xs h-9 py-1"
                                />
                            </div>
                        )}
                    </div>
                ) : <div className="hidden md:block"></div>}

                <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                    {visualMode === 'map' && mapColorMode !== 'status' && (
                        <div className="flex flex-wrap items-center gap-2 mr-2">
                            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                                <button onClick={() => setShowMapHistory(false)} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${!showMapHistory ? 'bg-gray-100 dark:bg-gray-700 text-agro-600 dark:text-agro-400' : 'text-gray-500'}`}>Actual</button>
                                <button onClick={() => setShowMapHistory(true)} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${showMapHistory ? 'bg-gray-100 dark:bg-gray-700 text-agro-600 dark:text-agro-400' : 'text-gray-500'}`}>Histórico</button>
                            </div>
                            {showMapHistory && (
                                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 px-2 animate-fade-in">
                                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-xs text-gray-700 dark:text-gray-200 outline-none w-24" />
                                    <span className="text-gray-400 text-xs">-</span>
                                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-xs text-gray-700 dark:text-gray-200 outline-none w-24" />
                                    {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="ml-1 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>}
                                </div>
                            )}
                        </div>
                    )}

                    <span className="text-xs font-bold text-gray-500 uppercase hidden sm:inline">Vista:</span>
                    <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full sm:w-auto">
                        <button onClick={() => setVisualMode('list')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${visualMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                            <LayoutList className="w-3 h-3 mr-1.5" /> Listado
                        </button>
                        <button onClick={() => setVisualMode('map')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${visualMode === 'map' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                            <MapIcon className="w-3 h-3 mr-1.5" /> Mapa
                        </button>
                        <button onClick={() => setVisualMode('charts')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${visualMode === 'charts' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                            <BarChart2 className="w-3 h-3 mr-1.5" /> Gráficos
                        </button>
                    </div>
                </div>
            </div>

            {/* --- SECTION 1: CHARTS (Graphs, Heatmap, Budget) --- */}
            <div style={{ display: (visualMode === 'charts' || isExporting) ? 'block' : 'none' }}>
                <ChartsSection
                    ref={chartsContainerRef}
                    healthHistory={healthHistoryData}
                    pestHistory={pestHistoryData}
                    topPests={topPests}
                    forceLightMode={isExporting}
                />

                {/* HEATMAP SECTION (PROPUESTA 4) */}
                <div className="mt-4" ref={heatmapContainerRef}>
                    <HeatmapSection matrix={heatmapData.matrix} columns={heatmapData.columns} />
                </div>

                {/* BUDGET SECTION (PROPUESTA 2) */}
                <div className="mt-6" ref={budgetContainerRef}>
                    <BudgetSection
                        seasonId={selectedSeasonId}
                        companyId={effectiveCompanyId}
                    />
                </div>
            </div>

            {/* 3. MAP SECTION */}
            <div ref={mapContainerRef} style={{ display: (visualMode === 'map' || isExporting) ? 'block' : 'none' }}>
                <MapSection
                    ref={mapContainerRef}
                    monitorings={filteredMonitorings}
                    plots={filteredPlotsForTable}
                    fields={data.fields}
                    groups={data.plotGroups}
                    mapColorMode={mapColorMode}
                    isVisible={visualMode === 'map' || isExporting}
                    selectedPestForMap={selectedMapPest}
                    summaries={filteredSummaries}
                    assignments={data.assignments}
                    crops={data.crops}
                    seasonId={selectedSeasonId}
                    isExporting={isExporting}
                    // onSelectSummary={setSelectedSummary} // Disable auto select for now during map view?
                    showHistory={showMapHistory}
                    tracks={filteredTracksForMap}
                    onOpenHistory={(pid) => {
                        setHistoryPlotId(pid);
                    }}
                />
            </div>


            {/* --- SECTION 3: LIST (Table) --- */}
            <div style={{ display: (visualMode === 'list' || isExporting) ? 'block' : 'none' }} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input type="text" placeholder="Buscar lote..." className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm focus:ring-2 focus:ring-agro-500 outline-none text-gray-800 dark:text-white transition-all h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                <div className="overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">Situación de Lotes</h3>
                    <LotSituationTable
                        plots={sortedPlots}
                        summaries={filteredSummaries}
                        prescriptions={data.prescriptions}
                        data={data}
                        showCompanyCol={!effectiveCompanyId}
                        showFieldCol={!selectedFieldId}
                        currentUser={currentUser}
                        onOpenHistory={setHistoryPlotId}
                        seasonId={selectedSeasonId}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                    />
                </div>
            </div>

            <LotStatusModal
                isOpen={!!selectedSummary}
                onClose={() => setSelectedSummary(null)}
                summary={selectedSummary}
                data={data}
                currentUser={currentUser}
            />

            <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title="Revisión Técnica">
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">{['verde', 'amarillo', 'rojo'].map((status) => (<button key={status} onClick={() => setFeedbackStatus(status as any)} className={`p-2 rounded-lg border-2 font-bold text-xs uppercase ${feedbackStatus === status ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>{status}</button>))}</div>
                    <textarea className="w-full border rounded-lg p-2 h-24" placeholder="Escriba su devolución..." value={feedbackNotes} onChange={(e) => setFeedbackNotes(e.target.value)} />
                    <div onClick={toggleRecording} className={`border-2 border-dashed rounded-xl h-16 flex items-center justify-center cursor-pointer ${isRecording ? 'border-red-500 bg-red-50' : ''}`}>{isRecording ? 'Grabando...' : `Grabar Audio (${audioDuration}s)`}</div>
                    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setIsFeedbackModalOpen(false)}>Cancelar</Button><Button onClick={handleSubmitFeedback}>Guardar</Button></div>
                </div>
            </Modal>

            <Modal isOpen={showAiModal} onClose={() => setShowAiModal(false)} title="Análisis de IA (Editable)">
                <div className="space-y-4">
                    <textarea value={editableReport} onChange={(e) => setEditableReport(e.target.value)} className="w-full h-80 p-4 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-agro-500" />
                    <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <Button variant="ghost" onClick={() => { setShowAiModal(false); setFileToShare(null); }}>Cerrar</Button>

                        {/* 2-STEP SHARE BUTTON LOGIC */}
                        {fileToShare ? (
                            <Button onClick={triggerNativeShare} className="bg-green-600 hover:bg-green-700 text-white animate-pulse">
                                <Send className="w-4 h-4 mr-2" /> Enviar Ahora
                            </Button>
                        ) : (
                            <Button variant="secondary" onClick={() => handleExportPDF('share')} disabled={isExporting}>
                                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                                {isExporting ? 'Generando...' : 'Compartir'}
                            </Button>
                        )}

                        <Button onClick={() => handleExportPDF('download')} disabled={isExporting}><FileDown className="w-4 h-4 mr-2" /> Exportar PDF</Button>
                    </div>
                </div>
            </Modal>

            {historyPlotId && (
                <LotHistoryModal
                    plotId={historyPlotId}
                    onClose={() => setHistoryPlotId(null)}
                    data={data}
                />
            )}
        </div>
    );
};
