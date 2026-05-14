export type Role = 'ADMIN' | 'OPERATOR'
export type ProductType = 'RAW' | 'INTERMEDIATE' | 'FINAL'
export type BatchMode = 'SINGLE_FLOW' | 'RECIPE'
export type ExecMode = 'PARALLEL' | 'SEQUENTIAL'
export type BatchStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
export type MachineStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  passwordPlain?: string
  createdAt?: string
  updatedAt?: string
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

export interface Product {
  id: string
  name: string
  code: string
  type: ProductType
  unit: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface FlowChecklistItem {
  id: string
  label: string
  required: boolean
  order: number
}

export interface ProcessStep {
  id: string
  flowId: string
  order: number
  name: string
  description?: string
  targetTimeMinutes: number
  checklistItems: FlowChecklistItem[]
}

export interface ProcessFlow {
  id: string
  name: string
  description?: string
  machineId?: string
  machine?: { id: string; name: string; code: string }
  inputProductId: string
  inputProduct: Product
  inputQty: number
  inputUnit: string
  outputProductId: string
  outputProduct: Product
  expectedOutputQty: number
  outputUnit: string
  targetTimeMinutes: number
  steps: ProcessStep[]
  historicalYield?: number | null
  historicalRuns?: number
  createdAt: string
  updatedAt: string
}

export interface RecipeFlow {
  id: string
  recipeId: string
  flowId: string
  flow: ProcessFlow
  order: number
}

export interface RecipeMaterial {
  id: string
  recipeId: string
  productId: string
  product: Product
  quantity: number
  unit: string
}

export interface Recipe {
  id: string
  name: string
  description?: string
  version: string
  flows: RecipeFlow[]
  materials: RecipeMaterial[]
  createdAt: string
  updatedAt: string
}

export interface BatchStepCheck {
  id: string
  batchStepId: string
  checklistItemId: string
  completed: boolean
  completedAt?: string
}

export interface BatchStep {
  id: string
  batchFlowId: string
  stepId: string
  order: number
  status: StepStatus
  startedAt?: string
  completedAt?: string
  actualTimeSeconds?: number
  observations?: string
  step: ProcessStep
  checks: BatchStepCheck[]
}

export interface BatchFlow {
  id: string
  batchId: string
  flowId: string
  flow: { id: string; name: string; targetTimeMinutes?: number }
  order: number
  inputProductId: string
  inputProduct: Product
  inputQtyPlanned: number
  inputQtyActual?: number
  inputUnit: string
  outputProductId: string
  outputProduct: Product
  outputQtyExpected: number
  outputQtyActual?: number
  outputUnit: string
  machineId?: string
  machine?: { id: string; name: string; code: string }
  operatorId?: string
  operator?: { id: string; name: string }
  status: BatchStatus
  startedAt?: string
  completedAt?: string
  plannedTimeMin: number
  downtimeMin: number
  steps: BatchStep[]
}

export interface Batch {
  id: string
  name: string
  mode: BatchMode
  executionMode: ExecMode
  status: BatchStatus
  priority: Priority
  notes?: string
  recipeId?: string
  recipe?: { id: string; name: string }
  supervisorName?: string
  createdById?: string
  createdBy?: { id: string; name: string }
  plannedStartAt?: string
  plannedEndAt?: string
  startedAt?: string
  completedAt?: string
  flows: BatchFlow[]
  createdAt: string
  updatedAt: string
}

export interface DashboardMetrics {
  counts: {
    totalBatches: number
    pendingBatches: number
    inProgressBatches: number
    completedBatches: number
  }
  oee: number | null
  availability: number | null
  performance: number | null
  quality: number | null
  flowYields: { flowId: string; flowName: string; runs: number; avgYield: string | null }[]
  recentBatches: { id: string; name: string; status: string; mode: string; createdAt: string; recipeName?: string }[]
  yieldChart: { name: string; yield: number }[]
}
