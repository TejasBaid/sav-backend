import express from 'express';
import cors from 'cors';
import { initializeDB, seedDatabase } from './db';
import authRoutes from './routes/auth';
import analyticsRoutes from './routes/analytics';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initializeDB();
seedDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);
app.use('/api', analyticsRoutes);

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
