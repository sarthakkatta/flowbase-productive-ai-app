# Flowbase

Flowbase is a full-stack productivity workspace built with Next.js, TypeScript, Clerk, Neon Postgres, Drizzle ORM, Gemini AI, Liveblocks, TipTap, Excalidraw, and AssemblyAI.

I built it as an all-in-one workspace where a user can manage notes, tasks, calendars, whiteboards, project spaces, AI-generated templates, and daily planning from one dashboard. 

## Features

- Dashboard with recent work, task summaries, calendar items, and AI insights
- Rich text notes using TipTap with autosave, search, pinning, trash, and restore
- Calendar for scheduled tasks, reminders, categories, and draft items
- Kanban boards with columns, tasks, priorities, labels, and calendar sync
- Collaborative Kanban access using Liveblocks with database-backed permissions
- Excalidraw whiteboard with saved scenes and AI-assisted diagram generation
- Spaces and workspace pages for organizing project documentation
- AI Assistant for creating notes, tasks, reminders, boards, whiteboards, and template apps
- AI Template Builder that generates mini productivity apps from prompts
- Voice dictation support using AssemblyAI streaming speech-to-text
- User settings, categories, AI preferences, and integration toggles

## Tech Stack

| Area | Tech |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Auth | Clerk |
| Database | Neon Postgres |
| ORM | Drizzle ORM |
| AI | Gemini API |
| Rich Text | TipTap |
| Whiteboard | Excalidraw |
| Collaboration | Liveblocks |
| Voice | AssemblyAI |

## Project Structure

```txt
app/            Next.js routes, server actions, and API routes
components/     Main UI components and feature pages
db/             Drizzle schema and database client
drizzle/         Database migrations
lib/            Shared feature logic, types, and helpers
hooks/          Custom React hooks
```

## How It Works

Flowbase uses Clerk for authentication. After login, the user is synced into the local database so all app data can be connected to an internal user record.

Most feature logic is handled through server actions. The frontend calls these actions for creating notes, calendar items, Kanban boards, tasks, whiteboards, workspace pages, and settings updates.

The AI features run on the server side through Gemini. For the AI Template Builder, the model does not generate executable code. It returns a structured JSON definition, which is then rendered safely using predefined React components.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

Create a `.env` file in the root folder and add the required keys:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

DATABASE_URL=your_neon_postgres_url

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

LIVEBLOCKS_SECRET_KEY=your_liveblocks_secret_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite

ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

### 3. Push database schema

```bash
npm run db:push
```

### 4. Run the app

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Create production build
npm run start      # Start production server
npm run lint       # Run linting
npm run db:push    # Push Drizzle schema to database
npm run db:studio  # Open Drizzle Studio
```

## Main Modules

### Notes

Notes are stored as TipTap JSON for rich formatting and plain text for search/previews. The editor supports headings, links, task lists, slash-style writing flows, autosave, AI refine, and voice dictation.

### Calendar

The calendar supports scheduled tasks, reminders, draft items, category colors, and task movement. Kanban tasks can also be synced into the calendar.

### Kanban

Kanban boards include columns, task priorities, labels, due dates, categories, and optional calendar syncing. Boards can be shared with other users, and Liveblocks is used for collaboration.

### Whiteboard

Whiteboards use Excalidraw. Each board stores the full canvas scene in the database, so drawings can be restored later. AI diagram generation is also supported.

### Spaces

Spaces work like project folders. Each space can contain rich text pages, templates, favorites, archives, and links to other Flowbase items like notes, tasks, calendar items, and whiteboards.

### AI Assistant

The AI Assistant works like a command layer for the app. It can help create notes, tasks, reminders, boards, whiteboards, settings updates, and generated template apps.

### AI Template Builder

This feature lets users describe a small productivity app they want, and Flowbase generates a structured mini-app from that prompt. The app renders the generated schema through safe predefined components instead of running AI-generated code.

## Database

The database is designed around user-owned productivity data.

Main tables include:

- `users`
- `notes`
- `calendar_items`
- `kanban_boards`
- `kanban_columns`
- `kanban_tasks`
- `kanban_board_shares`
- `whiteboards`
- `spaces`
- `workspace_pages`
- `space_shares`
- `page_links`
- `generated_apps`
- `user_settings`
- `user_categories`

I used relational tables where the data needed clear ownership and relationships, and JSONB where the data was more flexible, such as editor content, whiteboard scenes, settings, and generated app definitions.

## What I Focused On

The main goal was to build a realistic SaaS-style productivity app, not just separate CRUD pages. A lot of the work went into connecting modules together:

- Kanban tasks can sync with the calendar
- Workspace pages can link to notes, tasks, boards, calendar items, and whiteboards
- Dashboard aggregates data across multiple features
- AI Assistant can create objects across the app
- Shared boards and spaces use access checks before allowing collaboration

## Author

Built by me as a full-stack productivity SaaS project.
