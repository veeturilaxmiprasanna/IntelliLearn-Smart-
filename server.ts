import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import session from "express-session";
import bcrypt from "bcryptjs";
import cors from "cors";

// Initialize Database
const db = new Database("intellilearn.db");

// Database Schema Creation
db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz (
    quiz_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    score INTEGER NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user(user_id)
  );

  CREATE TABLE IF NOT EXISTS preferences (
    pref_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES user(user_id)
  );

  CREATE TABLE IF NOT EXISTS progress (
    progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    progress INTEGER NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user(user_id)
  );

  CREATE TABLE IF NOT EXISTS schedule (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(user_id) REFERENCES user(user_id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    reminder_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    time TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES user(user_id)
  );

  CREATE TABLE IF NOT EXISTS learning_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    video_title TEXT NOT NULL,
    subject TEXT NOT NULL,
    watch_time INTEGER,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user(user_id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());
  app.use(
    session({
      secret: "intellilearn-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: true, 
        sameSite: 'none', 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
      }, // 1 day
    })
  );

  // Trust proxy is required for secure cookies behind a proxy (like in this environment)
  app.set('trust proxy', 1);

  // --- API Routes ---

  // Auth
  app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO user (name, email, password) VALUES (?, ?, ?)");
      const result = stmt.run(name, email, hashedPassword);
      res.json({ success: true, userId: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const stmt = db.prepare("SELECT * FROM user WHERE email = ?");
    const user: any = stmt.get(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      (req.session as any).userId = user.user_id;
      (req.session as any).userName = user.name;
      // Return the user ID as a "token" for the client to store in localStorage
      res.json({ 
        success: true, 
        token: user.user_id.toString(),
        user: { id: user.user_id, name: user.name, email: user.email } 
      });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });

  // Middleware to handle auth from session OR header (fallback for iframes)
  app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && ! (req.session as any).userId) {
      const userId = parseInt(authHeader.replace('Bearer ', ''));
      if (!isNaN(userId)) {
        (req.session as any).userId = userId;
      }
    }
    next();
  });

  app.get("/api/me", (req, res) => {
    if ((req.session as any).userId) {
      const stmt = db.prepare("SELECT user_id as id, name, email FROM user WHERE user_id = ?");
      const user = stmt.get((req.session as any).userId);
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }
  });

  app.patch("/api/me", (req, res) => {
    const userId = (req.session as any).userId;
    const { name } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const stmt = db.prepare("UPDATE user SET name = ? WHERE user_id = ?");
      stmt.run(name, userId);
      
      const userStmt = db.prepare("SELECT user_id as id, name, email FROM user WHERE user_id = ?");
      const user = userStmt.get(userId);
      res.json({ success: true, user });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Quizzes
  app.get("/api/quizzes", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("SELECT * FROM quiz WHERE user_id = ? ORDER BY date DESC");
    res.json(stmt.all(userId));
  });

  app.post("/api/quizzes", (req, res) => {
    const userId = (req.session as any).userId;
    const { subject, score } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("INSERT INTO quiz (user_id, subject, score) VALUES (?, ?, ?)");
    stmt.run(userId, subject, score);
    res.json({ success: true });
  });

  // Preferences
  app.get("/api/preferences", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("SELECT * FROM preferences WHERE user_id = ?");
    res.json(stmt.all(userId));
  });

  app.post("/api/preferences", (req, res) => {
    const userId = (req.session as any).userId;
    const { subject } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("INSERT INTO preferences (user_id, subject) VALUES (?, ?)");
    stmt.run(userId, subject);
    res.json({ success: true });
  });

  app.delete("/api/preferences/:id", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("DELETE FROM preferences WHERE pref_id = ? AND user_id = ?");
    stmt.run(req.params.id, userId);
    res.json({ success: true });
  });

  // Progress
  app.get("/api/progress", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("SELECT * FROM progress WHERE user_id = ? ORDER BY date DESC");
    res.json(stmt.all(userId));
  });

  app.post("/api/progress", (req, res) => {
    const userId = (req.session as any).userId;
    const { subject, progress } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("INSERT INTO progress (user_id, subject, progress) VALUES (?, ?, ?)");
    stmt.run(userId, subject, progress);
    res.json({ success: true });
  });

  // Schedule
  app.get("/api/schedule", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("SELECT * FROM schedule WHERE user_id = ? ORDER BY date, time");
    res.json(stmt.all(userId));
  });

  app.post("/api/schedule", (req, res) => {
    const userId = (req.session as any).userId;
    const { subject, topic, date, time } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("INSERT INTO schedule (user_id, subject, topic, date, time) VALUES (?, ?, ?, ?, ?)");
    stmt.run(userId, subject, topic, date, time);
    res.json({ success: true });
  });

  app.patch("/api/schedule/:id", (req, res) => {
    const userId = (req.session as any).userId;
    const { status } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("UPDATE schedule SET status = ? WHERE schedule_id = ? AND user_id = ?");
    stmt.run(status, req.params.id, userId);
    res.json({ success: true });
  });

  app.delete("/api/schedule/:id", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("DELETE FROM schedule WHERE schedule_id = ? AND user_id = ?");
    stmt.run(req.params.id, userId);
    res.json({ success: true });
  });

  // Reminders
  app.get("/api/reminders", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("SELECT * FROM reminders WHERE user_id = ? AND is_read = 0 ORDER BY time");
    res.json(stmt.all(userId));
  });

  app.post("/api/reminders", (req, res) => {
    const userId = (req.session as any).userId;
    const { message, time } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("INSERT INTO reminders (user_id, message, time) VALUES (?, ?, ?)");
    stmt.run(userId, message, time);
    res.json({ success: true });
  });

  app.patch("/api/reminders/:id", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("UPDATE reminders SET is_read = 1 WHERE reminder_id = ? AND user_id = ?");
    stmt.run(req.params.id, userId);
    res.json({ success: true });
  });

  // Learning History
  app.get("/api/history", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("SELECT * FROM learning_history WHERE user_id = ? ORDER BY date DESC");
    res.json(stmt.all(userId));
  });

  app.post("/api/history", (req, res) => {
    const userId = (req.session as any).userId;
    const { video_title, subject, watch_time } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stmt = db.prepare("INSERT INTO learning_history (user_id, video_title, subject, watch_time) VALUES (?, ?, ?, ?)");
    stmt.run(userId, video_title, subject, watch_time);
    res.json({ success: true });
  });

  // Recommendations Logic (Simple rule-based)
  app.get("/api/recommendations", (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    // 1. Get user preferences
    const prefStmt = db.prepare("SELECT subject FROM preferences WHERE user_id = ?");
    const prefs = prefStmt.all(userId) as any[];
    
    // 2. Get low score quizzes
    const quizStmt = db.prepare("SELECT subject FROM quiz WHERE user_id = ? AND score < 60");
    const lowScores = quizStmt.all(userId) as any[];

    const recommendedSubjects = Array.from(new Set([
      ...prefs.map(p => p.subject),
      ...lowScores.map(q => q.subject)
    ]));

    // Static mapping for YouTube recommendations
    const videoMap: Record<string, any[]> = {
      "Mathematics": [
        { title: "Calculus for Beginners", url: "https://www.youtube.com/embed/WilsVpC06p8" },
        { title: "Linear Algebra Essentials", url: "https://www.youtube.com/embed/fNk_zzaMoSs" }
      ],
      "Physics": [
        { title: "Quantum Physics Explained", url: "https://www.youtube.com/embed/Usu9xZfabPM" },
        { title: "Classical Mechanics", url: "https://www.youtube.com/embed/pW-mR9p_N7E" }
      ],
      "Computer Science": [
        { title: "Data Structures & Algorithms", url: "https://www.youtube.com/embed/8hly31xKli0" },
        { title: "Python Full Course", url: "https://www.youtube.com/embed/_uQrJ0TkZlc" }
      ],
      "Chemistry": [
        { title: "Organic Chemistry Basics", url: "https://www.youtube.com/embed/m7vV9V06r8E" },
        { title: "Periodic Table Explained", url: "https://www.youtube.com/embed/0RRVV4Diomg" }
      ]
    };

    const recommendations = recommendedSubjects.map(subject => ({
      subject,
      videos: videoMap[subject] || [
        { title: `Introduction to ${subject}`, url: "https://www.youtube.com/embed/dQw4w9WgXcQ" }
      ]
    }));

    res.json(recommendations);
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Sample Data Initialization
  const userCount = db.prepare("SELECT COUNT(*) as count FROM user").get() as any;
  if (userCount.count === 0) {
    const hashedPassword = await bcrypt.hash("student123", 10);
    const userId = db.prepare("INSERT INTO user (name, email, password) VALUES (?, ?, ?)").run(
      "Sample Student", "student@example.com", hashedPassword
    ).lastInsertRowid;

    db.prepare("INSERT INTO preferences (user_id, subject) VALUES (?, ?)").run(userId, "Mathematics");
    db.prepare("INSERT INTO preferences (user_id, subject) VALUES (?, ?)").run(userId, "Computer Science");

    db.prepare("INSERT INTO quiz (user_id, subject, score) VALUES (?, ?, ?)").run(userId, "Mathematics", 85);
    db.prepare("INSERT INTO quiz (user_id, subject, score) VALUES (?, ?, ?)").run(userId, "Physics", 45);

    db.prepare("INSERT INTO progress (user_id, subject, progress) VALUES (?, ?, ?)").run(userId, "Mathematics", 75);
    db.prepare("INSERT INTO progress (user_id, subject, progress) VALUES (?, ?, ?)").run(userId, "Computer Science", 40);

    db.prepare("INSERT INTO schedule (user_id, subject, topic, date, time, status) VALUES (?, ?, ?, ?, ?, ?)").run(
      userId, "Mathematics", "Calculus Integration", "2026-03-20", "10:00", "pending"
    );
    db.prepare("INSERT INTO schedule (user_id, subject, topic, date, time, status) VALUES (?, ?, ?, ?, ?, ?)").run(
      userId, "Computer Science", "React Hooks", "2026-03-21", "14:00", "completed"
    );

    db.prepare("INSERT INTO reminders (user_id, message, time) VALUES (?, ?, ?)").run(
      userId, "Complete your Calculus assignment", "2026-03-20 09:00"
    );
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
