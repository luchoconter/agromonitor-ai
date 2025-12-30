import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { Select, Button, Modal, Input } from '../UI';
import {
    CheckCircle2, Filter, Calendar, Mic, Play, Pause, Trash2,
    AlertTriangle, ShoppingCart, Info, MapPin, Clock
} from 'lucide-react';
import * as Storage from '../../services/storageService';
import { Prescription, PrescriptionExecution, ExecutionItem, PrescriptionItem } from '../../types';

interface ExecutionModeProps {
    onBack: () => void;
    forcedCompanyId?: string;
}

export const ExecutionMode: React.FC<ExecutionModeProps> = ({ onBack, forcedCompanyId }) => {
    const { data, userCompanies } = useData();
    const { showNotification } = useUI();
    const { currentUser } = useAuth();

    // Filters
    const [selectedCompanyId, setSelectedCompanyId] = useState(forcedCompanyId || '');

    // Update if prop changes
    React.useEffect(() => {
        if (forcedCompanyId) setSelectedCompanyId(forcedCompanyId);
    }, [forcedCompanyId]);
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [statusFilter, setStatusFilter] = useState<'pending' | 'executed'>('pending');

    // Execution Modal State
    const [executingRecipe, setExecutingRecipe] = useState<Prescription | null>(null);
    const [executingPlotId, setExecutingPlotId] = useState<string | null>(null);
    const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);
    const [observation, setObservation] = useState('');
    const [actualHectares, setActualHectares] = useState(0);
    const [actualItems, setActualItems] = useState<ExecutionItem[]>([]);
    const [actualTaskCosts, setActualTaskCosts] = useState<Record<string, number>>({});

    // Audio State
    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    // Delete State
    const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null);

    // Helpers
    const availableFields = data.fields.filter(f => !selectedCompanyId || f.companyId === selectedCompanyId);

    // Filter Recipes
    const filteredRecipes = useMemo(() => {
        return data.prescriptions.filter(p => {
            if (p.status === 'archived') return false;

            // Context Filters
            if (selectedCompanyId && p.companyId !== selectedCompanyId) return false;
            if (selectedFieldId && p.fieldId !== selectedFieldId) return false;

            // Status Filter
            // Ensure plotIds is array and exists
            if (!p.plotIds || !Array.isArray(p.plotIds)) return false;

            const allPlotsDone = p.plotIds.every(pid => p.executionData?.[pid]?.executed);

            if (statusFilter === 'pending') {
                return !allPlotsDone; // Show if ANY plot is pending (not fully executed)
            } else {
                return allPlotsDone; // Show only if ALL plots are executed
            }
        }).sort((a, b) => b.createdAt - a.createdAt);
    }, [data.prescriptions, selectedCompanyId, selectedFieldId, statusFilter]);

    const handleOpenExecutionModal = (recipe: Prescription, plotId: string) => {
        setExecutingRecipe(recipe);
        setExecutingPlotId(plotId);
        setExecutionDate(new Date().toISOString().split('T')[0]);
        setObservation('');

        // Inicializar Valores Reales
        // 1. Hectareas (Buscar si hay metadatos o usar del lote)
        const metaHectares = recipe.plotMetadata?.[plotId]?.affectedHectares;
        const plotDef = data.plots.find(p => p.id === plotId);
        setActualHectares(metaHectares || plotDef?.hectares || 0);

        // 2. Insumos (Clonar desde items recetados)
        const initialItems: ExecutionItem[] = recipe.items.map(i => {
            const product = data.agrochemicals.find(a => a.id === i.supplyId);
            return {
                supplyId: i.supplyId,
                supplyName: i.supplyName,
                dose: parseFloat(i.dose.replace(',', '.')) || 0,
                unit: i.unit,
                cost: product?.price || 0 // Capturar precio actual
            };
        });
        setActualItems(initialItems);

        // 3. Labores (Inicializar Costos Snapshot)
        const initialTaskCosts: Record<string, number> = {};
        recipe.taskIds.forEach(taskId => {
            const task = data.tasks.find(t => t.id === taskId);
            initialTaskCosts[taskId] = task?.pricePerHectare || 0;
        });
        setActualTaskCosts(initialTaskCosts);

        resetRecording();
    };

    const handleConfirmExecution = async () => {
        if (!executingRecipe || !executingPlotId || !currentUser) return;

        try {
            const executionData: PrescriptionExecution = {
                executed: true,
                executedAt: (() => {
                    const [year, month, day] = executionDate.split('-').map(Number);
                    const now = new Date();
                    const localDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
                    return localDate.toISOString();
                })(),
                executedBy: currentUser.name,
                observation: observation,
                audioDuration: audioDuration > 0 ? audioDuration : undefined,
                actualHectares,
                actualItems,
                actualTasks: executingRecipe.taskIds, // Por defecto asumimos mismas tareas, editable a futuro
                actualTaskCosts: actualTaskCosts // Costos reales capturados
            };

            await Storage.markPrescriptionExecuted(
                executingRecipe.id,
                executingPlotId,
                executionData,
                audioBlobUrl || undefined
            );

            showNotification("Aplicación registrada exitosamente", "success");
            setExecutingRecipe(null);
            setExecutingPlotId(null);
        } catch (error) {
            console.error(error);
            showNotification("Error al registrar aplicación", "error");
        }
    };

    const handleDelete = async () => {
        if (!recipeToDelete) return;
        try {
            await Storage.deletePrescription(recipeToDelete);
            showNotification("Receta eliminada correctamente", "success");
            setRecipeToDelete(null);
        } catch (error) {
            console.error(error);
            showNotification("Error al eliminar la receta", "error");
        }
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col xl:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Modo Ejecución</h2>
                        <p className="text-xs text-gray-500">Marcar recetas como aplicadas</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto items-center">
                    {/* Status Toggle */}
                    <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold w-full sm:w-auto">
                        <button onClick={() => setStatusFilter('pending')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-all ${statusFilter === 'pending' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Pendientes</button>
                        <button onClick={() => setStatusFilter('executed')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-all ${statusFilter === 'executed' ? 'bg-white dark:bg-gray-600 shadow text-green-600 dark:text-green-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Ejecutadas</button>
                    </div>

                    <Select
                        label=""
                        options={[{ value: '', label: 'Todas las Empresas' }, ...userCompanies.map(c => ({ value: c.id, label: c.name }))]}
                        value={selectedCompanyId}
                        onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedFieldId(''); }}
                        className="w-full sm:w-48 text-xs h-10"
                        disabled={!!forcedCompanyId}
                    />
                    <Select
                        label=""
                        options={[{ value: '', label: 'Todos los Campos' }, ...availableFields.map(f => ({ value: f.id, label: f.name }))]}
                        value={selectedFieldId}
                        onChange={(e) => setSelectedFieldId(e.target.value)}
                        className="w-full sm:w-48 text-xs h-10"
                        disabled={!selectedCompanyId && availableFields.length === 0}
                    />
                </div>
            </div>

            {/* Content using filteredRecipes directly */}
            {filteredRecipes.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/10 rounded-xl border border-gray-100 dark:border-gray-900/30">
                    <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No se encontraron recetas {statusFilter === 'pending' ? 'pendientes' : 'ejecutadas'}.</p>
                    {(selectedCompanyId || selectedFieldId) && <p className="text-xs text-gray-400 mt-1">Prueba quitando los filtros de Empresa/Campo.</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in group hover:shadow-md transition-shadow">
                            {/* Recipe Header */}
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-400 uppercase">{new Date(recipe.createdAt).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {data.fields.find(f => f.id === recipe.fieldId)?.name || 'Campo'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusFilter === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                            {statusFilter === 'pending' ? 'PENDIENTE' : 'EJECUTADA'}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setRecipeToDelete(recipe.id); }}
                                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-500 transition-colors"
                                            title="Eliminar Receta"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">
                                    {recipe.items.map(i => i.supplyName).join(', ')}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Info className="w-3 h-3" />
                                    <span>{recipe.items.length} Insumos • {recipe.taskNames.join(', ')}</span>
                                </div>
                            </div>

                            {/* Lots List */}
                            <div className="p-4 flex-1">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Estado por Lote
                                </h4>
                                <div className="space-y-2">
                                    {recipe.plotIds.map(pid => {
                                        const pName = recipe.plotNames[recipe.plotIds.indexOf(pid)] || 'Desconocido';
                                        const isexecuted = recipe.executionData?.[pid]?.executed;
                                        const executionDetails = recipe.executionData?.[pid];

                                        // --- DIFFERENCE CALCULATION ---
                                        const differences: string[] = [];
                                        if (isexecuted && executionDetails) {
                                            // 1. Hectares Comparison
                                            const prescribedHa = recipe.plotMetadata?.[pid]?.affectedHectares ?? (data.plots.find(p => p.id === pid)?.hectares || 0);
                                            const actualHa = executionDetails.actualHectares || 0;
                                            if (Math.abs(prescribedHa - actualHa) > 0.1) {
                                                differences.push(`Sup: ${prescribedHa}ha ➔ ${actualHa}ha`);
                                            }

                                            // 2. Items Comparison
                                            const prescribedItemsMap = new Map<string, PrescriptionItem>(recipe.items.map(i => [i.supplyId, i]));
                                            const actualItemsMap = new Map<string, ExecutionItem>((executionDetails.actualItems || []).map(i => [i.supplyId, i]));

                                            // Check missing or modified
                                            prescribedItemsMap.forEach((pItem, supplyId) => {
                                                const aItem = actualItemsMap.get(supplyId);
                                                if (!aItem) {
                                                    differences.push(`No aplicado: ${pItem.supplyName}`);
                                                } else {
                                                    const pDose = parseFloat(pItem.dose.toString().replace(',', '.'));
                                                    if (Math.abs(pDose - aItem.dose) > 0.001) {
                                                        const pUnit = pItem.unit.split('/')[0] || pItem.unit; // Clean unit for display
                                                        differences.push(`${pItem.supplyName}: ${pDose} ➔ ${aItem.dose} ${aItem.unit}`);
                                                    }
                                                }
                                            });

                                            // Check added
                                            actualItemsMap.forEach((aItem, supplyId) => {
                                                if (!prescribedItemsMap.has(supplyId)) {
                                                    differences.push(`Extra: ${aItem.supplyName} (${aItem.dose} ${aItem.unit})`);
                                                }
                                            });

                                            // 3. Tasks Comparison
                                            const prescribedTasks = new Set(recipe.taskIds);
                                            const actualTasks = new Set(executionDetails.actualTasks || []);

                                            // Missing tasks
                                            prescribedTasks.forEach(tid => {
                                                if (!actualTasks.has(tid)) {
                                                    const tName = recipe.taskNames[recipe.taskIds.indexOf(tid)] || 'Labor';
                                                    differences.push(`No realizada: ${tName}`);
                                                }
                                            });

                                            // Extra tasks
                                            actualTasks.forEach(tid => {
                                                if (!prescribedTasks.has(tid)) {
                                                    const tName = data.tasks.find(t => t.id === tid)?.name || 'Labor Extra';
                                                    differences.push(`Extra: ${tName}`);
                                                }
                                            });
                                        }

                                        return (
                                            <div key={pid} className={`flex flex-col p-3 rounded-lg border transition-colors ${isexecuted ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>

                                                {/* Main Row */}
                                                <div className="flex justify-between items-center w-full">
                                                    <div>
                                                        <span className={`block font-medium text-sm ${isexecuted ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>{pName}</span>
                                                        {recipe.plotMetadata?.[pid]?.observation && (
                                                            <span className="text-[10px] text-gray-500 italic block">"{recipe.plotMetadata[pid].observation}"</span>
                                                        )}
                                                        {recipe.plotMetadata?.[pid]?.affectedHectares && !isexecuted && (
                                                            <span className="text-[10px] text-blue-600 block">{recipe.plotMetadata[pid].affectedHectares} ha</span>
                                                        )}
                                                    </div>

                                                    {isexecuted ? (
                                                        <div className="flex flex-col items-end gap-1 text-right max-w-[60%]">
                                                            <div className="flex items-center gap-1 text-green-700 dark:text-green-400 font-bold text-xs">
                                                                <span>{new Date(executionDetails?.executedAt || '').toLocaleDateString()}</span>
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">por {executionDetails?.executedBy || 'Desconocido'}</span>

                                                            {executionDetails?.observation && (
                                                                <div className="bg-white dark:bg-gray-800/50 px-2 py-1 rounded border border-green-100 dark:border-green-800 shadow-sm mt-1">
                                                                    <p className="text-[10px] text-gray-600 dark:text-gray-400 italic">"{executionDetails.observation}"</p>
                                                                </div>
                                                            )}

                                                            {executionDetails?.audioUrl && (
                                                                <div className="mt-1">
                                                                    <button
                                                                        onClick={() => setPlayingAudioId(playingAudioId === pid ? null : pid)}
                                                                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all ${playingAudioId === pid ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                                                    >
                                                                        {playingAudioId === pid ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                                                        {playingAudioId === pid ? 'Pausar Nota' : 'Escuchar Nota'}
                                                                    </button>
                                                                    {playingAudioId === pid && (
                                                                        <audio src={executionDetails.audioUrl} autoPlay onEnded={() => setPlayingAudioId(null)} className="hidden" />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleOpenExecutionModal(recipe, pid)}
                                                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm self-center"
                                                        >
                                                            VER RECETA
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Differences Warning Block */}
                                                {differences.length > 0 && (
                                                    <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-md p-2 animate-fade-in w-full">
                                                        <div className="flex items-center gap-1 mb-1">
                                                            <AlertTriangle className="w-3 h-3 text-red-600" />
                                                            <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">Diferencias</span>
                                                        </div>
                                                        <ul className="space-y-1">
                                                            {differences.map((diff, i) => (
                                                                <li key={i} className="text-[10px] text-red-600 dark:text-red-300 flex items-start gap-1">
                                                                    <span className="mt-0.5">•</span> {diff}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer */}
                            {recipe.notes && (
                                <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 text-xs text-gray-600 dark:text-gray-400 border-t border-yellow-100 dark:border-yellow-900/30">
                                    <span className="font-bold">Nota:</span> {recipe.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Execution Modal */}
            {executingRecipe && executingPlotId && (
                <Modal
                    isOpen={!!executingRecipe}
                    onClose={() => setExecutingRecipe(null)}
                    title="Registrar Aplicación"
                >
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                            <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm">
                                {executingRecipe.plotNames[executingRecipe.plotIds.indexOf(executingPlotId)]}
                            </h4>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                Confirmar que se aplicó la receta correctamente.
                            </p>
                        </div>

                        <Input
                            label="Fecha de Aplicación"
                            type="date"
                            value={executionDate}
                            onChange={(e) => setExecutionDate(e.target.value)}
                        />

                        {/* Actual Values Edit Section */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                            <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-3">Detalles de Aplicación Real</h5>

                            {/* Hectares Override */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Hectáreas Aplicadas Realmente</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                                        value={actualHectares}
                                        onChange={(e) => setActualHectares(parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-sm text-gray-500">ha</span>
                                </div>
                            </div>

                            {/* Supplies Override */}
                            <div className="space-y-3 mb-4">
                                <label className="block text-xs font-medium text-gray-500">Insumos y Dosis Reales</label>
                                {actualItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{item.supplyName}</p>
                                        </div>
                                        <div className="w-20">
                                            <input
                                                type="number"
                                                className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-right dark:bg-gray-700 dark:text-white"
                                                value={item.dose}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const newItems = [...actualItems];
                                                    newItems[idx].dose = val;
                                                    setActualItems(newItems);
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 w-10">{item.unit}</span>
                                        <button
                                            onClick={() => {
                                                const newItems = [...actualItems];
                                                newItems.splice(idx, 1);
                                                setActualItems(newItems);
                                            }}
                                            className="text-red-500 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <div className="text-xs text-center text-gray-400 italic">
                                    Si usaste otro insumo no listado, agregalo en observaciones por ahora.
                                </div>
                            </div>

                            {/* Tasks Override (NEW) */}
                            {executingRecipe.taskIds.length > 0 && (
                                <div className="space-y-3">
                                    <label className="block text-xs font-medium text-gray-500">Labores ($/ha)</label>
                                    {executingRecipe.taskIds.map((taskId) => {
                                        const taskName = executingRecipe.taskNames[executingRecipe.taskIds.indexOf(taskId)];
                                        const cost = actualTaskCosts[taskId] ?? 0;
                                        return (
                                            <div key={taskId} className="flex gap-2 items-center bg-purple-50 dark:bg-purple-900/10 p-2 rounded-lg border border-purple-100 dark:border-purple-800">
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{taskName}</p>
                                                </div>
                                                <div className="w-24 flex items-center gap-1">
                                                    <span className="text-xs text-gray-400">$</span>
                                                    <input
                                                        type="number"
                                                        className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-right dark:bg-gray-700 dark:text-white"
                                                        value={cost}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setActualTaskCosts(prev => ({ ...prev, [taskId]: val }));
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500">/ha</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones (Opcional)</label>
                            <textarea
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm h-20 resize-none"
                                placeholder="Ej: Viento fuerte, se aplicó solo la mitad..."
                                value={observation}
                                onChange={(e) => setObservation(e.target.value)}
                            />
                        </div>

                        {/* Audio Recorder Reuse */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota de Voz (Opcional)</label>
                            {!isRecording && !audioBlobUrl ? (
                                <button onClick={toggleRecording} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-50">
                                    <Mic className="w-4 h-4" /> Grabar Reporte
                                </button>
                            ) : (
                                <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100">
                                    {isRecording ? (
                                        <span className="text-red-600 text-sm font-bold flex-1">Grabando... {Math.round(audioDuration)}s</span>
                                    ) : (
                                        <span className="text-gray-700 text-sm font-bold flex-1">Audio Listo ({Math.round(audioDuration)}s)</span>
                                    )}
                                    <button onClick={toggleRecording} className="text-sm font-bold px-3 py-1 bg-white border rounded shadow-sm">
                                        {isRecording ? 'Parar' : 'Re-grabar'}
                                    </button>
                                    {audioBlobUrl && !isRecording && (
                                        <button onClick={resetRecording} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setExecutingRecipe(null)}>Cancelar</Button>
                            <Button onClick={handleConfirmExecution} className="bg-green-600 text-white hover:bg-green-700">
                                Confirmar Hecho <CheckCircle2 className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!recipeToDelete}
                onClose={() => setRecipeToDelete(null)}
                title="Eliminar Receta"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <p className="text-sm">¿Estás seguro de que deseas eliminar esta receta? Esta acción no se puede deshacer y perderás todo el historial asociado.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setRecipeToDelete(null)}>Cancelar</Button>
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
