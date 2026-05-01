import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import analyzeRouter  from './routes/analyze';
import authRouter     from './routes/auth';
import reposRouter    from './routes/repos';
import scansRouter    from './routes/scans';
import webhooksRouter from './routes/webhooks';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin:      process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  }));
  app.use(cookieParser());

  // Webhooks route must use raw body — mount before express.json()
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json({ limit: '5mb' }));

  app.use('/api/analyze', analyzeRouter);
  app.use('/api/auth',    authRouter);
  app.use('/api/repos',   reposRouter);
  app.use('/api/scans',   scansRouter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  return app;
}
