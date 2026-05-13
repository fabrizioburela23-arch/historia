export type Role = 'ADMIN' | 'OPERATOR'
export type BatchStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
export type MachineStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE'
export type ProcessType = 'PREPARATION' | 'MIXING' | 'COOKING' | 'COOLING' | 'PACKAGING' | 'QC' | 'TRANSPORT' | 'OTHER'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  createdAt?: string
}

export interface PlantLayout {
  id: string
  name: string
  imageUrl?: string
  machines?: Machine[]
  createdAt: string
}

export interface Machine {
  id: string
  name: string
  description?: string
  code: string
  status: MachineStatus
  machineType?: string
  capacity?: number
  capacityUnit?: string
  locationX?: number
  locationY?: number
  plantLayoutId?: string
  plantLayout?: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

export interface Material {
  id: string
  name: string
  code: string
  unit: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface RecipeStepMaterial {
  id: string
  materialId: string
  material: Material
  quantity: number
  unit?: string
}

export interface ChecklistItem {
  id: string
  label: string
  required: boolean
  order: number
}

export interface RecipeStep {
  id: string
  order: number
  name: string
  description?: string
  processType: ProcessType
  machineRequired: boolean
  targetTimeMinutes: number
  checklistItems: ChecklistItem[]
  materials: RecipeStepMaterial[]
}

export interface Recipe {
  id: string
  name: string
  description?: string
  targetTimeMinutes: number
  version: string
  steps: RecipeStep[]
  createdAt: string
  updatedAt: string
}

export interface Batch {
  id: string
  name: string
  recipeId: string
  recipe: { id: string; name: string; targetTimeMinutes?: number }
  machineId: string
  machine: { id: string; name: string; code: string; status?: string }
  status: BatchStatus
  priority: Priority
  notes?: string
  plannedQty?: number
  actualQty?: number
  unit?: string
  supervisorName?: string
  plannedStartAt?: string
  plannedEndAt?: string
  createdBy?: string
  executions?: { id: string; status: string; startedAt: string; completedAt?: string }[]
  createdAt: string
  updatedAt: string
}

export interface ChecklistCompletion {
  id: string
  checklistItemId: string
  checklistItem: ChecklistItem
  completed: boolean
  completedAt?: string
}

export interface StepExecution {
  id: string
  recipeStepId: string
  recipeStep: RecipeStep
  status: StepStatus
  startedAt?: string
  completedAt?: string
  actualTimeSeconds?: number
  waste?: number
  observations?: string
  checklistCompletions: ChecklistCompletion[]
}

export interface BatchExecution {
  id: string
  batchId: string
  batch: {
    id: string
    name: string
    recipe: { id: string; name: string }
    machine: { id: string; name: string; code: string }
  }
  userId: string
  user: { id: string; name: string }
  status: BatchStatus
  startedAt: string
  completedAt?: string
  stepExecutions: StepExecution[]
}

export interface DashboardMetrics {
  totalBatches: number
  pendingBatches: number
  inProgressBatches: number
  completedBatches: number
  avgEfficiency: string
  stepStats: {
    stepId: string
    stepName: string
    recipeName: string
    avgActualMinutes: string
    targetMinutes: number
    count: number
  }[]
  recentExecutions: {
    id: string
    status: string
    startedAt: string
    completedAt?: string
    batch: { name: string; recipe: { name: string }; machine: { name: string } }
    user: { name: string }
  }[]
  efficiencyChart: {
    batchId: string
    actualMinutes: string
    targetMinutes: number
    efficiency: string
  }[]
}
