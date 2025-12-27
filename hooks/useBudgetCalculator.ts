
import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { PrescriptionItem, Agrochemical, Plot, PlotAssignment, Prescription } from '../types/models';

export interface BudgetStats {
    totalBudget: number;
    spent: number;
    remaining: number;
    progress: number; // 0 to 100
    isOverBudget: boolean;
}

// --- PURE FUNCTIONS (Logic Extracted) ---

export const calculateItemCost = (item: PrescriptionItem, hectares: number, agrochemicals: Agrochemical[]): number => {
    // PRECIO: Prioridad 1: Precio Congelado (Snapshot), Prioridad 2: Precio de Catálogo Actual
    let priceToUse = 0;

    if (item.lockedPrice !== undefined && item.lockedPrice !== null) {
        priceToUse = item.lockedPrice;
    } else {
        // Fallback para recetas antiguas o ítems en borrador (usar precio actual)
        const product = agrochemicals.find(a => a.id === item.supplyId);
        priceToUse = product?.price || 0;
    }

    if (!priceToUse) return 0;

    // Manejo robusto de decimales (soporte para coma)
    const doseStr = String(item.dose).replace(',', '.');
    let dose = parseFloat(doseStr);

    if (isNaN(dose)) return 0;

    // Normalización de Unidades
    // IMPORTANTE: El orden de chequeo es CRÍTICO para evitar falsos positivos
    const unitLower = item.unit.toLowerCase();

    // 1. Unidades Micro
    if (unitLower.includes('mg')) {
        dose = dose / 1000000;
    }
    // 2. Unidades Mili (Líquidos o Sólidos pequeños)
    else if (unitLower.includes('ml') || unitLower.includes('cm3') || unitLower.includes('cc')) {
        dose = dose / 1000;
    }
    // 3. Kilos (Debe chequearse antes de Gramos)
    else if (unitLower.includes('kg')) {
        dose = dose * 1;
    }
    // 4. Gramos
    else if (unitLower.includes('g')) {
        dose = dose / 1000;
    }
    // 5. Litros (Base líquida)
    else if (unitLower.includes('l')) {
        dose = dose * 1;
    }

    // Costo = (Dosis Normalizada * Precio Unitario) * Hectáreas
    return (dose * priceToUse) * hectares;
};

export const getPlotBudgetStats = (
    plot: Plot | undefined,
    assignment: PlotAssignment | undefined,
    prescriptions: Prescription[],
    agrochemicals: Agrochemical[]
): BudgetStats => {
    // Permitir cálculo incluso si no hay assignment (presupuesto 0), siempre que haya plot
    if (!plot) {
        return { totalBudget: 0, spent: 0, remaining: 0, progress: 0, isOverBudget: false };
    }

    const totalBudget = assignment?.budget || 0;

    // LOGIC REMOVED: Budget calculation from recipes is no longer valid.
    // Future implementation will use a different source.
    const spent = 0;

    const remaining = totalBudget - spent;
    const progress = 0;
    const isOverBudget = false;

    return {
        totalBudget,
        spent,
        remaining,
        progress,
        isOverBudget
    };
};

// --- HOOK ---

export const useBudgetCalculator = (plotId: string | null, seasonId: string | null) => {
    const { data } = useData();

    const plot = useMemo(() =>
        data.plots.find(p => p.id === plotId),
        [data.plots, plotId]);

    const assignment = useMemo(() =>
        data.assignments.find(a => a.plotId === plotId && a.seasonId === seasonId),
        [data.assignments, plotId, seasonId]);

    const calculateRecipeCost = (items: PrescriptionItem[], targetPlotId?: string): number => {
        return 0;
    };

    const historicalStats = useMemo((): BudgetStats => {
        return getPlotBudgetStats(plot, assignment, data.prescriptions, data.agrochemicals);
    }, [plot, assignment, data.prescriptions, data.agrochemicals]);

    return {
        ...historicalStats,
        calculateRecipeCost,
        hectares: plot?.hectares || 0,
        hasBudget: (assignment?.budget || 0) > 0
    };
};
