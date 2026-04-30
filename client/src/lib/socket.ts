import { io } from 'socket.io-client'

const socket = io('/', { autoConnect: false })

export function connectSocket() {
  if (!socket.connected) socket.connect()
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect()
}

export function joinExecution(executionId: string) {
  socket.emit('join-execution', executionId)
}

export function leaveExecution(executionId: string) {
  socket.emit('leave-execution', executionId)
}

export { socket }
