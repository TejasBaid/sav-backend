import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/dashboard/summary', authenticateToken, (req: Request, res: Response) => {
  try {
    const { grade, subject } = req.query;
    
    let baseWhereParts = [];
    if (grade && grade !== 'ALL') baseWhereParts.push(`class = '${grade}'`);
    if (subject && subject !== 'ALL') baseWhereParts.push(`subject = '${subject}'`);
    let baseWhere = baseWhereParts.length > 0 ? `WHERE ${baseWhereParts.join(' AND ')}` : '';
    
    let typedWhere = (type: string) => {
      let parts = [`activity_type = '${type}'`];
      if (grade && grade !== 'ALL') parts.push(`class = '${grade}'`);
      if (subject && subject !== 'ALL') parts.push(`subject = '${subject}'`);
      return `WHERE ${parts.join(' AND ')}`;
    };

    const totalTeachers = db.prepare(`SELECT COUNT(DISTINCT teacher_id) as count FROM activities ${baseWhere}`).get() as { count: number };
    const totalLessons = db.prepare(`SELECT COUNT(*) as count FROM activities ${typedWhere('lesson')}`).get() as { count: number };
    const totalQuizzes = db.prepare(`SELECT COUNT(*) as count FROM activities ${typedWhere('quiz')}`).get() as { count: number };
    const totalAssessments = db.prepare(`SELECT COUNT(*) as count FROM activities ${typedWhere('assessment')}`).get() as { count: number };

    res.json({
      activeTeachers: totalTeachers.count,
      lessonsCreated: totalLessons.count,
      assessmentsMade: totalAssessments.count,
      quizzesConducted: totalQuizzes.count,
      submissionRate: 85
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary.' });
  }
});

router.get('/teachers', authenticateToken, (req: Request, res: Response) => {
  try {
    const { grade, subject } = req.query;
    
    let baseWhereParts = [];
    if (grade && grade !== 'ALL') baseWhereParts.push(`class = '${grade}'`);
    if (subject && subject !== 'ALL') baseWhereParts.push(`subject = '${subject}'`);
    let baseWhere = baseWhereParts.length > 0 ? `WHERE ${baseWhereParts.join(' AND ')}` : '';

    const teachers = db.prepare(`
      SELECT 
        teacher_id, 
        teacher_name,
        SUM(CASE WHEN activity_type = 'lesson' THEN 1 ELSE 0 END) as total_lessons,
        SUM(CASE WHEN activity_type = 'quiz' THEN 1 ELSE 0 END) as total_quizzes,
        SUM(CASE WHEN activity_type = 'assessment' THEN 1 ELSE 0 END) as total_assessments,
        GROUP_CONCAT(DISTINCT class) as total_classes,
        GROUP_CONCAT(DISTINCT subject) as total_subjects
      FROM activities
      ${baseWhere}
      GROUP BY teacher_id, teacher_name
    `).all();

    res.json(teachers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch teachers.' });
  }
});

router.get('/teachers/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stats = db.prepare(`
      SELECT 
        teacher_id, 
        teacher_name,
        SUM(CASE WHEN activity_type = 'lesson' THEN 1 ELSE 0 END) as total_lessons,
        SUM(CASE WHEN activity_type = 'quiz' THEN 1 ELSE 0 END) as total_quizzes,
        SUM(CASE WHEN activity_type = 'assessment' THEN 1 ELSE 0 END) as total_assessments,
        GROUP_CONCAT(DISTINCT subject) as subjects,
        GROUP_CONCAT(DISTINCT class) as classes
      FROM activities
      WHERE teacher_id = ?
      GROUP BY teacher_id, teacher_name
    `).get(id);

    if (!stats) {
      return res.status(404).json({ error: 'Teacher not found.' });
    }

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch teacher details.' });
  }
});

router.get('/trends', authenticateToken, (req: Request, res: Response) => {
  try {
    const { teacher_id, grade, subject } = req.query;

    let query = `
      SELECT 
        strftime('%Y-%W', created_at) as week,
        MIN(date(created_at)) as week_start_date,
        SUM(CASE WHEN activity_type = 'lesson' THEN 1 ELSE 0 END) as lessons,
        SUM(CASE WHEN activity_type = 'quiz' THEN 1 ELSE 0 END) as quizzes,
        SUM(CASE WHEN activity_type = 'assessment' THEN 1 ELSE 0 END) as assessments
      FROM activities
      WHERE 1=1
    `;
    
    const params = [];

    if (teacher_id) {
      query += ` AND teacher_id = ?`;
      params.push(teacher_id);
    }
    
    if (grade && grade !== 'ALL') {
      query += ` AND class = ?`;
      params.push(grade);
    }
    
    if (subject && subject !== 'ALL') {
      query += ` AND subject = ?`;
      params.push(subject);
    }

    query += ` GROUP BY strftime('%Y-%W', created_at) ORDER BY week_start_date ASC`;

    const trends = db.prepare(query).all(...params);
    res.json(trends);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch trends.' });
  }
});

export default router;
