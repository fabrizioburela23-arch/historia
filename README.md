# MES Pro — Sistema de Ejecución de Manufactura

Aplicación industrial para digitalización del piso de producción: registro de tiempos, gestión de flujos, checklists y análisis de eficiencia (OEE).

---

## Estructura del repositorio

```
mes-app/
├── client/          ← Frontend React (Vercel / Netlify)
└── server/          ← Backend Express API (Railway / Render)
```

Cada carpeta es un proyecto independiente con su propio `package.json`.  
Se despliegan por separado en plataformas distintas.

---

## Variables de entorno

### Backend — `server/.env`
```env
DATABASE_URL="file:./dev.db"          # SQLite (cambiar a PostgreSQL en prod si se prefiere)
JWT_SECRET="tu-secreto-seguro-aqui"   # Cambia esto en producción
PORT=3001
FRONTEND_URL=https://tu-app.vercel.app # URL del frontend deployado (para CORS)
```

### Frontend — `client/.env.production`
```env
VITE_API_URL=https://tu-api.railway.app  # URL del backend deployado (sin slash final)
```
> En desarrollo NO se necesita esta variable — el proxy de Vite la maneja automáticamente.

---

## Desarrollo local

```bash
# 1. Clonar el repo
git clone <url>
cd mes-app

# 2. Instalar todas las dependencias
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Configurar base de datos y datos de prueba
cd server
cp .env.example .env
npm run db:setup
cd ..

# 4. Levantar ambos servidores en paralelo
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Usuarios de prueba
| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@mes.com` | `admin123` | Administrador |
| `operario@mes.com` | `op123` | Operario |

---

## Deploy: Backend en Railway

Railway detecta automáticamente el proyecto Node.js.

1. Crear cuenta en [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub repo**
3. Seleccionar este repositorio
4. En **Settings → Root Directory** poner: `server`
5. En **Variables** agregar:
   ```
   DATABASE_URL=file:./prod.db
   JWT_SECRET=<secreto-largo-y-seguro>
   FRONTEND_URL=https://tu-app.vercel.app
   NODE_ENV=production
   ```
6. Railway ejecutará automáticamente `npm install` → `npm run build` → `npm start`
7. Copiar la URL generada (ej: `https://mes-api.up.railway.app`)

> **Nota**: Para producción seria se recomienda cambiar SQLite por **PostgreSQL** (Railway lo provee como add-on). Solo cambia `DATABASE_URL` y el provider en `prisma/schema.prisma`.

---

## Deploy: Frontend en Vercel

1. Crear cuenta en [vercel.com](https://vercel.com)
2. **Add New → Project → Import Git Repository**
3. Seleccionar este repositorio
4. En **Root Directory** poner: `client`
5. Configuración detectada automáticamente:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. En **Environment Variables** agregar:
   ```
   VITE_API_URL=https://mes-api.up.railway.app
   ```
   (la URL del backend que obtuviste en el paso anterior)
7. Click **Deploy**

---

## Deploy: Frontend en Netlify (alternativa)

1. **Add new site → Import from Git**
2. Seleccionar repositorio
3. En **Base directory**: `client`
4. **Build command**: `npm run build`
5. **Publish directory**: `client/dist`
6. En **Environment variables** agregar:
   ```
   VITE_API_URL=https://mes-api.up.railway.app
   ```
7. El archivo `client/public/_redirects` ya está incluido para manejar el routing SPA.

---

## Stack tecnológico

| Capa | Tecnología | Hosting recomendado |
|------|-----------|---------------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS | Vercel / Netlify |
| Estado | Zustand + React Router v6 | — |
| Gráficas | Recharts | — |
| Backend | Node.js + Express + TypeScript | Railway / Render |
| Base de datos | SQLite via Prisma ORM | — |
| Auth | JWT 24h + bcrypt | — |
| Real-time | Socket.io | — |

---

## Arquitectura de la base de datos

```
User ──────────────── BatchExecution
                           │
Machine ──── Batch ────────┤
                │          │
Recipe ─────────┘    StepExecution ── ChecklistCompletion
  │                        │
RecipeStep ─────────────────        ChecklistItem
  │
ChecklistItem
```

## Máquina de estados

```
Batch:    PENDING → IN_PROGRESS ⇄ PAUSED → COMPLETED
                                         ↘ CANCELLED

Paso:     PENDING → IN_PROGRESS → COMPLETED
          (desbloqueo secuencial: requiere paso anterior = COMPLETED)
```
