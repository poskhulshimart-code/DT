# DT - Duty Roster & Task Manager

A streamlined, AI-powered duty roster and task management application.

## Features

- **Daily & Monthly Roster**: Manage shifts for Cashiers, Packers, and more.
- **AI Roster Analysis**: Upload a photo of a printed roster, and Gemini AI will automatically parse and populate the digital roster.
- **Task Management**: Organize tasks with priorities, due dates, and reminders.
- **Sorting**: Multi-field sorting (Priority, Date, Title, Created).
- **Holiday Awareness**: Automatic detection and display of official holidays in Bangladesh.

## Deployment

### Netlify

This app is ready to be deployed to Netlify.

1. Connect your GitHub repository to Netlify.
2. Set the build command to `npm run build`.
3. Set the publish directory to `dist`.
4. **Important**: Add an environment variable `GEMINI_API_KEY` with your Google Gemini API key.

## Local Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and add your `GEMINI_API_KEY`.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Technologies Used

- React 19
- Vite
- Tailwind CSS
- Google Gemini API (via `@google/genai`)
- Lucide React
- Date-fns
- Motion
