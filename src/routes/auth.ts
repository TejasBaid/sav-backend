import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../db';
import { JWT_SECRET, authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username: user.username, role: user.role });
});

router.get('/me', authenticateToken, (req: any, res: Response) => {
  res.json({ user: req.user });
});

router.post('/', authenticateToken, (req: any, res: Response) => {
  if (req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Forbidden: Superuser access required' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, 'faculty');
    res.json({ success: true, message: 'Faculty user created successfully' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;
