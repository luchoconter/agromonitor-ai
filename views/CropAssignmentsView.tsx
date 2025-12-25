
import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Select, Button, Modal, Input } from '../components/UI';
import { AlertCircle, Filter, MapPin, Edit2, DollarSign } from 'lucide-react';
import * as Storage from '../services/storageService';

export const CropAssignmentsView: React.FC = () => {
  const { data, userCompanies, dataOwnerId, dataOwnerName } = useData();
  const { currentUser } = useAuth();
  
  // State for Filters
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');

  // State for Assignment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<{
      plotId: string;
      plotName: string;
      cropId: string;
      budget: string;
      assignmentId?: string;
  } | null>(null);

  // Initialize Default Season
  useEffect(() => {
    if (!selectedSeasonId && data.seasons.length > 0) {
        const active = data.seasons.find(s => s.isActive);
        setSelectedSeasonId(active ? active.id : data.seasons[0].id);
    }
  }, [data.seasons, selectedSeasonId]);

  // Open Modal logic
  const handleOpenAssignment = (plotId: string, plotName: string) => {
      // Find existing assignment
      const existing = data.assignments.find(a => a.plotId === plotId && a.seasonId === selectedSeasonId);
      
      setEditingAssignment({
          plotId,
          plotName,
          cropId: existing?.cropId || '',
          budget: existing?.budget ? existing.budget.toString() : '',
          assignmentId: existing?.id
      });
      setIsModalOpen(true);
  };

  // Save logic
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataOwnerId || !selectedSeasonId || !editingAssignment) return;

    await Storage.savePlotAssignment(
        editingAssignment.assignmentId,
        editingAssignment.plotId,
        selectedSeasonId,
        editingAssignment.cropId,
        dataOwnerId,
        dataOwnerName,
        editingAssignment.budget ? parseFloat(editingAssignment.budget) : undefined
    );

    setIsModalOpen(false);
    setEditingAssignment(null);
  };

  // --- FILTER LOGIC ---

  // 1. Determine Fields available in the dropdown
  const availableFieldsForFilter = data.fields.filter(f => 
    selectedCompanyId 
        ? f.companyId === selectedCompanyId 
        : userCompanies.some(c => c.id === f.companyId)
  );

  // 2. Filter Plots based on selection
  const visiblePlots = data.plots.filter(p => {
      // Resolve context
      const field = data.fields.find(f => f.id === p.fieldId);
      const companyId = p.companyId || field?.companyId;

      // Security check: Must belong to one of the user's companies
      if (!companyId || !userCompanies.some(uc => uc.id === companyId)) return false;

      // Apply Filters
      if (selectedCompanyId && companyId !== selectedCompanyId) return false;
      if (selectedFieldId && p.fieldId !== selectedFieldId) return false;

      return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Helper to get current assignment details for display
  const getAssignmentDetails = (plotId: string) => {
      const assignment = data.assignments.find(a => a.plotId === plotId && a.seasonId === selectedSeasonId);
      const crop = data.crops.find(c => c.id === assignment?.cropId);
      return {
          cropName: crop?.name || 'Sin Asignar',
          budget: assignment?.budget
      };
  };

  const getContextLabel = () => {
      if (selectedFieldId) return `Lotes de ${data.fields.find(f => f.id === selectedFieldId)?.name}`;
      if (selectedCompanyId) return `Lotes de ${userCompanies.find(c => c.id === selectedCompanyId)?.name}`;
      return "Todos los Lotes";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      
      {/* 1. Context Filters (Compact) */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <Select 
                label="" 
                options={data.seasons.sort((a, b) => a.name.localeCompare(b.name)).map(s => ({ value: s.id, label: s.name }))} 
                value={selectedSeasonId} 
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                placeholder="Seleccionar Campaña..."
                className="text-sm font-bold"
             />
             <Select 
                label="" 
                options={userCompanies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))} 
                value={selectedCompanyId} 
                onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedFieldId(''); }}
                placeholder="Todas las Empresas"
                className="text-sm"
             />
             <Select 
                label="" 
                options={availableFieldsForFilter.sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ value: f.id, label: f.name }))} 
                value={selectedFieldId} 
                onChange={(e) => setSelectedFieldId(e.target.value)}
                placeholder="Todos los Campos"
                className="text-sm"
             />
          </div>
      </div>

      {/* 2. Plot List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[300px] relative">
         <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
             <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center">
                <Filter className="w-4 h-4 mr-2 opacity-50" />
                {getContextLabel()}
             </h3>
             <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                {visiblePlots.length} lotes
             </span>
         </div>

         {visiblePlots.length === 0 ? (
             <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                 <AlertCircle className="w-10 h-10 mb-2 text-gray-300 dark:text-gray-600" />
                 <p className="font-medium">No se encontraron lotes</p>
                 <p className="text-sm mt-1">Intente cambiar los filtros o cree nuevos lotes en la sección de Gestión.</p>
             </div>
         ) : (
             <div className="divide-y divide-gray-100 dark:divide-gray-700">
                 {visiblePlots.map(plot => {
                     const field = data.fields.find(f => f.id === plot.fieldId);
                     const company = userCompanies.find(c => c.id === (plot.companyId || field?.companyId));
                     const { cropName, budget } = getAssignmentDetails(plot.id);
                     
                     return (
                     <div key={plot.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-gray-800 dark:text-gray-200 truncate flex items-center">
                                {plot.name}
                             </h4>
                             <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {field?.name || 'Sin Campo'}
                                </span>
                                {(!selectedCompanyId) && (
                                    <span className="hidden sm:inline-block px-1.5 py-0.5">
                                        • {company?.name}
                                    </span>
                                )}
                                <span>• {plot.hectares} Has</span>
                             </div>
                         </div>
                         
                         {/* Action Area */}
                         <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end bg-gray-50 dark:bg-gray-900/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700 sm:bg-transparent sm:border-0 sm:p-0">
                             <div className="flex flex-col sm:items-end mr-2">
                                <span className={`text-sm font-semibold ${cropName === 'Sin Asignar' ? 'text-gray-400' : 'text-agro-600 dark:text-agro-400'}`}>
                                    {cropName}
                                </span>
                                {budget !== undefined && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                        <DollarSign className="w-3 h-3 mr-0.5" /> Presupuesto: ${budget}
                                    </span>
                                )}
                             </div>
                             <button 
                                onClick={() => handleOpenAssignment(plot.id, plot.name)}
                                className="p-2 text-gray-500 hover:text-agro-600 dark:text-gray-400 dark:hover:text-agro-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-sm transition-all"
                                title="Editar Asignación"
                             >
                                 <Edit2 className="w-4 h-4" />
                             </button>
                         </div>
                     </div>
                     );
                 })}
             </div>
         )}
      </div>

      {/* EDIT ASSIGNMENT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Asignación de Lote">
          {editingAssignment && (
              <form onSubmit={handleSaveAssignment} className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-sm mb-4">
                      <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">Lote Seleccionado</p>
                      <p className="font-bold text-gray-800 dark:text-gray-200 text-lg">{editingAssignment.plotName}</p>
                  </div>

                  <Select 
                      label="Cultivo" 
                      options={data.crops.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))}
                      value={editingAssignment.cropId}
                      onChange={(e) => setEditingAssignment({ ...editingAssignment, cropId: e.target.value })}
                      placeholder="Seleccionar Cultivo..."
                      required
                  />

                  <Input 
                      label="Presupuesto Total Insumos (USD)"
                      type="number"
                      placeholder="Ej: 5000"
                      value={editingAssignment.budget}
                      onChange={(e) => setEditingAssignment({ ...editingAssignment, budget: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      * Presupuesto estimado para toda la campaña en este lote.
                  </p>

                  <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                      <Button type="submit">Guardar Asignación</Button>
                  </div>
              </form>
          )}
      </Modal>

    </div>
  );
};