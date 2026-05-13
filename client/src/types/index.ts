export type Role = 'ADMIN' | 'OPERATOR'
export type BatchStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
export type MachineStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  createdAt?: string
}

// ---- DATOS MAESTROS ----

export interface PlantLayout {
  id: string
  name: string
  imageBase64?: string
  machines?: Machine[]
  createdAt: string
  updatedAt: string
}

export interface Machine {
  id: string
  name: string
  code: string
  description?: string
  machineType?: string
  status: MachineStatus
  hourlyOperatingCost: number
  capacity?: number
  capacityUnit?: string
  locationX?: number
  locationY?: number
  plantLayoutId?: string
  plantLayout?: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

export interface RawMaterial {
  id: string
  name: string
  code: string
  unit: string
  unitCost: number
  stockQty: number
  description?: string
  createdAt: string
  updatedAt: string
}

// ---- CATÁLOGO DE PROCESOS ----

export interface ChecklistItem {
  id: string
  label: string
  required: boolean
  order: number
}

export interface Operation {
  id: string
  name: string
  code: string
  description?: string
  defaultDurationMin: number
  checklistItems: ChecklistItem[]
  createdAt: string
  updatedAt: string
}

// ---- FLUJOS DE PRODUCCIÓN ----

export interface RoutingStep {
  id: string
  order: number
  operationId: string
  operation: Operation
  targetDurationMin: number
  preferredMachineId?: string
  preferredMachine?: { id: string; name: string; code: string }
  notes?: string
}

export interface Routing {
  id: string
  name: string
  version: string
  description?: string
  steps: RoutingStep[]
  createdAt: string
  updatedAt: string
}

// ---- RECETAS (BOM) ----

export interface RecipeBOMItem {
  id: string
  rawMaterialId: string
  rawMaterial: RawMaterial
  quantity: number
  unit?: string
  isOptional: boolean
  notes?: string
}

export interface Recipe {
  id: string
  name: string
  version: string
  description?: string
  routingId: string
  routing: Routing
  bom: RecipeBOMItem[]
  yieldQty: number
  yieldUnit: string
  salePrice: number
  taxRate: number
  createdAt: string
  updatedAt: string
}

export interface RecipeCost {
  materialCost: number
  machineCost: number
  totalCost: number
  salePrice: number
  priceExTax: number
  taxRate: number
  taxAmount: number
  margin: number
  yieldQty: number
  yieldUnit: string
}

// ---- LOTES ----

export interface Batch {
  id: string
  name: string
  recipeId: string
  recipe: { id: string; name: string; yieldUnit?: string; routing?: { id: string; name: string } }
  status: BatchStatus
  priority: Priority
  plannedQty?: number
  actualQty?: number
  unit?: string
  supervisorName?: string
  notes?: string
  plannedStartAt?: string
  plannedEndAt?: string
  createdBy?: string
  executions?: { id: string; status: string; startedAt: string; completedAt?: string }[]
  createdAt: string
  updatedAt: string
}

// ---- EJECUCIONES ----

export interface ChecklistCompletion {
  id: string
  checklistItemId: string
  checklistItem: ChecklistItem
  completed: boolean
  completedAt?: string
}

export interface MaterialConsumption {
  id: string
  rawMaterialId: string
  rawMaterial: RawMaterial
  plannedQty?: number
  actualQty: number
  unit?: string
  waste?: number
  notes?: string
}

export interface ProcessExecution {
  id: string
  routingStepId: string
  routingStep: RoutingStep
  machineId?: string
  machine?: { id: string; name: string; code: string }
  operatorId?: string
  operator?: { id: string; name: string }
  status: StepStatus
  startedAt?: string
  completedAt?: string
  manHours?: number
  machineHours?: number
  waste?: number
  wasteUnit?: string
  observations?: string
  checklistCompletions: ChecklistCompletion[]
  consumptions: MaterialConsumption[]
}

export interface BatchExecution {
  id: string
  batchId: string
  batch: {
    id: string
    name: string
    recipe: { id: string; name: string; bom?: RecipeBOMItem[] }
  }
  userId: string
  user: { id: string; name: string }
  status: BatchStatus
  startedAt: string
  completedAt?: string
  processExecutions: ProcessExecution[]
}

// ---- DASHBOARD ----

export interface DashboardMetrics {
  totalBatches: number
  pendingBatches: number
  inProgressBatches: number
  completedBatches: number
  avgEfficiency: string
  totalMaterialCost: number
  opStats: {
    stepId: string
    stepName: string
    routingName: string
    avgManHours: string
    targetMin: number
    count: number
  }[]
  recentExecutions: {
    id: string
    status: string
    startedAt: string
    completedAt?: string
    batch: { name: string; recipe: { name: string } }
    user: { name: string }
  }[]
  efficiencyChart: {
    batchId: string
    actualMinutes: string
    targetMinutes: number
    efficiency: string
  }[]
}
