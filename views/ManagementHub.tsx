import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

// Explicit Managers
import { CompanyManager } from '../components/management/CompanyManager';
import { FieldManager } from '../components/management/FieldManager';
import { PlotManager } from '../components/management/PlotManager';
import { SeasonManager } from '../components/management/SeasonManager';
import { PestManager } from '../components/management/PestManager';
import { AgrochemicalManager } from '../components/management/AgrochemicalManager';
import { CropManager, TaskManager } from '../components/management/SimpleManagers';

export const ManagementHub: React.FC = () => {
  const { currentUser } = useAuth();
  const { data, userCompanies } = useData();
  const { view, setView: onNavigate } = useUI();

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0">
            <Button variant="ghost" onClick={() => onNavigate('structure-hub')}><ArrowLeft className="w-4 h-4 mr-2" />Volver</Button>
        </div>

        <div className="flex-1 overflow-hidden">
            {view === 'manage-companies' && <CompanyManager companies={userCompanies} />}
            {view === 'manage-fields' && <FieldManager fields={data.fields.filter(f => userCompanies.some(c => c.id === f.companyId))} companies={userCompanies} />}
            {view === 'manage-plots' && <PlotManager plots={data.plots.filter(p => { if (p.companyId) return userCompanies.some(c => c.id === p.companyId); const f = data.fields.find(f => f.id === p.fieldId); return f && userCompanies.some(c => c.id === f.companyId); })} fields={data.fields.filter(f => userCompanies.some(c => c.id === f.companyId))} companies={userCompanies} />}
            {view === 'manage-seasons' && <SeasonManager seasons={data.seasons} />}
            {view === 'manage-crops' && <CropManager crops={data.crops} />}
            {view === 'manage-pests' && <PestManager pests={data.pests} />}
            {view === 'manage-agrochemicals' && <AgrochemicalManager agrochemicals={data.agrochemicals} />}
            {view === 'manage-tasks' && <TaskManager tasks={data.tasks} />}
        </div>
    </div>
  );
};