import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import 'dotenv/config'

import authRoutes from './routes/auth'
import machineRoutes from './routes/machines'
import recipeRoutes from './routes/recipes'
import batchRoutes from './routes/batches'
import executionRoutes from './routes/executions'
import dashboardRoutes from './routes/dashboard'
import layoutRoutes from './routes/layouts'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/machines', machineRoutes)
app.use('/api/recipes', recipeRoutes)
app.use('/api/batches', batchRoutes)
app.use('/api/executions', executionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/layouts', layoutRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

io.on('connection', socket => {
  socket.on('join-execution', (executionId: string) => {
    socket.join(`execution-${executionId}`)
  })
  socket.on('leave-execution', (executionId: string) => {
    socket.leave(`execution-${executionId}`)
  })
  socket.on('step-update', (data: { executionId: string; [key: string]: unknown }) => {
    socket.to(`execution-${data.executionId}`).emit('step-updated', data)
  })
})

export { io }

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`\n🏭 MES Server running on http://localhost:${PORT}\n`)
})
