import { Budget, Prescription, Agrochemical, Task, PrescriptionExecution } from '../types/models';
import { getBudgets } from './repositories/budgetRepository';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CostBreakdown {
    herbicidas: number;
    insecticidas: number;
    fungicidas: number;
    fertilizantes: number;
    coadyuvantes: number;
    otrosAgroquimicos: number; // Includes seeds if not separated? No, seeds is separate
    semillas: number;
    pulverizacionTerrestre: number;
    pulverizacionSelectiva: number;
    pulverizacionAerea: number;
    siembra: number;
    otrasLabores: number;
    total: number;
}

export interface BudgetExecutionMetrics {
    cropId: string;
    cropName: string; // Helper for UI
    totalHectares: number; // Sum of hectares of all plots assigned to this crop
    budget: Budget | null;
    actuals: CostBreakdown; // USD/Ha
    spentTotal: CostBreakdown; // Total USD
}

// Helpers to map categories
const getSupplyCategoryKey = (type: Agrochemical['type'] | undefined): keyof CostBreakdown | null => {
    if (!type) return 'otrosAgroquimicos';
    const t = type.toLowerCase();
    if (t.includes('herbicida')) return 'herbicidas';
    if (t.includes('insecticida')) return 'insecticidas';
    if (t.includes('fungicida')) return 'fungicidas';
    if (t.includes('fertilizante')) return 'fertilizantes';
    if (t.includes('coadyuvante')) return 'coadyuvantes';
    if (t.includes('semilla')) return 'semillas';
    return 'otrosAgroquimicos';
};

const getTaskCategoryKey = (category: Task['category']): keyof CostBreakdown | null => {
    if (!category) return 'otrasLabores';
    const c = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (c.includes('terrestre')) return 'pulverizacionTerrestre';
    if (c.includes('selectiva')) return 'pulverizacionSelectiva';
    if (c.includes('aerea') || c.includes('aérea')) return 'pulverizacionAerea';
    if (c.includes('siembra')) return 'siembra';
    return 'otrasLabores';
};

// Calculate cost for a single execution (plot within a recipe)
export const calculateExecutionCost = (execution: PrescriptionExecution): CostBreakdown => {
    const costs: CostBreakdown = {
        herbicidas: 0, insecticidas: 0, fungicidas: 0, fertilizantes: 0,
        coadyuvantes: 0, otrosAgroquimicos: 0, semillas: 0,
        pulverizacionTerrestre: 0, pulverizacionSelectiva: 0, pulverizacionAerea: 0,
        siembra: 0, otrasLabores: 0, total: 0
    };
    return costs; // This function is currently unused in the main flow but kept for reference
};

// --- Synchronous Calculation using App State ---
export const calculateBudgetMetrics = (
    companyId: string,
    seasonId: string,
    data: {
        budgets: Budget[],
        assignments: any[],
        plots: any[],
        crops: any[],
        prescriptions: Prescription[],
        agrochemicals: Agrochemical[],
        tasks: Task[]
    }
): BudgetExecutionMetrics[] => {

    // 1. Filter assignments for this company+season
    // Assignments don't have companyId, but plots do.
    const companyPlotIds = new Set(data.plots.filter(p => p.companyId === companyId).map(p => p.id));

    // Crop Stats: CropId -> { hectares: number, plotIds: Set<string> }
    const cropStats: Record<string, { hectares: number, plotIds: Set<string> }> = {};

    data.assignments.forEach(a => {
        if (a.seasonId === seasonId && companyPlotIds.has(a.plotId)) {
            const plot = data.plots.find(p => p.id === a.plotId);
            if (!plot) return;

            if (!cropStats[a.cropId]) cropStats[a.cropId] = { hectares: 0, plotIds: new Set() };
            cropStats[a.cropId].hectares += (plot.hectares || 0);
            cropStats[a.cropId].plotIds.add(a.plotId);
        }
    });

    // 2. Maps for Catalogs
    const supplyTypeMap = new Map(data.agrochemicals.map(a => [a.id, a.type]));
    const taskCategoryMap = new Map(data.tasks.map(t => [t.id, t.category]));
    // New: Map for current task prices as fallback
    const taskPriceMap = new Map(data.tasks.map(t => [t.id, t.pricePerHectare || 0]));

    // 3. Aggregate Costs
    const metrics: BudgetExecutionMetrics[] = [];

    // Initialize metrics for each crop found in assignments
    for (const cropId of Object.keys(cropStats)) {
        const crop = data.crops.find(c => c.id === cropId);
        // Find budget for this crop, company and season
        const budget = data.budgets.find(b =>
            b.companyId === companyId &&
            b.seasonId === seasonId &&
            b.cropId === cropId
        ) || null;

        // Initialize actuals with LEGACY SPENT if available
        let initialSpent = { ...emptyBreakdown() };
        if (budget?.legacySpent) {
            const ha = cropStats[cropId].hectares;
            // Legacy is stored in USD/Ha, convert to Total USD for 'spentTotal' accumulator
            initialSpent = {
                herbicidas: (budget.legacySpent.herbicidas || 0) * ha,
                insecticidas: (budget.legacySpent.insecticidas || 0) * ha,
                fungicidas: (budget.legacySpent.fungicidas || 0) * ha,
                fertilizantes: (budget.legacySpent.fertilizantes || 0) * ha,
                coadyuvantes: (budget.legacySpent.coadyuvantes || 0) * ha,
                otrosAgroquimicos: (budget.legacySpent.otrosAgroquimicos || 0) * ha,
                semillas: (budget.legacySpent.semillas || 0) * ha,
                pulverizacionTerrestre: (budget.legacySpent.pulverizacionTerrestre || 0) * ha,
                pulverizacionSelectiva: (budget.legacySpent.pulverizacionSelectiva || 0) * ha,
                pulverizacionAerea: (budget.legacySpent.pulverizacionAerea || 0) * ha,
                siembra: (budget.legacySpent.siembra || 0) * ha,
                otrasLabores: (budget.legacySpent.otrasLabores || 0) * ha,
                total: 0
            };
            // Calculate total initial
            initialSpent.total = Object.values(initialSpent).reduce((a, b) => a + b, 0);
        }

        metrics.push({
            cropId,
            cropName: crop?.name || 'Desconocido',
            totalHectares: cropStats[cropId].hectares,
            budget: budget,
            actuals: { ...emptyBreakdown() },
            spentTotal: initialSpent // Start with legacy spent
        });
    }

    // 4. Process Prescriptions (Recipes)
    // Filter relevant recipes
    const relevantRecipes = data.prescriptions.filter(p => p.companyId === companyId);
    // Note: Recipes are linked to company. Executions happen on plots.

    relevantRecipes.forEach(recipe => {
        if (!recipe.executionData) return;

        // Iterate over executions
        Object.entries(recipe.executionData).forEach(([plotId, execution]) => {
            if (!execution.executed) return;

            // Find which Crop this plot belongs to in the CURRENT season context
            // Optimization: We use cropStats which describes the season's layout
            const cropMetric = metrics.find(m => cropStats[m.cropId].plotIds.has(plotId));
            if (!cropMetric) return; // Plot execution not relevant to this season's crops

            const ha = execution.actualHectares || 0;

            // Sum Supplies
            execution.actualItems?.forEach(item => {
                const type = supplyTypeMap.get(item.supplyId);
                const key = getSupplyCategoryKey(type); // Uses helper defined above
                if (key) {
                    const cost = (item.dose * (item.cost || 0) * ha); // Total $ for this plot execution
                    cropMetric.spentTotal[key] += cost;
                    cropMetric.spentTotal.total += cost;
                }
            });

            // Sum Tasks
            execution.actualTasks?.forEach(taskId => {
                const cat = taskCategoryMap.get(taskId);
                const key = getTaskCategoryKey(cat); // Uses helper defined above

                // Priority: Captured Actual Cost -> Current Catalog Price -> 0
                let costPerHa = execution.actualTaskCosts?.[taskId];
                if (costPerHa === undefined) {
                    // Fallback for legacy executions
                    costPerHa = taskPriceMap.get(taskId) || 0;
                }

                if (key) {
                    const cost = (costPerHa * ha);
                    cropMetric.spentTotal[key] += cost;
                    cropMetric.spentTotal.total += cost;
                }
            });
        });
    });

    // 5. Normalize Actuals (USD/Ha)
    metrics.forEach(m => {
        if (m.totalHectares > 0) {
            Object.keys(m.spentTotal).forEach(k => {
                const key = k as keyof CostBreakdown;
                m.actuals[key] = m.spentTotal[key] / m.totalHectares;
            });
        }
    });

    return metrics;
};

const emptyBreakdown = (): CostBreakdown => ({
    herbicidas: 0, insecticidas: 0, fungicidas: 0, fertilizantes: 0,
    coadyuvantes: 0, otrosAgroquimicos: 0, semillas: 0,
    pulverizacionTerrestre: 0, pulverizacionSelectiva: 0, pulverizacionAerea: 0,
    siembra: 0, otrasLabores: 0, total: 0
});
