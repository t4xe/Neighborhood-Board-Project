import type { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setLiveIo(socketServer: SocketIOServer): void {
  io = socketServer;
}

export function broadcast(event: string, payload?: unknown): void {
  if (io) io.emit(event, payload ?? {});
}
