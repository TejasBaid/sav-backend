import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken } from '../middleware/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

router.get('/insights', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { grade, subject } = req.query;

    let whereParts: string[] = [];
    if (grade && grade !== 'ALL') whereParts.push(`class = '${grade}'`);
    if (subject && subject !== 'ALL') whereParts.push(`subject = '${subject}'`);
    const baseWhere = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalTeachers = (db.prepare(`SELECT COUNT(DISTINCT teacher_id) as count FROM activities ${baseWhere}`).get() as { count: number }).count;
    const totalLessons = (db.prepare(`SELECT COUNT(*) as count FROM activities WHERE activity_type = 'lesson'${whereParts.length ? ' AND ' + whereParts.join(' AND ') : ''}`).get() as { count: number }).count;
    const totalQuizzes = (db.prepare(`SELECT COUNT(*) as count FROM activities WHERE activity_type = 'quiz'${whereParts.length ? ' AND ' + whereParts.join(' AND ') : ''}`).get() as { count: number }).count;
    const totalAssessments = (db.prepare(`SELECT COUNT(*) as count FROM activities WHERE activity_type = 'assessment'${whereParts.length ? ' AND ' + whereParts.join(' AND ') : ''}`).get() as { count: number }).count;

    const topTeacher = db.prepare(`
      SELECT teacher_name, COUNT(*) as total
      FROM activities
      ${baseWhere}
      GROUP BY teacher_id
      ORDER BY total DESC
      LIMIT 1
    `).get() as { teacher_name: string; total: number } | undefined;

    const recentWeek = db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE created_at >= date('now', '-7 days')
      ${whereParts.length ? 'AND ' + whereParts.join(' AND ') : ''}
    `).get() as { count: number };

    const filterContext = [
      grade && grade !== 'ALL' ? `Grade ${grade}` : null,
      subject && subject !== 'ALL' ? `${subject}` : null,
    ].filter(Boolean).join(', ') || 'the entire school';

    const prompt = `You are an educational analytics assistant for Savra, a school management platform.
Here is the latest activity data for ${filterContext}:
- Active teachers: ${totalTeachers}
- Lessons created: ${totalLessons}
- Quizzes conducted: ${totalQuizzes}
- Assessments made: ${totalAssessments}
- Activities in the last 7 days: ${recentWeek.count}
${topTeacher ? `- Most active teacher: ${topTeacher.teacher_name} (${topTeacher.total} activities)` : ''}

Write a concise, friendly 2-3 sentence insight summary for a school administrator. Highlight any notable patterns, recognize the top performer if present, and suggest one actionable recommendation. Keep it professional but warm. Do NOT use markdown, bullet points, or headers — plain prose only.`;

    const apiKey = process.env.GEMINI_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const insight = result.response.text().trim();

    res.json({ insight });
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ error: 'Failed to generate AI insights.' });
  }
});

export default router;
