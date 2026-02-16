import http from 'http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { initDb } from './db';
import { setLiveIo } from './live';
import { authRouter } from './routes/auth';
import { categoriesRouter } from './routes/categories';
import { postsRouter } from './routes/posts';
import { usersRouter } from './routes/users';
import { reportsRouter } from './routes/reports';
import { authMiddleware } from './auth';

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: true } });
setLiveIo(io);

async function start() {
  await initDb();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(authMiddleware);

  app.use('/api/authentication', authRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/reports', reportsRouter);

  const publicPath = path.join(__dirname, '../../public');
  app.use(express.static(publicPath));
  app.use('/docs', express.static(path.join(__dirname, '../../docs')));
  app.get('*', (_, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
