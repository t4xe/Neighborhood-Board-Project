import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from './db';
import { authRouter } from './routes/auth';
import { categoriesRouter } from './routes/categories';
import { postsRouter } from './routes/posts';
import { usersRouter } from './routes/users';

const PORT = process.env.PORT || 3000;
const app = express();

async function start() {
  await initDb();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/authentication', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/posts', postsRouter);
app.use('/api/users', usersRouter);

// Serve minimal static frontend (full Angular app is teammate's task)
// __dirname is server/dist (or server/src when using ts-node-dev); public/ is at project root
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));
app.use('/docs', express.static(path.join(__dirname, '../../docs')));
app.get('*', (_, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
