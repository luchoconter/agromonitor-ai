
import { User } from './auth';
import {
  Company, Field, Plot, Season, Pest, Crop, Agrochemical, Task,
  Prescription, PrescriptionTemplate, PlotAssignment, MonitoringRecord, LotSummary
} from './models';

export interface AppState {
  companies: Company[];
  fields: Field[];
  plots: Plot[];
  seasons: Season[];
  pests: Pest[];
  crops: Crop[];
  agrochemicals: Agrochemical[];
  tasks: Task[];
  prescriptions: Prescription[];
  templates: PrescriptionTemplate[];
  assignments: PlotAssignment[];
  monitorings: MonitoringRecord[];
  lotSummaries: LotSummary[];
  users: User[];
}

export type ViewState =
  | 'home'
  | 'history'
  | 'analytics'
  | 'recipes'
  | 'crop-assignments'
  | 'structure-hub'
  | 'manage-companies'
  | 'manage-fields'
  | 'manage-plots'
  | 'manage-seasons'
  | 'manage-pests'
  | 'manage-crops'
  | 'manage-agrochemicals'
  | 'manage-tasks'
  | 'manage-team'
  | 'budget-manager'
  | 'track-history';

export interface SelectionState {
  companyId: string | null;
  fieldId: string | null;
  plotId: string | null;
  seasonId: string | null;
  dateReference?: string;
}
