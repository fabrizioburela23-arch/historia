# MES Pro — Sistema de Ejecución de Manufactura

Aplicación industrial para registro de tiempos, gestión de flujos y análisis de eficiencia en planta.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Estado | Zustand + React Router v6 |
| Gráficas | Recharts |
| Backend | Node.js + Express + TypeScript |
| Base de datos | SQLite via Prisma ORM |
| Real-time | Socket.io |
| Auth | JWT (24h) + bcrypt |

## Inicio Rápido

```bash
# 1. Instalar dependencias
npm run setup

# 2. Levantar dev (backend :3001 + frontend :5173)
npm run dev
```

Usuarios por defecto:
- **Admin**: `admin@mes.com` / `admin123`
- **Operario**: `operario@mes.com` / `op123`

## Arquitectura

```
mes-app/
├── client/          # React SPA
│   └── src/
│       ├── pages/
│       │   ├── admin/       # Dashboard, Máquinas, Recetas, Lotes, Layout
│       │   └── operator/    # Vista operario + Ejecución con cronómetro
│       ├── components/      # Layout, Timer, Modal, StatusBadge
│       ├── store/           # Zustand auth store
│       ├── lib/             # Axios client, Socket.io
│       └── types/           # TypeScript interfaces
└── server/          # Express API
    ├── prisma/
    │   └── schema.prisma    # Modelos: User, Machine, Recipe, Batch, Execution
    └── src/
        ├── routes/          # auth, machines, recipes, batches, executions, dashboard, layouts
        └── middleware/      # JWT auth + role guard
```

## Modelo de Estados (Máquina de Estados)

```
Batch:    PENDING → IN_PROGRESS → [PAUSED ↔ IN_PROGRESS] → COMPLETED
                                                          ↘ CANCELLED

StepExecution: PENDING → IN_PROGRESS → COMPLETED
               (desbloqueo secuencial: sólo si paso anterior = COMPLETED)
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/batches` | Listar lotes |
| POST | `/api/batches/:id/start` | Iniciar ejecución |
| PUT | `/api/executions/:id/steps/:sid/start` | Iniciar paso (con validación secuencial) |
| PUT | `/api/executions/:id/steps/:sid/complete` | Completar paso con timestamp, merma y checklist |
| GET | `/api/dashboard/metrics` | KPIs, OEE, bottlenecks |
