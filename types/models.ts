
export interface Company {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
}

export interface Field {
  id: string;
  name: string;
  companyId: string;
  ownerId: string;
  ownerName?: string;
}

export interface Plot {
  id: string;
  name: string;
  fieldId: string;
  companyId?: string;
  hectares: number;
  ownerId: string;
  ownerName?: string;
}

export interface Season {
  id: string;
  name: string;
  isActive: boolean;
  ownerId: string;
  ownerName?: string;
}

export interface Pest {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  imageUrl?: string;
  defaultUnit?: string;
}

export interface Crop {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
}

export interface Agrochemical {
  id: string;
  name: string; 
  type: 'Herbicida' | 'Insecticida' | 'Fungicida' | 'Fertilizante' | 'Coadyuvante' | 'Semilla' | 'Otro';
  activeIngredient?: string; 
  ownerId: string;
  ownerName?: string;
  price?: number; // Precio numérico actual de mercado
  priceUnit?: 'Lt' | 'Kg'; 
}

export interface Task {
  id: string;
  name: string; 
  ownerId: string;
  ownerName?: string;
}

export interface PrescriptionItem {
  supplyId: string;
  supplyName: string;
  dose: string;
  unit: string;
  lockedPrice?: number; // Snapshot: Precio congelado al momento de crear la receta
}

// NUEVO: Datos de ejecución por lote dentro de una receta
export interface PrescriptionExecution {
  executed: boolean;
  executedAt?: string; // ISO Date
  executedBy?: string; // User Name
  observation?: string;
}

export interface Prescription {
  id: string;
  createdAt: number; // Timestamp numérico (igual que monitorings)
  companyId: string;
  fieldId: string; 
  plotIds: string[]; 
  plotNames: string[]; 
  items: PrescriptionItem[];
  taskIds: string[];
  taskNames: string[]; 
  notes: string;
  audioUrl?: string; 
  audioDuration?: number;
  hasAudio?: boolean; // Flag para indicar si tiene audio (como monitorings)
  status: 'active' | 'archived';
  ownerId: string;
  ownerName?: string;
  // Map of plotId -> Execution Details
  executionData?: Record<string, PrescriptionExecution>; 
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  items: PrescriptionItem[];
  taskIds: string[];
  notes?: string;
  ownerId: string;
}

export interface PlotAssignment {
  id: string;
  plotId: string;
  seasonId: string;
  cropId: string;
  budget?: number; // Nuevo: Presupuesto asignado al lote para esta campaña
  ownerId: string;
  ownerName?: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface WeatherData {
  temp: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  rainProb?: number; // Probability of precipitation
}

export interface MonitoringPestData {
  pestId: string;
  name: string;
  value: string | number;
  unit: string;
}

export interface MonitoringRecord {
  id: string;
  companyId: string;
  fieldId: string;
  plotId: string;
  seasonId: string;
  userId: string;
  userName?: string; 
  ownerId: string;
  ownerName?: string;
  sampleNumber: number;
  pestIds?: string[];
  pestId?: string;
  pestData?: MonitoringPestData[];
  date: string;
  location?: GeoLocation | null; 
  weather?: WeatherData; // NUEVO: Datos climáticos al momento del monitoreo
  phenology?: string; // NUEVO: Estadio fenológico (ej: V4, R1)
  observations: string;
  severity?: 'baja' | 'media' | 'alta';
  media?: {
    photoUrl?: string | null; 
    hasAudio?: boolean;
    audioUrl?: string | null;
    audioDuration?: number;
  };
}

export interface LotSummary {
  id: string;
  companyId: string;
  fieldId: string;
  plotId: string;
  seasonId: string;
  userId: string;
  userName?: string; 
  ownerId: string;
  ownerName?: string;
  date: string;
  status: 'verde' | 'amarillo' | 'rojo';
  notes?: string;
  audioUrl?: string;
  audioDuration?: number;
  isReviewed?: boolean;
  engineerStatus?: 'verde' | 'amarillo' | 'rojo';
  engineerNotes?: string;
  engineerAudioUrl?: string;
  engineerAudioDuration?: number;
}
