import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import 'dotenv/config'

import authRoutes from './routes/auth'
import machineRoutes from './routes/machines'
import productRoutes from './routes/products'
import processFlowRoutes from './routes/processFlows'
import recipeRoutes from './routes/recipes'
import batchRoutes from './routes/batches'
import userRoutes from './routes/users'
import dashboardRoutes from './routes/dashboard'
import layoutRoutes from './routes/layouts'

const app = express()
const httpServer = createServer(app)

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173']

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
})

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/machines', machineRoutes)
app.use('/api/products', productRoutes)
app.use('/api/flows', processFlowRoutes)
app.use('/api/recipes', recipeRoutes)
app.use('/api/batches', batchRoutes)
app.use('/api/users', userRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/layouts', layoutRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

io.on('connection', socket => {
  socket.on('join-batch', (batchId: string) => socket.join(`batch-${batchId}`))
  socket.on('leave-batch', (batchId: string) => socket.leave(`batch-${batchId}`))
  socket.on('batch-update', (data: { batchId: string; [key: string]: unknown }) => {
    socket.to(`batch-${data.batchId}`).emit('batch-updated', data)
  })
})

export { io }

const PORT = Number(process.env.PORT) || 3001

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏭 MES Server running on port ${PORT}\n`)
})
