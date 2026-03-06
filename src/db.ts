import Database from 'better-sqlite3';
import path from 'path';
import * as xlsx from 'xlsx';
import fs from 'fs';
import bcrypt from 'bcrypt';

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

db.pragma('foreign_keys = ON');

export const initializeDB = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      subject TEXT NOT NULL,
      class TEXT NOT NULL,
      UNIQUE(teacher_id, activity_type, created_at, subject, class)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'faculty'
    );
  `);

  console.log('Database initialized.');
};

export const seedDatabase = () => {
  const filePath = path.resolve(__dirname, '../../../savra_dummy_dataset.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: Dataset not found at ${filePath}. Skipping seed.`);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

  console.log(`Parsed ${data.length} rows from Excel.`);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO activities (teacher_id, teacher_name, activity_type, created_at, subject, class)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  
  const insertMany = db.transaction((records: any[]) => {
    for (const record of records) {
      if (!record.teacher_id || !record.activity_type) continue;
      
      const safeClass = record.class ? String(record.class).trim() : 'Unassigned';
      const safeSubject = record.subject ? String(record.subject).trim() : 'General';

      const result = insert.run(
        String(record.teacher_id),
        String(record.teacher_name || 'Unknown'),
        String(record.activity_type).toLowerCase(),
        String(record.created_at),
        safeSubject,
        safeClass
      );
      if (result.changes > 0) insertedCount++;
    }
  });

  insertMany(data);
  console.log(`Seeded ${insertedCount} unique records into the database. (Ignored ${data.length - insertedCount} duplicates)`);

  const superuserCheck = db.prepare('SELECT * FROM users WHERE username = ?').get('superuser');
  if (!superuserCheck) {
    const hashedPassword = bcrypt.hashSync('superuser', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('superuser', hashedPassword, 'superuser');
    console.log('Default superuser created. (Username: superuser, Password: superuser)');
  }

  const facultyCheck = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!facultyCheck) {
    const hashedPassword = bcrypt.hashSync('savra2026', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'faculty');
  }
};

export default db;
