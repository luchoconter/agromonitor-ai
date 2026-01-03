import React, { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { calculateBudgetMetrics, BudgetExecutionMetrics, CostBreakdown } from '../../services/financeService';
import { getBudgets } from '../../services/repositories/budgetRepository';
import { BudgetSummary } from '../finance/BudgetSummary';
import { LegacyBudgetModal } from '../finance/LegacyBudgetModal';
import { BudgetProgressBar } from '../finance/BudgetProgressBar';
import { Wallet, ChevronDown, ChevronUp, AlertTriangle, History } from 'lucide-react';

interface BudgetSectionProps {
    seasonId: string;
    companyId?: string; // Optional if using context
}

export const BudgetSection: React.FC<BudgetSectionProps> = ({ seasonId, companyId }) => {
    const { data } = useData();
    const [metrics, setMetrics] = useState<BudgetExecutionMetrics[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedCropId, setExpandedCropId] = useState<string | null>(null);

    // Legacy Budget Modal State
    const [legacyModalOpen, setLegacyModalOpen] = useState(false);
    const [selectedMetricForLegacy, setSelectedMetricForLegacy] = useState<BudgetExecutionMetrics | null>(null);

    // Fetch Data & Calculate Wrapper to allow refresh
    const loadMetrics = async () => {
        if (!companyId || !seasonId) return;
        setLoading(true);
        try {
            const budgets = await getBudgets(companyId, seasonId);
            const result = calculateBudgetMetrics(companyId, seasonId, { ...data, budgets });
            setMetrics(result);
            if (result.length > 0 && !expandedCropId) {
                setExpandedCropId(result[0].cropId);
            }
        } catch (error) {
            console.error("Error calculating budget:", error);
        } finally {
            setLoading(false);
        }
    };

    // Update effect to use the wrapper
    useEffect(() => { loadMetrics(); }, [companyId, seasonId, data]);

    const handleOpenLegacy = (metric: BudgetExecutionMetrics) => {
        if (!metric.budget) return; // Should allow creating one? Ideally yes, but let's stick to existing
        setSelectedMetricForLegacy(metric);
        setLegacyModalOpen(true);
    };

    const categories: { key: keyof CostBreakdown; label: string }[] = [
        { key: 'herbicidas', label: 'Herbicidas' },
        { key: 'insecticidas', label: 'Insecticidas' },
        { key: 'fungicidas', label: 'Fungicidas' },
        { key: 'fertilizantes', label: 'Fertilizantes' },
        { key: 'coadyuvantes', label: 'Coadyuvantes' },
        { key: 'otrosAgroquimicos', label: 'Otros Agroq.' },
        { key: 'semillas', label: 'Semillas' },
        { key: 'pulverizacionTerrestre', label: 'Pulv. Terr.' },
        { key: 'pulverizacionSelectiva', label: 'Pulv. Sel.' },
        { key: 'pulverizacionAerea', label: 'Pulv. Aérea' },
        { key: 'siembra', label: 'Siembra' },
        { key: 'otrasLabores', label: 'Otras Labores' },
    ];

    if (!companyId) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Modal */}
            {selectedMetricForLegacy && selectedMetricForLegacy.budget && (
                <LegacyBudgetModal
                    isOpen={legacyModalOpen}
                    onClose={() => setLegacyModalOpen(false)}
                    budget={selectedMetricForLegacy.budget}
                    cropName={selectedMetricForLegacy.cropName}
                    onSave={() => {
                        setLegacyModalOpen(false);
                        loadMetrics(); // Refresh data
                    }}
                />
            )}

            <div className="flex items-center gap-2 mb-2">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-700 dark:text-emerald-400">
                    <Wallet className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none">Ejecución Presupuestaria</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Control Financiero de Campaña (USD/ha)</p>
                </div>
            </div>

            {loading && <div className="text-center py-10 opacity-50 flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>Calculando...</div>}

            <div className="grid grid-cols-1 gap-4">
                {metrics.map(metric => {
                    const budgetTotal = metric.budget ? categories.reduce((sum, cat) => sum + (Number(metric.budget![cat.key]) || 0), 0) : 0;
                    const actualTotal = metric.actuals.total;
                    const isExpanded = expandedCropId === metric.cropId;
                    const isOver = actualTotal > budgetTotal && budgetTotal > 0;

                    return (
                        <div key={metric.cropId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all">
                            <div
                                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                onClick={() => setExpandedCropId(isExpanded ? null : metric.cropId)}
                            >
                                <div className="mb-2 sm:mb-0">
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{metric.cropName}</h3>
                                    <p className="text-xs text-gray-500 dark:text-blue-300">
                                        Sup: <span className="font-medium text-gray-700 dark:text-white">{metric.totalHectares} ha</span>
                                        {' '} | Total Gasto: <span className="font-medium text-green-600 dark:text-green-400">${Math.round(metric.spentTotal.total).toLocaleString()}</span>
                                    </p>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400 dark:text-blue-300 font-bold uppercase mb-1">Costo / Presupuesto (ha)</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'}`}>
                                                ${Math.round(actualTotal)}
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-blue-300">/ ${Math.round(budgetTotal)}</span>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/10 animate-fade-in space-y-6">
                                    {!metric.budget ? (
                                        <div className="text-center py-6 text-gray-400 text-sm italic flex flex-col items-center gap-2">
                                            <AlertTriangle className="w-6 h-6 opacity-50" />
                                            No hay presupuesto configurado para este cultivo.
                                        </div>
                                    ) : (
                                        <>
                                            {/* ACTION BAR: Ajustar Saldos */}
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => handleOpenLegacy(metric)}
                                                    className="flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors border border-amber-200"
                                                >
                                                    <History className="w-4 h-4" />
                                                    Cargar Saldos Iniciales
                                                </button>
                                            </div>

                                            {/* 1. EXECUTIVE SUMMARY */}
                                            <BudgetSummary
                                                totalSpent={metric.actuals.total}
                                                totalBudget={budgetTotal}
                                                distribution={{
                                                    agrochemicals:
                                                        metric.actuals.herbicidas +
                                                        metric.actuals.insecticidas +
                                                        metric.actuals.fungicidas +
                                                        metric.actuals.coadyuvantes +
                                                        metric.actuals.otrosAgroquimicos,
                                                    fertilizers: metric.actuals.fertilizantes,
                                                    seeds: metric.actuals.semillas,
                                                    labor:
                                                        metric.actuals.pulverizacionTerrestre +
                                                        metric.actuals.pulverizacionSelectiva +
                                                        metric.actuals.pulverizacionAerea +
                                                        metric.actuals.siembra +
                                                        metric.actuals.otrasLabores
                                                }}
                                                budgetBreakdown={{
                                                    agrochemicals:
                                                        (Number(metric.budget.herbicidas) || 0) +
                                                        (Number(metric.budget.insecticidas) || 0) +
                                                        (Number(metric.budget.fungicidas) || 0) +
                                                        (Number(metric.budget.coadyuvantes) || 0) +
                                                        (Number(metric.budget.otrosAgroquimicos) || 0),
                                                    fertilizers: Number(metric.budget.fertilizantes) || 0,
                                                    seeds: Number(metric.budget.semillas) || 0,
                                                    labor:
                                                        (Number(metric.budget.pulverizacionTerrestre) || 0) +
                                                        (Number(metric.budget.pulverizacionSelectiva) || 0) +
                                                        (Number(metric.budget.pulverizacionAerea) || 0) +
                                                        (Number(metric.budget.siembra) || 0) +
                                                        (Number(metric.budget.otrasLabores) || 0)
                                                }}
                                            />

                                            {/* 2. DETAILED BREAKDOWN GRID */}
                                            <div>
                                                <div className="flex items-center justify-between mb-4 mt-8 pb-2 border-b border-gray-200 dark:border-gray-700">
                                                    <h4 className="text-xs font-bold text-gray-500 dark:text-blue-300 uppercase tracking-widest">
                                                        Desglose por Categoría
                                                    </h4>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                                    {categories.map(cat => {
                                                        const budgetVal = Number(metric.budget![cat.key]) || 0;
                                                        const actualVal = metric.actuals[cat.key];

                                                        // Show all categories for completeness
                                                        return (
                                                            <div key={cat.key} className="h-full">
                                                                <BudgetProgressBar
                                                                    label={cat.label}
                                                                    value={actualVal}
                                                                    max={budgetVal}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {metrics.length === 0 && !loading && (
                <div className="text-center py-10 text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    No hay datos de cultivos para esta campaña.
                </div>
            )}
        </div>
    );
};
