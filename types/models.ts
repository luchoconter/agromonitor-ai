
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
  lat?: number;
  lng?: number;
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
  pricePerHectare?: number;
  category?: 'Pulverización Terrestre' | 'Pulverización Selectiva' | 'Pulverización Aérea' | 'Siembra' | 'Otras Labores';
}

export interface PrescriptionItem {
  supplyId: string;
  supplyName: string;
  dose: string;
  unit: string;
  lockedPrice?: number; // Snapshot: Precio congelado al momento de crear la receta
}

// NUEVO: Item de ejecución con costo real snapshot
export interface ExecutionItem {
  supplyId: string;
  supplyName: string;
  dose: number;
  unit: string;
  cost: number; // Costo por unidad al momento de la ejecución
}

// NUEVO: Datos de ejecución por lote dentro de una receta
export interface PrescriptionExecution {
  executed: boolean;
  executedAt?: string; // ISO Date
  executedBy?: string; // User Name
  observation?: string;
  audioUrl?: string; // Feedback del cliente (audio)
  audioDuration?: number;

  // Datos reales de aplicación
  actualHectares?: number;
  actualItems?: ExecutionItem[];
  actualTasks?: string[];
  actualTaskCosts?: Record<string, number>; // Map taskId -> pricePerHa snapshot
}

// NUEVO: Presupuesto por Campaña y Cultivo
export interface Budget {
  id: string;
  companyId: string;
  seasonId: string;
  cropId: string;

  // Agroquímicos (USD/ha)
  herbicidas: number;
  insecticidas: number;
  fungicidas: number;
  fertilizantes: number;
  coadyuvantes: number;
  otrosAgroquimicos: number; // Mapea a 'Otro'/'Otro Agroquimico'
  semillas: number;

  // Labores (USD/ha)
  pulverizacionTerrestre: number;
  pulverizacionSelectiva: number;
  pulverizacionAerea: number;
  siembra: number;
  otrasLabores: number;

  createdAt: number;
  updatedAt: number;

  // NUEVO: Saldos Iniciales / Consumo Histórico (USD/ha)
  // Permite cargar lo gastado antes de implementar el sistema
  legacySpent?: {
    herbicidas: number;
    insecticidas: number;
    fungicidas: number;
    fertilizantes: number;
    coadyuvantes: number;
    otrosAgroquimicos: number;
    semillas: number;
    pulverizacionTerrestre: number;
    pulverizacionSelectiva: number;
    pulverizacionAerea: number;
    siembra: number;
    otrasLabores: number;
  };
}

export interface Prescription {
  id: string;
  createdAt: number; // Timestamp numérico (igual que monitorings)
  companyId: string;
  fieldId: string;
  plotIds: string[];
  plotNames: string[];
  // Custom metadata for specific plots in this recipe
  plotMetadata?: Record<string, {
    affectedHectares?: number;
    observation?: string;
  }>;
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
  originalStand?: number; // Nuevo: Stand de plantas original/objetivo (pl/ha)
  ownerId: string;
  ownerName?: string;
  history?: {
    date: string; // ISO String
    cropId: string;
    originalStand?: number;
    userId: string;
    userName?: string;
    action: 'created' | 'updated';
  }[];
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
  standData?: {
    plantsPerMeter: number;
    distanceBetweenRows: number;
    plantsPerHectare: number;
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
  engineerStatusDate?: string; // Nuevo: fecha de actualización del estado por ingeniero
  engineerName?: string; // Nuevo: nombre del ingeniero que actualizó
}
