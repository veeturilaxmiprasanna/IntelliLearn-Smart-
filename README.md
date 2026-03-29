# IntelliLearn Smart – Student Learning Tracker

IntelliLearn Smart is a comprehensive full-stack application designed to help students track their learning progress, manage study schedules, and receive personalized content recommendations.

## Tech Stack
- **Frontend:** React 19, Tailwind CSS, Motion (Animations), Lucide React (Icons)
- **Backend:** Node.js, Express
- **Database:** SQLite (via better-sqlite3)
- **Visualization:** Chart.js (react-chartjs-2)
- **Authentication:** Session-based with Bcrypt password hashing

## Core Features
1. **Dashboard:** Visual overview of quiz scores, task completion, and progress trends.
2. **Quiz Tracker:** Log and monitor quiz results across different subjects.
3. **Study Planner:** Create and manage daily/weekly study tasks with status tracking.
4. **Smart Recommendations:** Rule-based engine suggesting YouTube videos based on your interests and areas needing improvement.
5. **Focus Mode:** Inactivity detection that prompts users to stay focused.
6. **Reminder System:** Real-time alerts for scheduled tasks.

## Getting Started
1. **Login:** Use the sample account:
   - **Email:** `student@example.com`
   - **Password:** `password123`
2. **Dashboard:** View your learning metrics immediately.
3. **Planner:** Add your first study task in the "Study Planner" tab.
4. **Quizzes:** Record your scores to see the performance graph update.

## Database Schema
The app uses a relational SQLite database with the following tables:
- `user`: Stores student credentials.
- `quiz`: Stores subject scores and dates.
- `preferences`: Stores subjects the user wants to focus on.
- `progress`: Tracks percentage completion per subject.
- `schedule`: Manages study tasks and their statuses.
- `reminders`: Stores system-generated alerts.
- `learning_history`: Tracks watched recommendation videos.

## Project Structure
- `server.ts`: Main backend server and API endpoints.
- `src/App.tsx`: Main frontend application logic and UI components.
- `src/types.ts`: TypeScript definitions for data structures.
- `intellilearn.db`: SQLite database file.
