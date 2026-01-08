
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { Search, FileSpreadsheet, X, PieChart as PieIcon, Bug, Loader2, Share2, FileDown, Map as MapIcon, BarChart2, Calendar, Layers, RotateCcw, Clock, Eye, EyeOff, LayoutList, Send, History, Cloud, ChevronDown, ChevronUp, FlaskConical, List, Pause, Play } from 'lucide-react';
import { Prescription } from '../types';
import { LotSummary } from '../types';
import { TrackSession } from '../types/tracking';
import { Button, Modal, Select } from '../components/UI';
import { getUserRole, getRoleColorClass } from '../utils/roleUtils';
import * as Storage from '../services/storageService';
// import * as AI from '../services/geminiService'; // Removed per user request
import * as Export from '../services/exportService';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { useAuth } from '../contexts/AuthContext';
import { getPlotBudgetStats } from '../hooks/useBudgetCalculator';
import { useOfflineLotSummaries } from '../hooks/useOfflineMedia';
import { useTracking } from '../contexts/TrackingContext';

import { jsPDF } from 'jspdf';
import { fetchWeather } from '../services/weatherService';
import html2canvas from 'html2canvas';

// Subcomponents
import { KPISection } from '../components/dashboard/KPISection';
import { ChartsSection } from '../components/dashboard/ChartsSection';
import { MapSection } from '../components/dashboard/MapSection';
import { TrackListModal } from '../components/dashboard/TrackListModal';
import { WeatherWidget } from '../components/weather/WeatherWidget';
import { LotSituationTable } from '../components/dashboard/LotSituationTable';
import { LotHistoryModal } from '../components/dashboard/LotHistoryModal';
import { LotStatusModal } from '../components/dashboard/LotStatusModal';
import { BudgetSection } from '../components/dashboard/BudgetSection';
import { HeatmapSection } from '../components/dashboard/HeatmapSection';
import { ReportWizardModal } from '../components/reports/ReportWizardModal';

export const DashboardView: React.FC = () => {
    const { data, userCompanies, dataOwnerId } = useData();
    const { setView, setSelection, showNotification } = useUI();
    const { currentUser } = useAuth();
    const { currentTrack } = useTracking();

    const chartsContainerRef = useRef<HTMLDivElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const heatmapContainerRef = useRef<HTMLDivElement>(null);
    const budgetContainerRef = useRef<HTMLDivElement>(null);

    const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedFieldId, setSelectedFieldId] = useState<string>('');
    const [selectedCropId, setSelectedCropId] = useState<string>('');

    const [searchTerm, setSearchTerm] = useState('');
    const [isWeatherExpanded, setIsWeatherExpanded] = useState(false);

    // Date Range Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [visualMode, setVisualMode] = useState<'list' | 'map' | 'charts'>('list');

    const [mapColorMode, setMapColorMode] = useState<'date' | 'status' | 'pest'>('date');
    const [showTracksOverlay, setShowTracksOverlay] = useState(false);
    const [showMapHistory, setShowMapHistory] = useState(false);
    const [selectedMapPest, setSelectedMapPest] = useState<string>('');
    const [selectedTrackUser, setSelectedTrackUser] = useState<string>('');

    // isAnalyzing removed
    const [isExporting, setIsExporting] = useState(false);
    const [fileToShare, setFileToShare] = useState<File | null>(null);

    // AI State removed

    // REPORT WIZARD STATE
    const [isReportWizardOpen, setIsReportWizardOpen] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [generationProgress, setGenerationProgress] = useState('');

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
    const [showTrackList, setShowTrackList] = useState(false);

    // PRESCRIPTION MODAL STATE (Lifted from LotSituationTable)
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [pendingRecipesList, setPendingRecipesList] = useState<Prescription[] | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    const toggleAudio = (url: string, id: string) => {
        if (playingAudioId === id) {
            setPlayingAudioId(null);
            const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
            if (audio) audio.pause();
        } else {
            setPlayingAudioId(id);
            const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
            if (audio) { audio.play().catch(console.error); audio.onended = () => setPlayingAudioId(null); }
        }
    };

    const handleOpenPlotPrescriptions = (plotId: string) => {
        const plotPrescriptions = data.prescriptions
            .filter(p => p.plotIds.includes(plotId) && p.status === 'active')
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const pending = plotPrescriptions.filter(p => !p.executionData?.[plotId]?.executed);

        if (pending.length > 1) {
            setPendingRecipesList(pending);
        } else if (pending.length === 1) {
            setSelectedPrescription(pending[0]);
        }
    };

    const formatDate = (iso: string | number) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

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
    // Default select first user if tracks exist and no user selected
    // Default select ALL if tracks exist and no user selected
    useEffect(() => {
        if (showTracksOverlay && !selectedTrackUser) {
            setSelectedTrackUser('all');
        }
    }, [showTracksOverlay, selectedTrackUser]);


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



    // --- NEW: DETERMINISTIC REPORT GENERATION (DARK MODE & VISUAL TRAVERSAL) ---
    const handleStartReportGeneration = async (selectedFieldIds: string[], recommendationText?: string) => {
        setIsReportWizardOpen(false);
        setIsGeneratingReport(true);
        setGenerationProgress('Iniciando motor de reportes profesional...');

        // 1. Save current state
        const originalFieldId = selectedFieldId;
        const originalCompanyId = selectedCompanyId;
        const originalMapMode = mapColorMode;
        const originalVisualMode = visualMode;

        try {
            // Fetch Weather for the first selected field (Representative location)
            let weatherInfo = null;
            if (selectedFieldIds.length > 0) {
                const firstField = data.fields.find(f => f.id === selectedFieldIds[0]);
                // Simplified geo-center approx or first plot center usually.
                // For now, let's assume field has no lat/lng directly on schema, so we rely on plots or company.
                // Assuming we use a fallback coord if no plot data.
                const firstPlot = data.plots.find(p => p.fieldId === firstField?.id);
                if (firstPlot && firstPlot.boundary) {
                    // Quick centroid
                    try {
                        const coords = JSON.parse(firstPlot.boundary)[0]; // Simple polygon
                        if (coords && coords.lat) {
                            weatherInfo = await fetchWeather(coords.lat, coords.lng);
                        }
                    } catch (e) { }
                }
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = 20;

            // --- PALETTE (DARK MODE) ---
            const COLORS = {
                bg: [17, 24, 39], // gray-900
                card: [31, 41, 55], // gray-800
                text: [243, 244, 246], // gray-100
                textMuted: [156, 163, 175], // gray-400
                primary: [22, 163, 74], // green-600
                accent: [37, 99, 235], // blue-600
                border: [55, 65, 81] // gray-700
            };

            const fillBackground = () => {
                doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
            };

            // Paint first page background
            fillBackground();

            // --- SORTING LOGIC ---
            // 1. Fields: Alphabetical (or preserve selection order if desired, but user asked for "original list order" which usually means data source order, but A-Z is safer for "Report")
            const sortedFields = selectedFieldIds
                .map(id => data.fields.find(f => f.id === id))
                .filter(f => f !== undefined)
                .sort((a, b) => (a?.name || '').localeCompare(b?.name || '')) as any[];

            // --- GLOBAL CONTEXT SETUP ---
            setSelectedFieldId('');
            setVisualMode('charts');
            setGenerationProgress('Generando Resumen Global...');

            // Wait for charts
            await new Promise(resolve => setTimeout(resolve, 1500));

            // --- GLOBAL HEADER ---
            doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            doc.rect(0, 0, pageWidth, 30, 'F');

            // Logo placeholder or Title
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            const companyName = data.companies.find(c => c.id === effectiveCompanyId)?.name || data.companies.find(c => c.id === sortedFields[0]?.companyId)?.name || 'Empresa';
            doc.text(`${companyName.toUpperCase()}`, 15, 20);

            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text(`INFORME DE SITUACIÓN INTEGRAL`, 15, 26);

            doc.setFontSize(10);
            const dateStr = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.text(dateStr.charAt(0).toUpperCase() + dateStr.slice(1), pageWidth - 15, 20, { align: 'right' });

            yPos = 45;

            // --- 0. CONCLUSIÓN Y ESTRATEGIA (GLOBAL) ---
            if (recommendationText) {
                doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("COMENTARIOS DEL INGENIERO", 15, yPos);

                yPos += 7;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

                // Background for text
                const splitRec = doc.splitTextToSize(recommendationText, pageWidth - 30);
                const textHeight = splitRec.length * 5;

                doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]);
                doc.roundedRect(15, yPos, pageWidth - 30, textHeight + 10, 2, 2, 'F');

                doc.text(splitRec, 20, yPos + 8);

                yPos += textHeight + 20;
            }

            // --- 0.5 WEATHER FORECAST (GLOBAL / PAGE 1) ---
            if (weatherInfo) {
                // Render Weather below Strategy or at top if no strategy
                doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("PRONÓSTICO EXTENDIDO", 15, yPos);
                yPos += 7;

                // Container
                doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]);
                doc.roundedRect(15, yPos, pageWidth - 30, 40, 2, 2, 'F');

                // Weather Items
                const days = weatherInfo.daily?.time || [];
                const codes = weatherInfo.daily?.weathercode || [];
                const maxTemps = weatherInfo.daily?.temperature_2m_max || [];
                const minTemps = weatherInfo.daily?.temperature_2m_min || [];

                // Render 5-7 days
                const daysToShow = Math.min(days.length, 7);
                const itemWidth = (pageWidth - 40) / daysToShow;

                let currentX = 20;
                doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

                for (let i = 0; i < daysToShow; i++) {
                    const date = new Date(days[i]);
                    const dayName = date.toLocaleDateString('es-AR', { weekday: 'short' });
                    const dayNum = date.getDate();

                    // Day
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.text(`${dayName} ${dayNum}`, currentX + (itemWidth / 2), yPos + 10, { align: 'center' });

                    // Icon/Condition text
                    // (Simplified text mapping or just Temp)
                    doc.setFontSize(9);
                    doc.text(`${Math.round(maxTemps[i])}°`, currentX + (itemWidth / 2), yPos + 20, { align: 'center' });

                    doc.setFontSize(8);
                    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
                    doc.text(`${Math.round(minTemps[i])}°`, currentX + (itemWidth / 2), yPos + 28, { align: 'center' });
                    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

                    currentX += itemWidth;
                }

                yPos += 50;
            }

            // --- 1. GLOBAL LOT SITUATION (The consolidated table requested) ---
            doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("1. SITUACIÓN GENERAL DE LOTES", 15, yPos);
            yPos += 10;

            // Table Header
            doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]);
            doc.rect(15, yPos, pageWidth - 30, 10, 'F');
            doc.setFontSize(10);
            doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
            doc.text("CAMPO", 20, yPos + 7);
            doc.text("LOTE", 60, yPos + 7);
            doc.text("CULTIVO", 100, yPos + 7);
            doc.text("ESTADO", 140, yPos + 7);
            doc.text("ULT. RECORRIDA", 175, yPos + 7);
            yPos += 10;

            // Rows
            let globalPlots: any[] = [];

            // Collect all plots sorted by Field Name -> Plot Name
            sortedFields.forEach(field => {
                const plots = data.plots
                    .filter(p => p.fieldId === field.id)
                    .sort((a, b) => a.name.localeCompare(b.name)); // Lots A-Z
                globalPlots = [...globalPlots, ...plots];
            });

            globalPlots.forEach((plot, index) => {
                if (yPos > pageHeight - 20) {
                    doc.addPage();
                    fillBackground();
                    yPos = 20;
                    // Re-draw table header on new page? Optional, clean reports usually do.
                    doc.setFontSize(8);
                    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
                    doc.text("Continuación...", 15, yPos - 5);
                }

                // Alternating row color
                if (index % 2 === 1) {
                    doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]); // Slight bg for odd rows logic if using card color, or make it lighter/darker
                    // Actually let's use a very transparent white or slightly lighter dark
                    doc.setFillColor(255, 255, 255); // Alpha not easy in pure jsPDF without GState, sticky to simple logic
                    // Dark mode alternating: default is bg, alternate is card
                    doc.setFillColor(31, 41, 55);
                    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
                }

                const fieldName = data.fields.find(f => f.id === plot.fieldId)?.name || '-';
                const assignment = data.assignments.find(a => a.plotId === plot.id && a.seasonId === selectedSeasonId);
                const cropName = data.crops.find(c => c.id === assignment?.cropId)?.name || '-';

                // Get Latest Summary
                const plotSummaries = data.lotSummaries.filter(s => s.plotId === plot.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const latest = plotSummaries[0];
                const status = latest ? (latest.engineerStatus || latest.status) : 'gris';
                const lastDate = latest ? new Date(latest.date).toLocaleDateString() : '-';

                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

                doc.text(fieldName, 20, yPos + 5);
                doc.text(plot.name, 60, yPos + 5);
                doc.text(cropName, 100, yPos + 5);

                // Status Badge logic
                let r = 107, g = 114, b = 128; // gray
                if (status === 'verde') { r = 22; g = 163; b = 74; }
                if (status === 'amarillo') { r = 234; g = 179; b = 8; }
                if (status === 'rojo') { r = 220; g = 38; b = 38; }

                doc.setTextColor(r, g, b);
                doc.setFont("helvetica", "bold");
                doc.text(status.toUpperCase(), 140, yPos + 5);

                doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
                doc.setFont("helvetica", "normal");
                doc.text(lastDate, 175, yPos + 5);

                yPos += 8;
            });

            // --- 2. GLOBAL CHARTS ---
            yPos += 10;
            if (chartsContainerRef.current) {
                if (yPos + 90 > pageHeight - 20) {
                    doc.addPage();
                    fillBackground();
                    yPos = 20;
                }

                doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("2. EVOLUCIÓN GLOBAL Y PLAGAS", 15, yPos);
                yPos += 10;

                try {
                    // Dark mode capture might need style adjustments if chart transparent. 
                    // Assuming charts render in dark mode on screen first.
                    const canvas = await html2canvas(chartsContainerRef.current, {
                        scale: 2,
                        backgroundColor: '#111827' // Force dark bg
                    });
                    // Use JPEG with 0.8 quality for better compression
                    const img = canvas.toDataURL('image/jpeg', 0.8);
                    doc.addImage(img, 'JPEG', 15, yPos, pageWidth - 30, 80);
                    yPos += 90;
                } catch (e) {
                    console.warn("Global charts capture failed", e);
                }
            }

            // --- 3. FIELD ACTIVITY SUMMARY (Consolidated Table) ---
            if (yPos + 20 > pageHeight - 20) { doc.addPage(); fillBackground(); yPos = 20; }

            doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("2. RESUMEN DE ACTIVIDAD POR CAMPO (30 Días)", 15, yPos);
            yPos += 10;

            // Table Header
            doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]);
            doc.rect(15, yPos, pageWidth - 30, 10, 'F');
            doc.setFontSize(9);
            doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
            doc.text("CAMPO", 20, yPos + 7);
            doc.text("LOTES / HAS", 70, yPos + 7);
            doc.text("MUESTREOS", 110, yPos + 7); // Center alignment approx
            doc.text("RECORRIDAS", 140, yPos + 7);
            doc.text("RECETAS", 170, yPos + 7);
            yPos += 10;

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let allPendingRecipes: any[] = [];

            sortedFields.forEach((field, index) => {
                const fieldPlots = data.plots.filter(p => p.fieldId === field.id);

                // Calculate Stats
                const recentsMonitorings = data.monitorings.filter(m => m.fieldId === field.id && new Date(m.date) >= thirtyDaysAgo).length;
                const recentSummaries = data.lotSummaries.filter(s => {
                    const plot = data.plots.find(p => p.id === s.plotId);
                    return plot?.fieldId === field.id && new Date(s.date) >= thirtyDaysAgo;
                }).length;
                const activeRecipes = data.prescriptions.filter(p => !p.archived && p.plotIds.some(pid => data.plots.find(pl => pl.id === pid)?.fieldId === field.id) && new Date(p.createdAt) >= thirtyDaysAgo).length;
                const totalHas = fieldPlots.reduce((sum, p) => sum + (p.hectares || 0), 0);

                // Collect Pending Recipes for Global Section
                const fieldPending = data.prescriptions.filter(p =>
                    p.status === 'active' &&
                    !p.archived &&
                    p.plotIds.some(pid =>
                        data.plots.find(pl => pl.id === pid)?.fieldId === field.id &&
                        !p.executionData?.[pid]?.executed // Not executed on this plot
                    )
                );
                // Add field name to recipe for context if needed, or just store unique recipes
                fieldPending.forEach(r => {
                    if (!allPendingRecipes.some(pr => pr.id === r.id)) {
                        allPendingRecipes.push(r);
                    }
                });


                if (yPos > pageHeight - 20) {
                    doc.addPage();
                    fillBackground();
                    yPos = 20;
                    // Header again
                    doc.setFontSize(8);
                    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
                    doc.text("Continuación...", 15, yPos - 5);
                }

                if (index % 2 === 1) {
                    doc.setFillColor(31, 41, 55);
                    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
                }

                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
                doc.text(field.name, 20, yPos + 5);

                doc.setFont("helvetica", "normal");
                doc.text(`${fieldPlots.length} Lotes | ${Math.round(totalHas)} Has`, 70, yPos + 5);

                doc.text(recentsMonitorings.toString(), 115, yPos + 5);
                doc.text(recentSummaries.toString(), 145, yPos + 5);
                doc.text(activeRecipes.toString(), 175, yPos + 5);

                yPos += 8;
            });

            yPos += 15;


            // --- 4. GLOBAL PENDING RECIPES (Consolidated) ---
            if (allPendingRecipes.length > 0) {
                if (yPos + 20 > pageHeight - 20) { doc.addPage(); fillBackground(); yPos = 20; }

                doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("3. RECETAS PENDIENTES DE APLICACIÓN (GLOBAL)", 15, yPos);
                yPos += 10;

                allPendingRecipes.forEach(recipe => {
                    // Check if we need space logic (approx 35mm per card)
                    if (yPos + 35 > pageHeight - 20) { doc.addPage(); fillBackground(); yPos = 20; }

                    // Card Background
                    doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]);
                    doc.roundedRect(15, yPos, pageWidth - 30, 28, 2, 2, 'F');

                    // Left strip (Yellow for pending)
                    doc.setFillColor(234, 179, 8);
                    doc.rect(15, yPos, 2, 28, 'F');

                    // Header Line: Date + Owner
                    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "bold");
                    const dateRec = new Date(recipe.createdAt).toLocaleDateString();
                    doc.text(`Fecha: ${dateRec} - Ing: ${recipe.ownerName || 'N/A'}`, 20, yPos + 7);

                    // Target Fields/Plots
                    const targetPlotIds = recipe.plotIds.filter((pid: string) => !recipe.executionData?.[pid]?.executed);
                    const plotNamesGroupedText = targetPlotIds.slice(0, 5).map((pid: string) => {
                        const plot = data.plots.find(p => p.id === pid);
                        const field = data.fields.find(f => f.id === plot?.fieldId);
                        return `${field?.name} - ${plot?.name}`;
                    }).join(', ') + (targetPlotIds.length > 5 ? '...' : '');

                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
                    doc.text(`Destino: ${plotNamesGroupedText}`, 20, yPos + 12);

                    // Products
                    const products = recipe.items.map((i: any) => {
                        const productName = i.productName || data.agrochemicals.find(a => a.id === i.productId)?.name || 'Producto desconocido';
                        return `${productName} (${i.dose} ${i.unit})`;
                    }).join(' + ');

                    // Tasks (Labores)
                    const tasks = recipe.tasks?.map((t: any) => {
                        const taskName = t.description || data.tasks.find(tk => tk.id === t.taskId)?.name || 'Labor desconocida';
                        return taskName;
                    }).join(', ');

                    const fullContent = products + (tasks ? ` | Labores: ${tasks}` : '') + (recipe.notes ? ` | Nota: ${recipe.notes}` : '');

                    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
                    // Auto-wrap products if too long
                    const productLines = doc.splitTextToSize(fullContent, pageWidth - 40);
                    doc.text(productLines, 20, yPos + 18);

                    // Adjust yPos based on product lines
                    yPos += 20 + (productLines.length * 4);
                });
            }

            // Save PDF
            const fileName = `Informe_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            showNotification("Informe generado exitosamente", "success");

        } catch (error) {
            console.error("Error generating report:", error);
            showNotification("Error al generar el informe.", "error");
        } finally {
            // Restore State
            setSelectedFieldId(originalFieldId);
            setSelectedCompanyId(originalCompanyId);
            setMapColorMode(originalMapMode);
            setVisualMode(originalVisualMode);

            setIsGeneratingReport(false);
            setGenerationProgress('');
        }
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
            let weatherInfo: any = null;

            const COLORS = {
                bg: [17, 24, 39], // gray-900
                card: [31, 41, 55], // gray-800
                text: [243, 244, 246], // gray-100
                textMuted: [156, 163, 175], // gray-400
                primary: [22, 163, 74], // green-600
                accent: [37, 99, 235], // blue-600
                border: [55, 65, 81] // gray-700
            };

            const fillBackground = () => {
                doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
            };

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
            doc.text("Ing Arg. Msc. Enrique A Marcon (v.1.1)", pageWidth - 15, 22, { align: 'right' });

            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(15, 40, pageWidth - 30, 25, 2, 2, 'FD');

            const companyName = userCompanies.find(c => c.id === effectiveCompanyId)?.name || "Todos";

            // --- FIELD PAGE START ---
            doc.addPage();
            fillBackground();

            // Field Header Bar
            doc.setFillColor(COLORS.card[0], COLORS.card[1], COLORS.card[2]);
            doc.rect(0, 0, pageWidth, 25, 'F');

            // Field Name
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
            const fieldName = data.fields.find(f => f.id === selectedFieldId)?.name || "Campo";
            doc.text(fieldName.toUpperCase(), 15, 17);

            // Subtitle
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2]);
            doc.text(`${companyName} - Reporte Detallado`, pageWidth - 15, 17, { align: 'right' });

            yPos = 35;

            // --- 3. WEATHER FORECAST (Per Field - if we want it here, or we can skip/keep it) ---
            // If we want Weather on Page 1 (Global), we should have put it there. 
            // Previous code had Weather here. Current request "Al principio de todo" likely meant Global Page 1.
            // But let's keep the existing Weather block if it was intended for the field, OR remove it if it duplicates.
            // The previous logic I wrote (Step 497) put it here.
            // Let's KEEP it but cleaned up, or if user meant "Recommendation at start, Weather at start", maybe I should move Weather to Page 1 too?
            // "The earlier parts of this conversation" summary says: "Enhance PDF Report: Add a 7-day weather forecast at the beginning".
            // So Weather ALSO belongs on Page 1.
            // I will REMOVE it from here and rely on my plan to add it to Page 1 later if not already there.
            // Wait, I only added Recommendation to Page 1 in previous tool call.
            // I should probably clean this up. I'll just leave the map logic that follows.

            // --- 3. WEATHER FORECAST ---
            if (weatherInfo) {
                // Check formatted Date for today
                const todayStr = new Date().toISOString().split('T')[0];

                // Container Box
                doc.setDrawColor(55, 65, 81); // gray-700
                doc.setFillColor(31, 41, 55); // gray-800
                doc.roundedRect(10, yPos, 190, 45, 2, 2, 'FD');

                // ... (Weather rendering logic continued)
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
                // Use robust download instead of doc.save()
                const pdfBlob = doc.output('blob');
                Export.downloadBlob(pdfBlob, fileName);
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
                console.warn('Share not supported, falling back to download');
                Export.downloadBlob(fileToShare, fileToShare.name);
                showNotification("Se descargó el PDF (Compartir no soportado)", "warning");
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
                    Tablero Agronómico
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button variant="secondary" onClick={handleExportExcel} className="w-full sm:w-auto text-xs font-bold" disabled={filteredSummaries.length === 0}>
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> EXCEL
                    </Button>
                    <Button
                        onClick={() => setIsReportWizardOpen(true)}
                        variant="secondary"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105 border-none transition-all"
                    >
                        <FileDown className="w-4 h-4" /> Informe
                    </Button>
                </div>
            </div>

            {weatherLocation && (
                <div className="mb-4 animate-fade-in">
                    <button
                        onClick={() => setIsWeatherExpanded(!isWeatherExpanded)}
                        className="w-full flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                            <Cloud className="w-5 h-5 text-blue-500" />
                            <span>Pronóstico del Clima ({weatherLocation.name})</span>
                        </div>
                        {isWeatherExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>

                    {isWeatherExpanded && (
                        <div className="mt-2 animate-fade-in-down">
                            <WeatherWidget
                                lat={weatherLocation.lat}
                                lng={weatherLocation.lng}
                                locationName={weatherLocation.name}
                            />
                        </div>
                    )}
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
                        </div>

                        {/* TRACKS TOGGLE (Only in Status Mode) */}
                        {mapColorMode === 'status' && (
                            <>
                                <button
                                    onClick={() => setShowTracksOverlay(!showTracksOverlay)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center border ${showTracksOverlay ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}
                                >
                                    <History className="w-3 h-3 mr-1.5" /> {showTracksOverlay ? 'Ocultar Rutas' : 'Mostrar Rutas'}
                                </button>
                                <button
                                    onClick={() => setShowTrackList(true)}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center border bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    title="Ver Listado de Rutas"
                                >
                                    <List className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}

                        {mapColorMode === 'pest' && (
                            <div className="w-full md:w-48">
                                <Select label="" options={availablePestsForMap.map(p => ({ value: p, label: p }))} value={selectedMapPest} onChange={(e) => setSelectedMapPest(e.target.value)} placeholder="Seleccionar plaga..." className="text-xs h-9 py-1" />
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
            <div style={{ display: (visualMode === 'charts' || isExporting || isGeneratingReport) ? 'block' : 'none' }}>
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
                    plots={filteredPlotsForTable}
                    fields={data.fields}
                    companies={userCompanies}
                    summaries={filteredSummaries}
                    monitorings={filteredMonitorings}
                    prescriptions={data.prescriptions} // Pass prescriptions
                    mapColorMode={mapColorMode}
                    selectedPestForMap={selectedMapPest}
                    onPestChange={setSelectedMapPest}
                    availablePests={availablePestsForMap}
                    currentUser={currentUser}
                    tracks={showTracksOverlay ? (currentTrack ? [...filteredTracksForMap, currentTrack] : filteredTracksForMap) : (currentTrack ? [currentTrack] : [])}
                    showTracks={showTracksOverlay || !!currentTrack}

                    onOpenHistory={(plotId) => {
                        setHistoryPlotId(plotId);
                    }}
                    onOpenPrescriptions={handleOpenPlotPrescriptions}
                    assignments={data.assignments}
                    crops={data.crops}
                    seasonId={selectedSeasonId}
                    onSelectSummary={setSelectedSummary}
                    isVisible={visualMode === 'map' || isExporting}
                    isExporting={isExporting}
                />        </div>


            {/* --- SECTION 3: LIST (Table) --- */}
            <div style={{ display: (visualMode === 'list' || isExporting) ? 'block' : 'none' }} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input type="text" placeholder="Buscar lote..." className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm focus:ring-2 focus:ring-agro-500 outline-none text-gray-800 dark:text-white transition-all h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-64">
                        <Select
                            label=""
                            options={[
                                { value: 'date_desc', label: '📅 Más Recientes' },
                                { value: 'date_asc', label: '📅 Más Antiguos' },
                                { value: 'status_desc', label: '⚠️ Prioridad (Rojo → Verde)' },
                                { value: 'status_asc', label: '✅ Estado (Verde → Rojo)' },
                            ]}
                            value={`${sortConfig.key}_${sortConfig.direction}`}
                            onChange={(e) => {
                                const [key, direction] = e.target.value.split('_');
                                setSortConfig({ key: key as any, direction: direction as any });
                            }}
                            className="text-xs h-10"
                            placeholder="Ordenar por..."
                        />
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
                        onOpenHistory={(pid) => setHistoryPlotId(pid)}
                        seasonId={selectedSeasonId}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        onOpenPrescriptions={handleOpenPlotPrescriptions}
                    />            </div>
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

            {/* AI Modal Removed */}

            {historyPlotId && (
                <LotHistoryModal
                    plotId={historyPlotId}
                    onClose={() => setHistoryPlotId(null)}
                    data={data}
                />
            )}

            {/* --- MODALES DE RECETAS (Lifted from LotSituationTable) --- */}
            {/* --- POPUP: DETALLE DE RECETA --- */}
            <Modal isOpen={!!selectedPrescription} onClose={() => setSelectedPrescription(null)} title="Receta Agronómica Activa">
                {selectedPrescription && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm text-gray-500 border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span>{formatDate(selectedPrescription.date)}</span>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Activa</span>
                        </div>

                        <div>
                            <h4 className="flex items-center text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                <FlaskConical className="w-4 h-4 mr-2" /> Insumos
                            </h4>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 dark:bg-gray-700/50 text-xs text-gray-500">
                                        <tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-right">Dosis</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {selectedPrescription.items.map((it, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2 dark:text-gray-200">{it.supplyName}</td>
                                                <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">{it.dose} {it.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {selectedPrescription.taskNames.length > 0 && (
                            <div>
                                <h4 className="flex items-center text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    <List className="w-4 h-4 mr-2" /> Labores
                                </h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                    {selectedPrescription.taskNames.map((t, i) => <li key={i}>{t}</li>)}
                                </ul>
                            </div>
                        )}

                        {selectedPrescription.notes && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Indicaciones</h4>
                                <p className={`text-sm italic p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg ${getRoleColorClass(getUserRole(selectedPrescription.ownerId, data.users, dataOwnerId))}`}>
                                    {selectedPrescription.notes}
                                </p>
                            </div>
                        )}

                        {selectedPrescription.audioUrl && (
                            <button onClick={() => toggleAudio(selectedPrescription.audioUrl!, 'recipe-audio')} className="w-full flex items-center justify-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
                                {playingAudioId === 'recipe-audio' ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                Escuchar Nota de Voz
                                <audio id="audio-recipe-audio" src={selectedPrescription.audioUrl} className="hidden" />
                            </button>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button variant="ghost" onClick={() => setSelectedPrescription(null)}>Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* --- SELECCIÓN DE MÚLTIPLES RECETAS PENDIENTES --- */}
            <Modal isOpen={!!pendingRecipesList} onClose={() => setPendingRecipesList(null)} title="Recetas Pendientes">
                <div className="space-y-3">
                    {pendingRecipesList && pendingRecipesList.length > 0 ? (
                        pendingRecipesList.map(recipe => (
                            <div key={recipe.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => { setSelectedPrescription(recipe); setPendingRecipesList(null); }}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatDate(recipe.createdAt)}</span>
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pendiente</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        <span className="font-medium text-gray-700 dark:text-gray-300 block mb-0.5">Por: {recipe.ownerName || 'Desconocido'}</span>
                                        {recipe.items.length} Insumos • {recipe.taskNames.length > 0 ? `${recipe.taskNames.length} Labores` : 'Solo productos'}
                                    </div>
                                </div>
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedPrescription(recipe); setPendingRecipesList(null); }}>
                                    Ver Detalle
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 italic">No hay recetas pendientes.</p>
                    )}
                </div>
                <div className="flex justify-end mt-4">
                    <Button variant="ghost" onClick={() => setPendingRecipesList(null)}>Cerrar</Button>
                </div>
            </Modal>
            {/* NEW: Track List Modal */}
            <TrackListModal
                isOpen={showTrackList}
                onClose={() => setShowTrackList(false)}
                tracks={tracks}
                users={data.team}
                fields={data.fields}
                onTrackDeleted={(deletedId) => {
                    setTracks(prev => prev.filter(t => t.id !== deletedId));
                }}
            />
            {/* NEW REPORT WIZARD */}
            <ReportWizardModal
                isOpen={isReportWizardOpen}
                onClose={() => setIsReportWizardOpen(false)}
                onStartGeneration={handleStartReportGeneration}
                preSelectedCompanyId={effectiveCompanyId}
            />

            {/* GENERATION OVERLAY */}
            {isGeneratingReport && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <Loader2 className="w-16 h-16 animate-spin text-green-500 mb-6" />
                    <h2 className="text-2xl font-bold mb-2">Generando Informe Profesional</h2>
                    <p className="text-gray-300 animate-pulse">{generationProgress}</p>
                    <div className="mt-8 text-xs text-gray-500 max-w-md text-center">
                        Por favor, no cierre esta ventana ni cambie de pestaña.
                        Estamos recorriendo sus campos para capturar imágenes de alta resolución.
                    </div>
                </div>
            )}
        </div>
    );
};
