export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Quiz {
  quiz_id: number;
  user_id: number;
  subject: string;
  score: number;
  date: string;
}

export interface Preference {
  pref_id: number;
  user_id: number;
  subject: string;
}

export interface Progress {
  progress_id: number;
  user_id: number;
  subject: string;
  progress: number;
  date: string;
}

export interface Schedule {
  schedule_id: number;
  user_id: number;
  subject: string;
  topic: string;
  date: string;
  time: string;
  status: 'pending' | 'completed';
}

export interface Reminder {
  reminder_id: number;
  user_id: number;
  message: string;
  time: string;
  is_read: number;
}

export interface Recommendation {
  subject: string;
  videos: { title: string; url: string }[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}
