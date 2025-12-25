
import React, { useMemo } from 'react';
import { Plot, Prescription, PlotAssignment, Agrochemical } from '../../types';
import { calculateItemCost } from '../../hooks/useBudgetCalculator';
import { DollarSign, TrendingUp, AlertTriangle, Wallet, PieChart as PieIcon, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface BudgetSectionProps {
    plots: Plot[];
    assignments: PlotAssignment[];
    prescriptions: Prescription[];
    agrochemicals: Agrochemical[];
    seasonId: string;
    isExporting?: boolean;
}

// --- SUB-COMPONENT: GAUGE CHART (Velocímetro) ---
const GaugeChart: React.FC<{ spent: number; committed: number; budget: number }> = ({ spent, committed, budget }) => {
    const total = spent + committed;
    const safeBudget = budget || 1;
    
    // Percentages (clamped to max 100 for visual sanity in the bar, but logic handles overflow)
    const spentPct = Math.min(100, (spent / safeBudget) * 100);
    const committedPct = Math.min(100 - spentPct, (committed / safeBudget) * 100);
    
    // Rotation for gauge (180 degrees)
    const rotation = -90; // Start at left

    // Colors
    const isCritical = total > budget;
    const isWarning = total > budget * 0.8 && !isCritical;
    const color = isCritical ? '#ef4444' : (isWarning ? '#eab308' : '#22c55e');

    return (
        <div className="relative flex flex-col items-center justify-center h-32 w-full">
            {/* SVG GAUGE */}
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
                {/* Background Arc */}
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
                
                {/* Committed Arc (Ghost/Projection) */}
                <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke={color} 
                    strokeWidth="10" 
                    strokeLinecap="round"
                    strokeDasharray={`${(spentPct + committedPct) * 1.26} 126`} // 126 is approx length of arc r=40
                    className="opacity-30"
                />

                {/* Spent Arc (Solid) */}
                <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke={color} 
                    strokeWidth="10" 
                    strokeLinecap="round"
                    strokeDasharray={`${spentPct * 1.26} 126`}
                />
            </svg>
            
            {/* Center Text */}
            <div className="absolute bottom-0 text-center pb-2">
                <span className={`text-2xl font-bold ${isCritical ? 'text-red-600' : 'text-gray-800 dark:text-white'}`}>
                    {Math.round((total / safeBudget) * 100)}%
                </span>
                <span className="text-[10px] text-gray-400 block uppercase tracking-wide">Consumido</span>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: CATEGORY PIE (Desglose) ---
const CategoryPie: React.FC<{ breakdown: { name: string; value: number; color: string }[] }> = ({ breakdown }) => {
    if (breakdown.length === 0) return <div className="h-32 flex items-center justify-center text-xs text-gray-400 italic">Sin datos</div>;

    return (
        <div className="h-32 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {breakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <RechartsTooltip 
                        formatter={(value: number) => `$${Math.round(value).toLocaleString()}`}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Legend Overlay */}
            <div className="absolute top-0 right-0 h-full flex flex-col justify-center gap-1 overflow-y-auto max-h-full pr-2">
                {breakdown.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="truncate max-w-[60px]" title={item.name}>{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const BudgetSection: React.FC<BudgetSectionProps> = ({
    plots,
    assignments,
    prescriptions,
    agrochemicals,
    seasonId,
    isExporting = false
}) => {

    const stats = useMemo(() => {
        let totalBudget = 0;
        let totalExecuted = 0;   
        let totalCommitted = 0;  
        
        const plotSpends: { 
            id: string; 
            name: string; 
            spent: number; 
            committed: number;
            totalSpent: number; 
            budget: number;
            remaining: number;
            status: 'ok' | 'warning' | 'critical';
            breakdown: { name: string; value: number; color: string }[];
        }[] = [];

        // Colors for Pie Chart
        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

        plots.forEach(plot => {
            const assignment = assignments.find(a => a.plotId === plot.id && a.seasonId === seasonId);
            const plotBudget = assignment?.budget || 0;
            totalBudget += plotBudget;

            let plotExecuted = 0;
            let plotCommitted = 0;
            const categoryMap = new Map<string, number>();

            const plotRecipes = prescriptions.filter(p => 
                p.status === 'active' && p.plotIds.includes(plot.id)
            );

            plotRecipes.forEach(recipe => {
                const execution = recipe.executionData?.[plot.id];
                const isExecuted = execution?.executed;

                recipe.items.forEach(item => {
                    const cost = calculateItemCost(item, plot.hectares, agrochemicals);
                    const product = agrochemicals.find(a => a.id === item.supplyId);
                    const type = product?.type || 'Otro';

                    if (isExecuted) plotExecuted += cost;
                    else plotCommitted += cost;

                    // Breakdown
                    categoryMap.set(type, (categoryMap.get(type) || 0) + cost);
                });
            });

            totalExecuted += plotExecuted;
            totalCommitted += plotCommitted;
            const totalSpent = plotExecuted + plotCommitted;
            
            let status: 'ok' | 'warning' | 'critical' = 'ok';
            if (plotBudget > 0) {
                if (totalSpent > plotBudget) status = 'critical';
                else if (totalSpent > plotBudget * 0.8) status = 'warning';
            }

            // Prepare breakdown data
            const breakdown = Array.from(categoryMap.entries())
                .map(([name, value], idx) => ({ name, value, color: COLORS[idx % COLORS.length] }))
                .sort((a, b) => b.value - a.value);

            if (totalSpent > 0 || plotBudget > 0) {
                plotSpends.push({
                    id: plot.id,
                    name: plot.name,
                    spent: plotExecuted,
                    committed: plotCommitted,
                    totalSpent,
                    budget: plotBudget,
                    remaining: plotBudget - totalSpent,
                    status,
                    breakdown
                });
            }
        });

        // Sort by Criticality (% used) then by total amount
        const sortedSpenders = plotSpends.sort((a, b) => {
            const pctA = a.budget > 0 ? a.totalSpent / a.budget : 0;
            const pctB = b.budget > 0 ? b.totalSpent / b.budget : 0;
            return pctB - pctA; 
        });

        const topSpenders = isExporting ? sortedSpenders : sortedSpenders.slice(0, 4); // Limit to 4 cards on dashboard

        return {
            totalBudget,
            totalExecuted,
            totalCommitted,
            topSpenders,
            totalProjected: totalExecuted + totalCommitted
        };
    }, [plots, assignments, prescriptions, agrochemicals, seasonId, isExporting]);

    const safeBudget = stats.totalBudget || 1;
    const pctExecuted = Math.min(100, (stats.totalExecuted / safeBudget) * 100);
    const pctCommitted = Math.min(100 - pctExecuted, (stats.totalCommitted / safeBudget) * 100);
    const isOverBudget = stats.totalProjected > stats.totalBudget && stats.totalBudget > 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-700 dark:text-emerald-400">
                    <Wallet className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none">Ejecución Presupuestaria</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Control Financiero de Campaña</p>
                </div>
            </div>

            {/* BARRA GLOBAL (Resumen) */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Presupuesto Global</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">${stats.totalBudget.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className={`text-sm font-bold ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                            {isOverBudget ? '⚠️ Presupuesto Excedido' : `Disponible: $${(stats.totalBudget - stats.totalProjected).toLocaleString()}`}
                        </p>
                    </div>
                </div>
                <div className="h-4 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div style={{ width: `${pctExecuted}%` }} className="bg-blue-600 h-full"></div>
                    <div style={{ width: `${pctCommitted}%` }} className="bg-blue-300 h-full"></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span className="flex items-center"><div className="w-2 h-2 bg-blue-600 rounded-full mr-1"></div> Pagado: ${stats.totalExecuted.toLocaleString()}</span>
                    <span className="flex items-center"><div className="w-2 h-2 bg-blue-300 rounded-full mr-1"></div> Proyectado: ${stats.totalCommitted.toLocaleString()}</span>
                </div>
            </div>

            {/* TARJETAS DE LOTES (SEMÁFORO FINANCIERO) */}
            <div>
                <h4 className="font-bold text-gray-700 dark:text-gray-200 text-sm flex items-center mb-3">
                    <TrendingUp className="w-4 h-4 mr-2 text-gray-400" />
                    Lotes con Mayor Consumo
                </h4>
                
                {stats.topSpenders.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        No hay movimientos financieros registrados.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {stats.topSpenders.map((plot) => (
                            <div key={plot.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                                {/* Header Card */}
                                <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex justify-between items-center">
                                    <span className="font-bold text-gray-800 dark:text-white truncate">{plot.name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        plot.status === 'critical' ? 'bg-red-50 text-red-600 border-red-100' :
                                        plot.status === 'warning' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                        'bg-green-50 text-green-600 border-green-100'
                                    }`}>
                                        {plot.status === 'critical' ? 'CRÍTICO' : plot.status === 'warning' ? 'ALERTA' : 'OK'}
                                    </span>
                                </div>

                                {/* Body */}
                                <div className="p-4 flex-1 flex flex-col gap-4">
                                    {/* Row 1: Gauges & Pie */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex flex-col items-center">
                                            <GaugeChart spent={plot.spent} committed={plot.committed} budget={plot.budget} />
                                        </div>
                                        <div className="w-px h-20 bg-gray-100 dark:bg-gray-700"></div>
                                        <div className="flex-1 flex flex-col items-center">
                                            <CategoryPie breakdown={plot.breakdown} />
                                            <span className="text-[9px] text-gray-400 mt-1">Desglose Insumos</span>
                                        </div>
                                    </div>

                                    {/* Row 2: Financial Projection */}
                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 text-xs space-y-1 border border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Presupuesto:</span>
                                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">${plot.budget.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Disponible Real:</span>
                                            <span className={`font-mono font-bold ${plot.remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                ${plot.remaining.toLocaleString()}
                                            </span>
                                        </div>
                                        
                                        {/* PROJECTION WARNING */}
                                        {plot.committed > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-start gap-1.5 text-[10px]">
                                                <AlertTriangle className={`w-3 h-3 shrink-0 mt-0.5 ${plot.remaining - plot.committed < 0 ? 'text-red-500' : 'text-blue-500'}`} />
                                                <span className={`${plot.remaining - plot.committed < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                    Si aplica lo pendiente, {plot.remaining - plot.committed < 0 ? 'excederá presupuesto.' : 'usará ' + Math.round(((plot.spent + plot.committed)/plot.budget)*100) + '% del total.'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
