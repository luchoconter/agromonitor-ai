
import React, { useState, useEffect, useMemo } from 'react';
import { Plot, LotSummary, Prescription, AppState, User, MonitoringRecord } from '../../types';
import { CheckSquare, Square, FileText, X, AlertTriangle, CheckCircle2, User as UserIcon, Calendar, MapPin, Play, Pause, FlaskConical, List, ClipboardList, ArrowLeft, MessageSquare, Clock, DollarSign, Save, Mic, StopCircle, Eye, PenLine, ShieldCheck, Tractor, Sprout, Bug, ImageIcon, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal, Button } from '../UI';
import * as Storage from '../../services/storageService';
import { getPlotBudgetStats } from '../../hooks/useBudgetCalculator';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { useData } from '../../contexts/DataContext';
import { getUserRole, getRoleColorClass, getRoleBgClass } from '../../utils/roleUtils';

interface LotSituationTableProps {
    plots: Plot[];
    summaries: LotSummary[];
    prescriptions: Prescription[];
    data: AppState; // Full state for resolving names (crops, pests, etc.)
    showCompanyCol: boolean;
    showFieldCol: boolean;
    currentUser: User | null;
    onOpenHistory: (plotId: string) => void;
    seasonId?: string; // Optional context for budget calc
    sortConfig?: { key: 'date' | 'status' | 'name', direction: 'asc' | 'desc' };
    onSort?: (key: 'date' | 'status' | 'name') => void;
    onOpenPrescriptions: (plotId: string) => void;
}

export const LotSituationTable: React.FC<LotSituationTableProps> = ({
    plots,
    summaries,
    prescriptions,
    data,
    showCompanyCol,
    showFieldCol,
    currentUser,
    onOpenHistory,

    seasonId,
    sortConfig,
    onSort,
    onOpenPrescriptions
}) => {
    const { dataOwnerId } = useData();
    // --- STATE ---
    const [selectedSummary, setSelectedSummary] = useState<LotSummary | null>(null);
    // Prescriptions handled by parent now

    // State for View Samples Modal
    const [viewSamplesSummary, setViewSamplesSummary] = useState<LotSummary | null>(null);

    // Audio Playback
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    // Image Preview
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Observation Modal State
    const [observationModal, setObservationModal] = useState<{
        prescription: Prescription;
        plotId: string;
        text: string;
        executed: boolean;
        lastModifiedBy?: string; // New: Audit info
        lastModifiedAt?: string; // New: Audit info
        readOnly: boolean; // NEW: Control editing permission
        audioUrl?: string; // NEW: Audio feedback
    } | null>(null);

    // Multiple Recipes Selection State handled by parent

    // --- ENGINEER FEEDBACK STATE ---
    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();
    const [feedbackStatus, setFeedbackStatus] = useState<'verde' | 'amarillo' | 'rojo'>('verde');
    const [feedbackNotes, setFeedbackNotes] = useState('');
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);

    // Initialize form when opening modal
    useEffect(() => {
        if (selectedSummary) {
            setFeedbackStatus(selectedSummary.engineerStatus || ((selectedSummary.id || selectedSummary._operationId) ? selectedSummary.status : 'verde'));
            setFeedbackNotes(selectedSummary.engineerNotes || '');
            resetRecording();
        }
    }, [selectedSummary]);

    // --- HANDLERS ---

    const handleExecutionToggle = async (prescription: Prescription, plotId: string, currentStatus: boolean, currentObs: string) => {
        if (!currentUser) return;
        await Storage.updatePrescriptionExecution(
            prescription.id,
            plotId,
            !currentStatus,
            currentObs || '',
            currentUser.name
        );
    };

    const handleSaveObservation = async () => {
        if (!observationModal || !currentUser || observationModal.readOnly) return;
        await Storage.updatePrescriptionExecution(
            observationModal.prescription.id,
            observationModal.plotId,
            observationModal.executed,
            observationModal.text,
            currentUser.name
        );
        setObservationModal(null);
    };

    const handleSaveFeedback = async () => {
        if (!selectedSummary || !currentUser) return;

        setIsSavingFeedback(true);
        try {
            if (selectedSummary.id) {
                await Storage.updateLotSummaryFeedback(
                    selectedSummary.id,
                    feedbackStatus,
                    feedbackNotes,
                    currentUser?.name || 'Ingeniero',
                    audioBlobUrl || undefined,
                    audioDuration
                );
            } else {
                await Storage.addLotSummary({
                    ...selectedSummary,
                    status: feedbackStatus,
                    engineerStatus: feedbackStatus,
                    engineerNotes: feedbackNotes,
                    engineerName: currentUser?.name || 'Ingeniero',
                    engineerStatusDate: new Date().toISOString(),
                    engineerAudioDuration: audioDuration,
                    isReviewed: true,
                    userName: currentUser.name,
                    userId: currentUser.id,
                    notes: '[Validación técnica sin monitoreo previo]'
                }, audioBlobUrl || undefined);
            }
            setSelectedSummary(null);
        } catch (error) {
            console.error("Error saving feedback", error);
        } finally {
            setIsSavingFeedback(false);
        }
    };

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

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'verde': return 'bg-green-500';
            case 'amarillo': return 'bg-yellow-500';
            case 'rojo': return 'bg-red-500';
            default: return 'bg-gray-400 dark:bg-gray-600';
        }
    };

    const formatDate = (iso: string) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatShortDate = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
    }

    const relevantSamples = useMemo(() => {
        if (!viewSamplesSummary) return [];
        return data.monitorings.filter(m =>
            m.plotId === viewSamplesSummary.plotId &&
            (viewSamplesSummary.seasonId ? m.seasonId === viewSamplesSummary.seasonId : true)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [viewSamplesSummary, data.monitorings]);

    const isEngineer = currentUser?.role === 'admin';

    return (
        <>
            {/* --- DESKTOP TABLE VIEW --- */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-semibold uppercase text-xs">
                        <tr>
                            {showCompanyCol && <th className="px-4 py-3 whitespace-nowrap">Empresa</th>}
                            {showFieldCol && <th className="px-4 py-3 whitespace-nowrap">Campo</th>}
                            <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => onSort && onSort('name')}>
                                <div className="flex items-center gap-1">
                                    <span>Lote / Cultivo</span>
                                    {sortConfig?.key === 'name' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap bg-gray-50 dark:bg-gray-900/50">
                                STAND (pl/ha)
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap bg-gray-100/50 dark:bg-gray-800/50 border-l border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" onClick={() => onSort && onSort('status')}>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 justify-center">
                                        <span>Estado</span>
                                        {sortConfig?.key === 'status' ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                    </div>
                                    <span className="text-[9px] font-normal text-gray-400 normal-case">(Ingeniero)</span>
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap bg-gray-100/50 dark:bg-gray-800/50">
                                <div className="flex flex-col">
                                    <span>Receta</span>
                                    <span className="text-[9px] font-normal text-gray-400 normal-case">(Ingeniero)</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {plots.map(plot => {
                            const field = data.fields.find(f => f.id === plot.fieldId);
                            const companyId = plot.companyId || field?.companyId;
                            const companyName = data.companies.find(c => c.id === companyId)?.name || '-';
                            const fieldName = field?.name || '-';

                            const plotSummaries = summaries.filter(s => s.plotId === plot.id);
                            const latestSummary = plotSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                            const status = latestSummary ? (latestSummary.engineerStatus || latestSummary.status) : 'none';

                            const plotMonitorings = data.monitorings.filter(m => m.plotId === plot.id);
                            const sortedMonitorings = plotMonitorings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            const latestMonitoring = sortedMonitorings[0];
                            const phenology = latestMonitoring?.phenology;

                            // Calculate Average Stand for the latest date
                            let stand: number | undefined = undefined;
                            if (latestMonitoring) {
                                const latestDateStr = new Date(latestMonitoring.date).toDateString();
                                const sameDayMeasurements = sortedMonitorings.filter(m =>
                                    new Date(m.date).toDateString() === latestDateStr &&
                                    m.standData &&
                                    m.standData.plantsPerMeter > 0
                                );

                                if (sameDayMeasurements.length > 0) {
                                    const totalPPM = sameDayMeasurements.reduce((acc, m) => acc + (m.standData?.plantsPerMeter || 0), 0);
                                    const avgPPM = totalPPM / sameDayMeasurements.length;
                                    const distance = sameDayMeasurements[0].standData!.distanceBetweenRows; // Assume consistent spacing for the lot
                                    if (distance > 0) {
                                        stand = Math.round((avgPPM / distance) * 10000);
                                    }
                                }
                            }

                            const allActivePrescriptions = prescriptions
                                .filter(p => p.plotIds.includes(plot.id) && p.status === 'active')
                                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                            const pendingPrescriptions = allActivePrescriptions.filter(p => !p.executionData?.[plot.id]?.executed);
                            const activePrescription = pendingPrescriptions[0]; // Target the newest pending one
                            const pendingCount = pendingPrescriptions.length;

                            const assignment = data.assignments.find(a => a.plotId === plot.id && (seasonId ? a.seasonId === seasonId : true));
                            const cropName = data.crops.find(c => c.id === assignment?.cropId)?.name;

                            return (
                                <tr key={plot.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                    {showCompanyCol && <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{companyName}</td>}
                                    {showFieldCol && <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{fieldName}</td>}

                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => onOpenHistory(plot.id)}
                                            className="font-bold text-gray-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left block w-full"
                                            title="Ver Historial Completo del Lote"
                                        >
                                            {plot.name}
                                        </button>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                            <span>{cropName || '-'}</span>
                                            {phenology && (
                                                <>
                                                    <span className="text-gray-300">•</span>
                                                    <span className={`px-1.5 rounded-sm font-bold ${phenology.startsWith('V') ? 'text-green-600 bg-green-50 dark:bg-green-900/30' :
                                                        phenology.startsWith('R') ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' :
                                                            'text-gray-500 bg-gray-100'
                                                        }`}>
                                                        {phenology}
                                                    </span>
                                                </>
                                            )}
                                            <span className="text-gray-300">•</span>
                                            <span>{plot.hectares} Has</span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                        {stand ? (
                                            <div className="flex flex-col items-center">
                                                <span className="font-mono font-bold text-gray-700 dark:text-gray-200">
                                                    {stand.toLocaleString()}
                                                </span>
                                                {assignment?.originalStand && assignment.originalStand > 0 && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${(stand / assignment.originalStand) >= 0.9 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                        (stand / assignment.originalStand) >= 0.7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                        }`}>
                                                        {Math.round((stand / assignment.originalStand) * 100)}% Logro
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 dark:text-gray-600">-</span>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-center align-middle border-l border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
                                        <button
                                            onClick={() => {
                                                if (latestSummary) {
                                                    setSelectedSummary(latestSummary);
                                                } else if (isEngineer) {
                                                    setSelectedSummary({
                                                        plotId: plot.id,
                                                        fieldId: plot.fieldId,
                                                        companyId: companyId || '',
                                                        seasonId: seasonId || '',
                                                        date: new Date().toISOString(),
                                                        status: 'verde',
                                                        ownerId: plot.ownerId,
                                                        ownerName: plot.ownerName,
                                                        isReviewed: false
                                                    } as any);
                                                }
                                            }}
                                            className={`w-8 h-8 rounded-md shadow-sm border border-black/10 mx-auto transition-transform active:scale-95 ${getStatusColor(status)} ${(!latestSummary && !isEngineer) ? 'opacity-30 cursor-default' : 'hover:ring-2 hover:ring-offset-2 hover:ring-agro-500 cursor-pointer'}`}
                                            title={latestSummary ? `Ver detalle (${formatDate(latestSummary.date)})` : (isEngineer ? "Asignar estado inicial" : "Sin información reciente")}
                                        >
                                        </button>
                                        {latestSummary && (
                                            <div className="text-[10px] text-gray-400 mt-1">{new Date(latestSummary.date).toLocaleDateString()}</div>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-center align-middle bg-gray-50/30 dark:bg-gray-800/30">
                                        {activePrescription ? (
                                            <button
                                                onClick={() => {
                                                    onOpenPrescriptions(plot.id);
                                                }}
                                                className="relative p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors mx-auto"
                                                title={pendingCount > 1 ? "Ver lista de recetas pendientes" : "Ver Receta Pendiente"}
                                            >
                                                <FileText className="w-5 h-5" />
                                                {pendingCount > 1 && (
                                                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-red-500 rounded-full shadow-sm animate-pulse">
                                                        {pendingCount}
                                                    </span>
                                                )}
                                            </button>
                                        ) : (
                                            <span className="text-gray-300 dark:text-gray-700">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* --- MOBILE CARD VIEW --- */}
            <div className="md:hidden space-y-3">
                {plots.map(plot => {
                    const field = data.fields.find(f => f.id === plot.fieldId);
                    const companyId = plot.companyId || field?.companyId;
                    const fieldName = field?.name || '-';

                    const plotSummaries = summaries.filter(s => s.plotId === plot.id);
                    const latestSummary = plotSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const status = latestSummary ? (latestSummary.engineerStatus || latestSummary.status) : 'none';

                    const plotMonitorings = data.monitorings.filter(m => m.plotId === plot.id);
                    const sortedMonitorings = plotMonitorings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const latestMonitoring = sortedMonitorings[0];
                    const phenology = latestMonitoring?.phenology;

                    let stand: number | undefined = undefined;
                    if (latestMonitoring) {
                        const latestDateStr = new Date(latestMonitoring.date).toDateString();
                        const sameDayMeasurements = sortedMonitorings.filter(m =>
                            new Date(m.date).toDateString() === latestDateStr && m.standData && m.standData.plantsPerMeter > 0
                        );
                        if (sameDayMeasurements.length > 0) {
                            const totalPPM = sameDayMeasurements.reduce((acc, m) => acc + (m.standData?.plantsPerMeter || 0), 0);
                            const avgPPM = totalPPM / sameDayMeasurements.length;
                            const distance = sameDayMeasurements[0].standData!.distanceBetweenRows;
                            if (distance > 0) stand = Math.round((avgPPM / distance) * 10000);
                        }
                    }

                    const allActivePrescriptions = prescriptions.filter(p => p.plotIds.includes(plot.id) && p.status === 'active').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    const pendingPrescriptions = allActivePrescriptions.filter(p => !p.executionData?.[plot.id]?.executed);
                    const activePrescription = pendingPrescriptions[0];
                    const pendingCount = pendingPrescriptions.length;

                    const assignment = data.assignments.find(a => a.plotId === plot.id && (seasonId ? a.seasonId === seasonId : true));
                    const cropName = data.crops.find(c => c.id === assignment?.cropId)?.name;

                    return (
                        <div key={plot.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 relative">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <button onClick={() => onOpenHistory(plot.id)} className="font-bold text-gray-900 dark:text-white text-lg hover:text-blue-600 dark:hover:text-blue-400 hover:underline">{plot.name}</button>
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                        <MapPin className="w-3 h-3" /> {fieldName}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (latestSummary) setSelectedSummary(latestSummary);
                                        else if (isEngineer) setSelectedSummary({
                                            plotId: plot.id, fieldId: plot.fieldId, companyId: companyId || '',
                                            seasonId: seasonId || '', date: new Date().toISOString(), status: 'verde',
                                            ownerId: plot.ownerId, ownerName: plot.ownerName, isReviewed: false
                                        } as any);
                                    }}
                                    className={`w-8 h-8 rounded-full shadow-sm border-2 border-white dark:border-gray-800 flex items-center justify-center ${getStatusColor(status)} ${(!latestSummary && !isEngineer) ? 'opacity-30' : 'cursor-pointer hover:scale-110 transition-transform'}`}
                                >
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold border bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600`}>
                                    {cropName || 'Sin Cultivo'}
                                </span>
                                {phenology && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${phenology.startsWith('V') ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800' :
                                        phenology.startsWith('R') ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' :
                                            'text-gray-500 bg-gray-100 border-gray-200'
                                        }`}>
                                        {phenology}
                                    </span>
                                )}
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">
                                    {plot.hectares} Has
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                                <div className="text-center">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold">Stand (pl/ha)</div>
                                    {stand ? (
                                        <span className="font-mono font-bold text-gray-700 dark:text-gray-200 text-sm">{stand.toLocaleString()}</span>
                                    ) : <span className="text-gray-300">-</span>}
                                </div>

                                {activePrescription ? (
                                    <button
                                        onClick={() => onOpenPrescriptions(plot.id)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-xs font-bold"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {pendingCount > 1 ? `${pendingCount} RECETAS` : 'VER RECETA'}
                                    </button>
                                ) : (
                                    <div className="text-xs text-gray-300 dark:text-gray-600 italic">Sin recetas pendientes</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- POPUP: DETALLE DE ESTADO --- */}
            <Modal isOpen={!!selectedSummary} onClose={() => setSelectedSummary(null)} title={(selectedSummary?.id || selectedSummary?._operationId) ? "Detalle de Estado" : "Asignar Estado Lote"}>
                {selectedSummary && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-start bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                                    {data.plots.find(p => p.id === selectedSummary.plotId)?.name}
                                </h4>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    {data.fields.find(f => f.id === selectedSummary.fieldId)?.name}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center text-xs font-mono text-gray-600 dark:text-gray-400">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {formatDate(selectedSummary.date)}
                                </div>
                                {selectedSummary.id && (
                                    <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                                        <UserIcon className="w-3 h-3 mr-1" />
                                        {selectedSummary.userName}
                                    </div>
                                )}
                            </div>
                        </div>

                        {(selectedSummary.id || selectedSummary._operationId) && (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Reporte Operario</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${selectedSummary.status === 'verde' ? 'bg-green-50 text-green-700 border-green-200' :
                                        selectedSummary.status === 'amarillo' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                            'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                        {selectedSummary.status}
                                    </span>
                                </div>

                                {selectedSummary.notes ? (
                                    <p className={`text-sm italic ${getRoleColorClass(getUserRole(selectedSummary.userId, data.users, dataOwnerId))}`}>"{selectedSummary.notes}"</p>
                                ) : <span className="text-xs text-gray-400 italic">Sin notas escritas.</span>}

                                {selectedSummary.audioUrl && (
                                    <button onClick={() => toggleAudio(selectedSummary.audioUrl!, 'summ-audio')} className="flex items-center space-x-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-agro-600 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg w-full justify-center">
                                        {playingAudioId === 'summ-audio' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        <span>Reproducir Audio Operario</span>
                                        <audio id="audio-summ-audio" src={selectedSummary.audioUrl} className="hidden" />
                                    </button>
                                )}
                            </div>
                        )}

                        {!selectedSummary.id && isEngineer && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50">
                                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                    Estás asignando un estado inicial. Esto creará un reporte técnico basado en los muestreos.
                                </p>
                            </div>
                        )}

                        <hr className="border-gray-200 dark:border-gray-700" />

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-800 dark:text-white">Validación Técnica (Ingeniero)</span>
                                {isEngineer && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">Editable</span>}
                            </div>

                            {isEngineer ? (
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30 space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {['verde', 'amarillo', 'rojo'].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setFeedbackStatus(s as any)}
                                                className={`py-1.5 rounded-md text-xs font-bold uppercase border-2 transition-all ${feedbackStatus === s
                                                    ? (s === 'verde' ? 'bg-green-500 text-white border-green-600' : s === 'amarillo' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-red-500 text-white border-red-600')
                                                    : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>

                                    <textarea
                                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white resize-none h-20"
                                        placeholder="Escriba aquí su devolución técnica o recomendación..."
                                        value={feedbackNotes}
                                        onChange={(e) => setFeedbackNotes(e.target.value)}
                                    />

                                    <div className="flex gap-2">
                                        <div
                                            onClick={toggleRecording}
                                            className={`flex-1 border-2 border-dashed rounded-lg h-10 flex items-center justify-center cursor-pointer transition-colors ${isRecording ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}
                                        >
                                            {isRecording ? (
                                                <><StopCircle className="w-4 h-4 mr-2 animate-pulse" /> <span className="text-xs font-bold">{audioDuration}s</span></>
                                            ) : (
                                                <><Mic className={`w-4 h-4 mr-2 ${(audioDuration > 0 || (selectedSummary && selectedSummary.engineerAudioUrl)) ? 'text-green-500' : ''}`} /> <span className="text-xs">{(audioDuration > 0 || (selectedSummary && selectedSummary.engineerAudioUrl)) ? 'Audio OK' : 'Grabar Voz'}</span></>
                                            )}
                                        </div>

                                        <Button onClick={handleSaveFeedback} disabled={isSavingFeedback} className="bg-blue-600 hover:bg-blue-700 text-white px-4 h-10 text-xs">
                                            <Save className="w-4 h-4 mr-1.5" /> Guardar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${selectedSummary.engineerStatus === 'verde' ? 'bg-green-100 text-green-800 border-green-200' :
                                            selectedSummary.engineerStatus === 'amarillo' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                selectedSummary.engineerStatus === 'rojo' ? 'bg-red-100 text-red-800 border-red-200' :
                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                            {selectedSummary.engineerStatus || 'Pendiente'}
                                        </span>
                                    </div>
                                    {selectedSummary.engineerNotes ? (
                                        <p className={`text-sm italic mb-2 ${getRoleColorClass('admin')}`}>"{selectedSummary.engineerNotes}"</p>
                                    ) : <span className="text-xs text-gray-400 italic block mb-2">Sin notas del ingeniero.</span>}

                                    {selectedSummary.engineerAudioUrl && (
                                        <button onClick={() => toggleAudio(selectedSummary.engineerAudioUrl!, 'eng-audio')} className="flex items-center justify-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors text-xs font-medium w-full">
                                            {playingAudioId === 'eng-audio' ? <Pause className="w-3.5 h-3.5 mr-2" /> : <Play className="w-3.5 h-3.5 mr-2" />}
                                            Escuchar Feedback
                                            <audio id="audio-eng-audio" src={selectedSummary.engineerAudioUrl} className="hidden" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2 gap-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                            <Button variant="secondary" onClick={() => { setViewSamplesSummary(selectedSummary); setSelectedSummary(null); }} className="text-xs h-9">
                                <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Ver Muestras
                            </Button>
                            <Button variant="ghost" onClick={() => setSelectedSummary(null)} className="text-xs h-9">Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* --- POPUP: LISTADO DE MUESTREOS (Monitorings) --- */}
            <Modal isOpen={!!viewSamplesSummary} onClose={() => { setViewSamplesSummary(null); setSelectedSummary(null); }} title="Muestreos Realizados">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {relevantSamples.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 italic">No hay muestras registradas para este lote.</div>
                    ) : (
                        <div className="space-y-3">
                            {relevantSamples.map((sample: MonitoringRecord) => (
                                <div key={sample.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm hover:border-agro-400 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold">M#{sample.sampleNumber}</span>
                                                <span className="text-xs text-gray-500 font-medium">{formatDate(sample.date)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {sample.phenology && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sample.phenology.startsWith('V') ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800' :
                                                        sample.phenology.startsWith('R') ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' :
                                                            'bg-gray-50 text-gray-600 border-gray-200'
                                                        }`}>
                                                        {sample.phenology}
                                                    </span>
                                                )}
                                                {sample.standData && sample.standData.plantsPerHectare > 0 && (
                                                    <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                        <b>{sample.standData.plantsPerHectare.toLocaleString()}</b> pl/Ha
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center text-[10px] text-gray-400 uppercase font-bold">
                                            <UserIcon className="w-3 h-3 mr-1" /> {sample.userName}
                                        </div>
                                    </div>

                                    {sample.pestData && sample.pestData.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            {sample.pestData.map((pd, idx) => (
                                                <div key={idx} className="flex items-center bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                                    <Bug className="w-3.5 h-3.5 text-red-500 mr-2 shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block truncate">{pd.name}</span>
                                                        <span className="text-[10px] text-gray-500 font-mono">{pd.value} <span className="opacity-70">{pd.unit}</span></span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg border border-green-100 dark:border-green-800/50 flex items-center mb-2">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sin novedades registradas.
                                        </div>
                                    )}

                                    {sample.observations && (
                                        <p className={`text-xs italic bg-gray-50/50 dark:bg-gray-900/20 p-2 rounded border border-gray-100 dark:border-gray-800 mb-2 ${getRoleColorClass(getUserRole(sample.userId, data.users, dataOwnerId))}`}>
                                            "{sample.observations}"
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        {sample.media?.photoUrl && (
                                            <button onClick={() => setPreviewImage(sample.media!.photoUrl!)} className="flex-1 flex items-center justify-center p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg text-[10px] font-bold border border-blue-100 dark:border-blue-800">
                                                <ImageIcon className="w-3 h-3 mr-1" /> VER FOTO
                                            </button>
                                        )}
                                        {sample.media?.audioUrl && (
                                            <button onClick={() => toggleAudio(sample.media!.audioUrl!, sample.id)} className="flex-1 flex items-center justify-center p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-[10px] font-bold">
                                                {playingAudioId === sample.id ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                                                AUDIO
                                                <audio id={`audio-${sample.id}`} src={sample.media.audioUrl} className="hidden" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => { setViewSamplesSummary(null); setSelectedSummary(viewSamplesSummary); }} className="text-agro-600 dark:text-agro-400 text-xs font-bold flex items-center hover:underline">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> VOLVER A VALIDACIÓN
                    </button>
                    <Button variant="ghost" onClick={() => setViewSamplesSummary(null)}>Cerrar</Button>
                </div>
            </Modal>

            {/* --- IMAGE PREVIEW MODAL --- */}
            <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Previsualización">
                <div className="flex justify-center items-center bg-black/5 rounded-lg overflow-hidden min-h-[200px]">
                    {previewImage && <img src={previewImage} className="max-w-full max-h-[70vh] object-contain rounded" alt="Full size" />}
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={() => setPreviewImage(null)}>Cerrar</Button>
                </div>
            </Modal>

            <Modal isOpen={!!observationModal} onClose={() => setObservationModal(null)} title={observationModal?.readOnly ? "Nota del Cliente" : "Nota al Ingeniero"}>
                <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Lote: </span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                            {observationModal ? data.plots.find(p => p.id === observationModal.plotId)?.name : ''}
                        </span>
                    </div>

                    {observationModal?.lastModifiedBy && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-800/50 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                                Actualizado por <strong>{observationModal.lastModifiedBy}</strong> el {formatDate(observationModal.lastModifiedAt || '')}
                            </span>
                        </div>
                    )}

                    {observationModal?.audioUrl && (
                        <div className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mic className="w-4 h-4 text-gray-500" />
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Nota de Voz</span>
                            </div>
                            <button
                                onClick={() => toggleAudio(observationModal.audioUrl!, 'obs-' + observationModal.plotId)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold hover:bg-blue-200 transition-colors"
                            >
                                {playingAudioId === 'obs-' + observationModal.plotId ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                {playingAudioId === 'obs-' + observationModal.plotId ? 'Pausar' : 'Escuchar'}
                                <audio id={`audio-obs-${observationModal.plotId}`} src={observationModal.audioUrl} className="hidden" />
                            </button>
                        </div>
                    )}

                    <textarea
                        className="w-full h-40 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-agro-500 outline-none resize-none"
                        placeholder={observationModal?.readOnly ? "No hay notas." : "Escriba aquí los detalles..."}
                        value={observationModal?.text || ''}
                        onChange={(e) => setObservationModal(prev => prev ? { ...prev, text: e.target.value } : null)}
                        autoFocus={!observationModal?.readOnly}
                        disabled={observationModal?.readOnly}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setObservationModal(null)}>
                            {observationModal?.readOnly ? "Cerrar" : "Cancelar"}
                        </Button>
                        {!observationModal?.readOnly && <Button onClick={handleSaveObservation}>Guardar Nota</Button>}
                    </div>
                </div>
            </Modal >
        </>
    );
};
