import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  Settings, 
  LogOut, 
  Brain, 
  Youtube, 
  Bell, 
  User as UserIcon,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Wind,
  Book,
  PlayCircle,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { User, Quiz, Preference, Progress, Schedule, Reminder, Recommendation, QuizQuestion } from './types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// --- Components ---

const AIQuiz = ({ onComplete }: { onComplete: (recs?: { title: string; url: string }[]) => void }) => {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [aiRecs, setAiRecs] = useState<{ title: string; url: string }[]>([]);

  const generateQuiz = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a 5-question multiple choice quiz about ${topic} in the subject of ${subject}. 
        Return the response as a JSON array of objects with the following structure:
        { "question": "string", "options": ["string", "string", "string", "string"], "correctAnswer": number (index 0-3) }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER }
              },
              required: ["question", "options", "correctAnswer"]
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      setQuestions(data);
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateResult(newAnswers);
    }
  };

  const calculateResult = async (finalAnswers: number[]) => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (q.correctAnswer === finalAnswers[i]) correct++;
    });
    const finalScore = Math.round((correct / questions.length) * 100);

    // Save result
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch('/api/quizzes', {
      method: 'POST',
      headers,
      body: JSON.stringify({ subject: `${subject}: ${topic}`, score: finalScore }),
    });

    // Generate recommendations
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const recResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on a score of ${finalScore}% in a quiz about ${topic} (${subject}), suggest 3 highly relevant YouTube video titles and their likely search queries. 
        Return as JSON array: [{ "title": "string", "query": "string" }]`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                query: { type: Type.STRING }
              },
              required: ["title", "query"]
            }
          }
        }
      });
      const recData = JSON.parse(recResponse.text);
      // Construct embed URLs (best guess or search links)
      // Since we don't have real IDs, we'll use search links or just titles for now.
      // Actually, let's just use the titles and provide a search button.
      setAiRecs(recData.map((r: any) => ({ 
        title: r.title, 
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(r.query)}` 
      })));
    } catch (e) {
      console.error("Failed to generate recs:", e);
    }

    setShowResult(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full"
        />
        <p className="text-stone-500 font-medium">Gemini is crafting your personalized quiz...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 max-w-md mx-auto">
        <h3 className="text-xl font-bold text-stone-800 mb-6">Start AI Quiz</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Science"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Photosynthesis"
            />
          </div>
          <button 
            onClick={generateQuiz}
            disabled={!subject || !topic}
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            Generate Quiz
          </button>
          <button 
            onClick={onComplete}
            className="w-full text-stone-400 font-medium py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    const score = Math.round((answers.filter((a, i) => a === questions[i].correctAnswer).length / questions.length) * 100);
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 max-w-2xl mx-auto text-center">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${score >= 70 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          <span className="text-2xl font-bold">{score}%</span>
        </div>
        <h3 className="text-2xl font-bold text-stone-800 mb-2">Quiz Completed!</h3>
        <p className="text-stone-500 mb-8">Great job on finishing the quiz about {topic}.</p>

        {aiRecs.length > 0 && (
          <div className="text-left mb-8">
            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
              <Youtube className="text-red-500" /> Recommended for you:
            </h4>
            <div className="space-y-3">
              {aiRecs.map((rec, i) => (
                <a 
                  key={i} 
                  href={rec.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors group"
                >
                  <span className="text-stone-700 font-medium group-hover:text-purple-600">{rec.title}</span>
                  <PlayCircle className="text-stone-400 group-hover:text-purple-600" size={20} />
                </a>
              ))}
            </div>
          </div>
        )}

        <button 
          onClick={() => onComplete(aiRecs)}
          className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const q = questions[currentQuestion];
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <span className="text-sm font-bold text-purple-600 uppercase tracking-wider">Question {currentQuestion + 1} of {questions.length}</span>
        <div className="h-2 w-32 bg-stone-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-purple-600 transition-all duration-300" 
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <h3 className="text-xl font-bold text-stone-800 mb-8">{q.question}</h3>

      <div className="space-y-3">
        {q.options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            className="w-full text-left p-4 rounded-xl border border-stone-200 hover:border-purple-500 hover:bg-purple-50 transition-all group flex items-center justify-between"
          >
            <span className="text-stone-700 group-hover:text-purple-700">{option}</span>
            <ChevronRight className="text-stone-300 group-hover:text-purple-500" size={18} />
          </button>
        ))}
      </div>
      <div className="mt-6 text-center">
        <button 
          onClick={() => onComplete()}
          className="text-stone-400 font-medium hover:text-stone-600"
        >
          Exit Quiz
        </button>
      </div>
    </div>
  );
};

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isRegister ? '/api/register' : '/api/login';
    const body = isRegister ? { name, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (isRegister) {
          setIsRegister(false);
          setError('Registration successful! Please login.');
        } else {
          if (data.token) {
            localStorage.setItem('intellilearn_token', data.token);
          }
          onLogin(data.user);
        }
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-100 p-3 rounded-full">
            <Brain className="w-10 h-10 text-emerald-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 text-stone-900">
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-stone-500 text-center mb-8">
          {isRegister ? 'Join IntelliLearn Smart today' : 'Login to track your learning progress'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            {isRegister ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="w-full mt-4 text-sm text-stone-500 hover:text-emerald-600"
        >
          {isRegister ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
        </button>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ user }: { user: User }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/quizzes', { headers }).then(res => res.json()).then(setQuizzes);
    fetch('/api/progress', { headers }).then(res => res.json()).then(setProgress);
    fetch('/api/schedule', { headers }).then(res => res.json()).then(setSchedule);
  }, []);

  const quizData = {
    labels: quizzes.slice(0, 5).reverse().map(q => q.subject),
    datasets: [{
      label: 'Quiz Scores',
      data: quizzes.slice(0, 5).reverse().map(q => q.score),
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.5)',
    }]
  };

  const progressData = {
    labels: Array.from(new Set(progress.map(p => p.subject))),
    datasets: [{
      label: 'Average Progress %',
      data: Array.from(new Set(progress.map(p => p.subject))).map(sub => {
        const subProgress = progress.filter(p => p.subject === sub);
        return subProgress.reduce((acc, curr) => acc + curr.progress, 0) / subProgress.length;
      }),
      backgroundColor: [
        'rgba(16, 185, 129, 0.6)',
        'rgba(59, 130, 246, 0.6)',
        'rgba(245, 158, 11, 0.6)',
        'rgba(239, 68, 68, 0.6)',
      ],
    }]
  };

  const completedTasks = schedule.filter(s => s.status === 'completed').length;
  const pendingTasks = schedule.filter(s => s.status === 'pending').length;

  const taskData = {
    labels: ['Completed', 'Pending'],
    datasets: [{
      data: [completedTasks, pendingTasks],
      backgroundColor: ['#10b981', '#f59e0b'],
    }]
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><TrendingUp /></div>
            <h3 className="font-semibold text-stone-700">Recent Quiz Score</h3>
          </div>
          <p className="text-3xl font-bold text-stone-900">{quizzes[0]?.score || 0}%</p>
          <p className="text-sm text-stone-500">{quizzes[0]?.subject || 'No quizzes taken'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><CheckCircle /></div>
            <h3 className="font-semibold text-stone-700">Tasks Completed</h3>
          </div>
          <p className="text-3xl font-bold text-stone-900">{completedTasks}</p>
          <p className="text-sm text-stone-500">Out of {schedule.length} total tasks</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Clock /></div>
            <h3 className="font-semibold text-stone-700">Pending Tasks</h3>
          </div>
          <p className="text-3xl font-bold text-stone-900">{pendingTasks}</p>
          <p className="text-sm text-stone-500">Scheduled for this week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-bold text-stone-800 mb-4">Quiz Performance Trend</h3>
          <Line data={quizData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-bold text-stone-800 mb-4">Subject Progress</h3>
          <Bar data={progressData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 max-w-md mx-auto">
        <h3 className="font-bold text-stone-800 mb-4 text-center">Task Status Distribution</h3>
        <Pie data={taskData} />
      </div>
    </div>
  );
};

const QuizSection = ({ onSetAiRecs }: { onSetAiRecs: (recs: { title: string; url: string }[]) => void }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAIQuiz, setShowAIQuiz] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/quizzes', { headers }).then(res => res.json()).then(setQuizzes);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch('/api/quizzes', {
      method: 'POST',
      headers,
      body: JSON.stringify({ subject, score: parseInt(score) }),
    });
    setSubject('');
    setScore('');
    setShowForm(false);
    fetch('/api/quizzes', { headers }).then(res => res.json()).then(setQuizzes);
  };

  if (showAIQuiz) {
    return <AIQuiz 
      onComplete={(recs) => {
        if (recs) onSetAiRecs(recs);
        setShowAIQuiz(false);
        const token = localStorage.getItem('intellilearn_token');
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        fetch('/api/quizzes', { headers }).then(res => res.json()).then(setQuizzes);
      }} 
    />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-stone-800">Quiz Tracking</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAIQuiz(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Brain size={18} /> Take AI Quiz
          </button>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Add Quiz Result'}
          </button>
        </div>
      </div>

      {showForm && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit} 
          className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Mathematics"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Score (%)</label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0-100"
                min="0"
                max="100"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold">Save Result</button>
        </motion.form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-stone-700">Subject</th>
              <th className="px-6 py-4 font-semibold text-stone-700">Score</th>
              <th className="px-6 py-4 font-semibold text-stone-700">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {quizzes.map(q => (
              <tr key={q.quiz_id}>
                <td className="px-6 py-4 text-stone-800">{q.subject}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${q.score >= 80 ? 'bg-emerald-100 text-emerald-700' : q.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {q.score}%
                  </span>
                </td>
                <td className="px-6 py-4 text-stone-500 text-sm">{new Date(q.date).toLocaleDateString()}</td>
              </tr>
            ))}
            {quizzes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-stone-400">No quiz history found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Planner = () => {
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/schedule', { headers }).then(res => res.json()).then(setSchedule);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch('/api/schedule', {
      method: 'POST',
      headers,
      body: JSON.stringify({ subject, topic, date, time }),
    });
    setSubject('');
    setTopic('');
    setDate('');
    setTime('');
    setShowForm(false);
    fetch('/api/schedule', { headers }).then(res => res.json()).then(setSchedule);
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/schedule/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: newStatus }),
    });
    fetch('/api/schedule', { headers }).then(res => res.json()).then(setSchedule);
  };

  const deleteTask = async (id: number) => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/schedule/${id}`, { method: 'DELETE', headers });
    fetch('/api/schedule', { headers }).then(res => res.json()).then(setSchedule);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-stone-800">Study Planner</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Task'}
        </button>
      </div>

      {showForm && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit} 
          className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Subject"
              required
            />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Topic"
              required
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold">Schedule Task</button>
        </motion.form>
      )}

      <div className="space-y-4">
        {schedule.map(s => (
          <div key={s.schedule_id} className={`flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border ${s.status === 'completed' ? 'border-emerald-100 bg-emerald-50/30' : 'border-stone-100'}`}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => toggleStatus(s.schedule_id, s.status)}
                className={`p-2 rounded-full transition-colors ${s.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-400 hover:bg-emerald-50 hover:text-emerald-500'}`}
              >
                <CheckCircle className="w-6 h-6" />
              </button>
              <div>
                <h4 className={`font-bold ${s.status === 'completed' ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{s.topic}</h4>
                <p className="text-sm text-stone-500">{s.subject} • {s.date} at {s.time}</p>
              </div>
            </div>
            <button 
              onClick={() => deleteTask(s.schedule_id)}
              className="text-stone-400 hover:text-red-500 p-2"
            >
              <LogOut className="w-5 h-5 rotate-90" /> {/* Using LogOut as a placeholder for delete icon */}
            </button>
          </div>
        ))}
        {schedule.length === 0 && (
          <div className="text-center py-10 text-stone-400 bg-white rounded-2xl border border-dashed border-stone-200">
            No tasks scheduled yet
          </div>
        )}
      </div>
    </div>
  );
};

const Recommendations = ({ aiRecs }: { aiRecs: { title: string; url: string }[] }) => {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/recommendations', { headers })
      .then(res => res.json())
      .then(data => {
        setRecs(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-10">Loading recommendations...</div>;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-stone-800">Smart Recommendations</h2>
      
      {aiRecs.length > 0 && (
        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 mb-8">
          <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
            <Brain size={20} /> AI-Powered Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiRecs.map((rec, i) => (
              <a 
                key={i} 
                href={rec.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white p-4 rounded-xl shadow-sm border border-purple-100 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Youtube className="text-red-500" size={20} />
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">AI Suggestion</span>
                </div>
                <p className="text-stone-800 font-medium group-hover:text-purple-600 line-clamp-2">{rec.title}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {recs.length === 0 && aiRecs.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-center gap-4 text-amber-700">
          <AlertTriangle />
          <p>Add some preferences or take a quiz to get personalized recommendations!</p>
        </div>
      )}
      {recs.map((rec, i) => (
        <div key={i} className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-1 rounded text-emerald-600"><Youtube size={20} /></div>
            <h3 className="text-xl font-bold text-stone-800">{rec.subject}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rec.videos.map((video, j) => (
              <div key={j} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="aspect-video">
                  <iframe
                    width="100%"
                    height="100%"
                    src={video.url}
                    title={video.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-stone-800">{video.title}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Games = () => {
  const [activeGame, setActiveGame] = useState<'memory' | 'breathing' | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-stone-800">Stress Relief Zone</h2>
        {activeGame && (
          <button 
            onClick={() => setActiveGame(null)}
            className="text-stone-500 hover:text-stone-800 font-medium"
          >
            Back to Games
          </button>
        )}
      </div>

      {!activeGame ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            onClick={() => setActiveGame('memory')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 cursor-pointer hover:border-emerald-200 transition-all group"
          >
            <div className="bg-emerald-100 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Brain size={24} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">Memory Match</h3>
            <p className="text-stone-500">Sharpen your focus with a quick card matching game. Perfect for a 5-minute study break.</p>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            onClick={() => setActiveGame('breathing')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 cursor-pointer hover:border-blue-200 transition-all group"
          >
            <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Wind size={24} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">Mindful Breathing</h3>
            <p className="text-stone-500">A guided breathing exercise to reduce stress and reset your mind before your next session.</p>
          </motion.div>
        </div>
      ) : activeGame === 'memory' ? (
        <MemoryGame />
      ) : (
        <BreathingExercise />
      )}
    </div>
  );
};

const MemoryGame = () => {
  const icons = [<Book />, <Clock />, <CheckCircle />, <TrendingUp />, <Youtube />, <Wind />, <Brain />, <LogOut />];
  const [cards, setCards] = useState<{ id: number; icon: React.ReactNode; flipped: boolean; matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const initGame = () => {
    const deck = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((icon, i) => ({ id: i, icon, flipped: false, matched: false }));
    setCards(deck);
    setFlipped([]);
    setMoves(0);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleFlip = (id: number) => {
    if (flipped.length === 2 || cards[id].flipped || cards[id].matched) return;

    const newCards = [...cards];
    newCards[id].flipped = true;
    setCards(newCards);

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      // Compare icons by their type/name if possible, here we just use the index in the original icons array logic
      // Since icons are React elements, we'd need a better way to compare. Let's use strings for the logic.
      const iconNames = [...['Book', 'Clock', 'Check', 'Trend', 'YT', 'Wind', 'Brain', 'Out'], ...['Book', 'Clock', 'Check', 'Trend', 'YT', 'Wind', 'Brain', 'Out']]
        .sort(() => 0.5); // This is just a placeholder, let's fix the deck generation.
    }
  };

  // Re-implementing with stable keys for comparison
  const [gameDeck, setGameDeck] = useState<{ id: number; type: string; flipped: boolean; matched: boolean }[]>([]);
  const types = ['book', 'clock', 'check', 'trend', 'yt', 'wind', 'brain', 'logout'];
  
  const startNewGame = () => {
    const deck = [...types, ...types]
      .sort(() => Math.random() - 0.5)
      .map((type, i) => ({ id: i, type, flipped: false, matched: false }));
    setGameDeck(deck);
    setFlipped([]);
    setMoves(0);
  };

  useEffect(() => {
    startNewGame();
  }, []);

  const onCardClick = (id: number) => {
    if (flipped.length === 2 || gameDeck[id].flipped || gameDeck[id].matched) return;

    const newDeck = [...gameDeck];
    newDeck[id].flipped = true;
    setGameDeck(newDeck);

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      if (gameDeck[first].type === gameDeck[second].type) {
        setTimeout(() => {
          const matchedDeck = [...gameDeck];
          matchedDeck[first].matched = true;
          matchedDeck[second].matched = true;
          setGameDeck(matchedDeck);
          setFlipped([]);
        }, 500);
      } else {
        setTimeout(() => {
          const resetDeck = [...gameDeck];
          resetDeck[first].flipped = false;
          resetDeck[second].flipped = false;
          setGameDeck(resetDeck);
          setFlipped([]);
        }, 1000);
      }
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'book': return <Book />;
      case 'clock': return <Clock />;
      case 'check': return <CheckCircle />;
      case 'trend': return <TrendingUp />;
      case 'yt': return <Youtube />;
      case 'wind': return <Wind />;
      case 'brain': return <Brain />;
      case 'logout': return <LogOut />;
      default: return null;
    }
  };

  const isWon = gameDeck.length > 0 && gameDeck.every(c => c.matched);

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-bold text-stone-800">Memory Match</h3>
          <p className="text-stone-500">Moves: {moves}</p>
        </div>
        <button onClick={startNewGame} className="text-emerald-600 font-semibold hover:underline">Reset Game</button>
      </div>

      {isWon ? (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-12"
        >
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <CheckCircle size={40} />
          </div>
          <h4 className="text-2xl font-bold text-stone-800 mb-2">Well Done!</h4>
          <p className="text-stone-500 mb-6">You cleared the board in {moves} moves.</p>
          <button onClick={startNewGame} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">Play Again</button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {gameDeck.map(card => (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCardClick(card.id)}
              className={`aspect-square rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 ${card.flipped || card.matched ? 'bg-emerald-600 text-white rotate-y-180' : 'bg-stone-100 text-stone-300'}`}
            >
              {(card.flipped || card.matched) ? getIcon(card.type) : <Brain size={32} opacity={0.2} />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const BreathingExercise = () => {
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [counter, setCounter] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCounter(c => {
        if (c === 1) {
          if (phase === 'Inhale') { setPhase('Hold'); return 4; }
          if (phase === 'Hold') { setPhase('Exhale'); return 4; }
          if (phase === 'Exhale') { setPhase('Inhale'); return 4; }
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="bg-white p-12 rounded-2xl shadow-sm border border-stone-100 max-w-md mx-auto text-center">
      <h3 className="text-2xl font-bold text-stone-800 mb-8">Mindful Breathing</h3>
      
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        <motion.div
          animate={{
            scale: phase === 'Inhale' ? 1.5 : phase === 'Exhale' ? 1 : 1.5,
            opacity: phase === 'Hold' ? 0.8 : 1
          }}
          transition={{ duration: 4, ease: "easeInOut" }}
          className={`absolute inset-0 rounded-full ${phase === 'Inhale' ? 'bg-blue-100' : phase === 'Hold' ? 'bg-emerald-100' : 'bg-amber-100'}`}
        />
        <div className="relative z-10">
          <p className="text-3xl font-bold text-stone-800 mb-2">{phase}</p>
          <p className="text-xl text-stone-500">{counter}s</p>
        </div>
      </div>

      <p className="mt-12 text-stone-500 italic">Follow the circle. Inhale deeply, hold, and release slowly.</p>
    </div>
  );
};

const Profile = ({ user, onUpdate }: { user: User, onUpdate: (u: User) => void }) => {
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdate(data.user);
        setMessage('Profile updated successfully!');
      } else {
        setMessage(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setMessage('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
        <div className="flex items-center gap-6 mb-8">
          <div className="bg-emerald-100 p-6 rounded-full text-emerald-600">
            <UserIcon size={48} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-900">{user.name}</h2>
            <p className="text-stone-500">{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Email Address</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 border border-stone-200 rounded-lg bg-stone-50 text-stone-400 cursor-not-allowed"
            />
            <p className="text-xs text-stone-400 mt-1">Email cannot be changed.</p>
          </div>

          {message && (
            <p className={`text-sm ${message.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
        <h3 className="text-red-800 font-bold mb-2">Account Security</h3>
        <p className="text-red-600 text-sm mb-4">Protect your account by ensuring your password is strong and unique.</p>
        <button className="text-red-700 font-semibold text-sm hover:underline">Change Password</button>
      </div>
    </div>
  );
};

const Preferences = () => {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [subject, setSubject] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/preferences', { headers }).then(res => res.json()).then(setPrefs);
  }, []);

  const addPref = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch('/api/preferences', {
      method: 'POST',
      headers,
      body: JSON.stringify({ subject }),
    });
    setSubject('');
    fetch('/api/preferences', { headers }).then(res => res.json()).then(setPrefs);
  };

  const deletePref = async (id: number) => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/preferences/${id}`, { method: 'DELETE', headers });
    fetch('/api/preferences', { headers }).then(res => res.json()).then(setPrefs);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-stone-800">Subject Preferences</h2>
      <form onSubmit={addPref} className="flex gap-2">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="flex-1 px-4 py-2 border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Add a subject to focus on..."
          required
        />
        <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold">Add</button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {prefs.map(p => (
          <div key={p.pref_id} className="flex items-center justify-between bg-white px-4 py-2 rounded-full border border-stone-100 shadow-sm">
            <span className="text-stone-700 font-medium">{p.subject}</span>
            <button onClick={() => deletePref(p.pref_id)} className="text-stone-400 hover:text-red-500 ml-2">×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showFocusPopup, setShowFocusPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState<{ title: string; url: string }[]>([]);
  const [showReminders, setShowReminders] = useState(false);
  const [previewLogin, setPreviewLogin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/me', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) setUser(data.user);
      })
      .catch(err => console.error("Auth check failed:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      const fetchReminders = () => {
        const token = localStorage.getItem('intellilearn_token');
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        fetch('/api/reminders', { headers }).then(res => res.json()).then(setReminders);
      };
      fetchReminders();
      const interval = setInterval(fetchReminders, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Focus Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && user) {
        setShowFocusPopup(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('intellilearn_token');
    setUser(null);
  };

  const markAsRead = async (id: number) => {
    const token = localStorage.getItem('intellilearn_token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/reminders/${id}`, { method: 'PATCH', headers });
    setReminders(prev => prev.filter(r => r.reminder_id !== id));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50">Loading...</div>;

  if (!user || previewLogin) return (
    <div className="relative">
      {previewLogin && (
        <button 
          onClick={() => setPreviewLogin(false)}
          className="fixed top-4 right-4 z-[200] bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-stone-800"
        >
          Exit Preview
        </button>
      )}
      <Login onLogin={(u) => {
        setUser(u);
        setPreviewLogin(false);
      }} />
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col fixed h-full">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-lg text-white">
            <Brain size={24} />
          </div>
          <span className="font-bold text-xl text-stone-900">IntelliLearn</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'quizzes', icon: BookOpen, label: 'Quizzes' },
            { id: 'planner', icon: Calendar, label: 'Study Planner' },
            { id: 'recommendations', icon: Youtube, label: 'Recommendations' },
            { id: 'games', icon: Wind, label: 'Stress Relief' },
            { id: 'profile', icon: UserIcon, label: 'Profile' },
            { id: 'preferences', icon: Settings, label: 'Preferences' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-700 font-semibold' 
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-100">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl transition-colors ${
              activeTab === 'profile' ? 'bg-emerald-50' : 'hover:bg-stone-50'
            }`}
          >
            <div className="bg-stone-100 p-2 rounded-full text-stone-600">
              <UserIcon size={20} />
            </div>
            <div className="overflow-hidden text-left">
              <p className="font-semibold text-stone-900 truncate">{user.name}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 capitalize">{activeTab.replace('-', ' ')}</h1>
            <p className="text-stone-500">Welcome back, {user.name.split(' ')[0]}!</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`p-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors ${
                activeTab === 'profile' ? 'ring-2 ring-emerald-500' : ''
              }`}
              title="My Profile"
            >
              <UserIcon size={20} />
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowReminders(!showReminders)}
                className="p-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 relative"
              >
                <Bell size={20} />
                {reminders.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              <AnimatePresence>
                {showReminders && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-lg z-50 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Reminders ({reminders.length})</p>
                      <button onClick={() => setShowReminders(false)} className="text-stone-400 hover:text-stone-600">×</button>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                      {reminders.map(r => (
                        <div key={r.reminder_id} className="text-sm border-l-2 border-emerald-500 pl-3 py-2 bg-stone-50/50 rounded-r-lg group relative">
                          <p className="text-stone-800 pr-6">{r.message}</p>
                          <p className="text-xs text-stone-400 mt-1">{r.time}</p>
                          <button 
                            onClick={() => markAsRead(r.reminder_id)}
                            className="absolute top-2 right-2 text-stone-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Mark as read"
                          >
                            <CheckCircle size={16} />
                          </button>
                        </div>
                      ))}
                      {reminders.length === 0 && (
                        <p className="text-center text-stone-400 py-4 text-sm">No new reminders</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard user={user} />}
            {activeTab === 'quizzes' && <QuizSection onSetAiRecs={setAiRecommendations} />}
            {activeTab === 'planner' && <Planner />}
            {activeTab === 'recommendations' && <Recommendations aiRecs={aiRecommendations} />}
            {activeTab === 'games' && <Games />}
            {activeTab === 'profile' && <Profile user={user} onUpdate={setUser} />}
            {activeTab === 'preferences' && <Preferences />}
            
            <div className="mt-12 pt-8 border-t border-stone-200">
              <p className="text-sm text-stone-400 mb-4">Developer Tools:</p>
              <button 
                onClick={() => setPreviewLogin(true)}
                className="text-xs bg-stone-200 text-stone-600 px-3 py-1 rounded hover:bg-stone-300 transition-colors"
              >
                Preview Login Page
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Focus Popup */}
      <AnimatePresence>
        {showFocusPopup && (
          <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center"
            >
              <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Stay Focused!</h2>
              <p className="text-stone-500 mb-8">You were away for a moment. Consistency is key to learning success.</p>
              <button 
                onClick={() => setShowFocusPopup(false)}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
              >
                I'm Back!
              </button>
              
              <div className="mt-6 pt-6 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-4">Need a break? Try this mini-game:</p>
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                  <p className="text-sm font-medium text-stone-600">Click the emerald square!</p>
                  <div className="flex justify-center mt-2">
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setShowFocusPopup(false);
                        setActiveTab('games');
                      }}
                      className="w-12 h-12 bg-emerald-500 rounded-lg cursor-pointer shadow-lg shadow-emerald-200"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
