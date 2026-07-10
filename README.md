# TaskCabinet

TaskCabinet is a browser-local assignment planner built for students. It combines assignment tracking, due-date planning, course organization, independent checklists, calendar views, recommendations, workspace widgets, personalization, archive/trash recovery, and optional browser notifications in one React application.

## Run locally

Requirements: a current Node.js release and npm.

```powershell
npm install
npm run dev
```

Useful verification commands:

```powershell
npm run test
npm run lint
npm run build
```

`npm run dev:vercel` is only needed when testing Vercel functions locally.

## Architecture

- `src/App.jsx` contains the shared React state and the main product workflows: local accounts, assignments, courses, settings, widgets, calendar, checklists, imports, attachments, archive, and trash.
- `src/App.css` contains the application theme, responsive layout, widget, modal, calendar, settings, and task-card styles.
- `src/workspaceLayout.js` is the source of truth for widget defaults, sizing, placement, collapse behavior, migration, and desktop/mobile layouts.
- `src/*Utils.js` modules contain pure date, ranking, import, and voice-undo logic. These functions are covered by `tests/workspace.test.js`.
- `public/sw.js` provides the production-only network-first service worker and installable app shell.
- `api/voice-assignments.js` is an optional Vercel audio-processing endpoint. The current UI primarily uses the browser's built-in speech-recognition API.

## Browser-local data

TaskCabinet stores product data in the current browser. Signing in selects a local profile; it does not create a cloud account. Important per-profile data includes:

- assignments and their archive/trash state;
- courses and course colors;
- settings and personalization;
- standalone checklists;
- desktop and mobile widget layouts.

Attachments are stored in IndexedDB. Compatibility-sensitive keys still use the historical `taskacadia_` prefix and should not be renamed without a data migration. Clearing site data removes locally stored TaskCabinet information.

## Major product areas

- **Dashboard:** Recommended Plan of Attack, What Should I Do, reminders, course overview, statistics, mini calendar, and movable widgets.
- **Assignments:** To Do, In Progress, Completed, repeating work, estimates, priorities, notes, links, files, and checklist steps.
- **Calendar:** fixed full-calendar month/week views plus a movable dashboard mini calendar.
- **Checklists:** independent colored lists with optional deadlines and reminders.
- **Settings:** assignment defaults, field visibility, calendar behavior, notifications, school cycles, appearance, custom themes, archive, trash, and workspace guidance.
- **Imports:** pasted assignment lists and local PDF, DOCX, TXT, Markdown, or CSV syllabus extraction.

## Voice assignments

Voice assignment creation appears only in browsers that expose `SpeechRecognition` or `webkitSpeechRecognition`. Recognition happens through the browser and feeds the same local assignment-creation path as manual entry. The manual Add Assignment form remains available in every supported browser.

## Deployment

The application is configured for Vite and Vercel. A production build is created with:

```powershell
npm run build
```

Vercel can deploy the generated application from the connected repository. The service worker is registered only in production builds.

## Maintenance rules

- Preserve localStorage and IndexedDB compatibility when changing persistence.
- Add workspace migrations instead of resetting saved widget layouts.
- Keep the full Calendar page fixed; only the mini calendar is a workspace widget.
- Update tests when changing pure helpers, saved-layout behavior, ranking, or date calculations.
- Run test, lint, build, and `git diff --check` before deployment.
