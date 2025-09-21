# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a comprehensive **Pomodoro Timer web application** that runs entirely in the browser. It includes timer functionality, task management, progress tracking, email reporting, and optional Google Sheets integration for data synchronization.

## Architecture

- **Frontend-only**: Pure HTML/CSS/JavaScript application with no backend required
- **Data Persistence**: Uses browser localStorage for all data storage
- **Single Page Application**: All functionality contained in one HTML page
- **Class-based JavaScript**: Main logic in `PomodoroTimer` class (script.js:1-1288)
- **Integration Ready**: Optional Google Apps Script webhook for Google Sheets sync

## Core Components

### PomodoroTimer Class (`script.js`)
The main application class handling:
- Timer management (work/break sessions)
- Task lifecycle (add, select, complete, track)
- Settings persistence and management
- Local storage operations
- Email report generation
- Google Sheets synchronization
- UI state management and event handling

### Key Data Structures
- `tasks[]`: Active task list with selection state
- `completedTasks[]`: Historical task completion data
- `workSessions[]`: Session tracking with duration and task association
- Settings: Work/break durations, email, webhook URL

## File Structure

- `index.html` - Main application interface with timer, tasks, settings, and stats sections
- `script.js` - Complete application logic in PomodoroTimer class
- `styles.css` - Modern CSS with glassmorphism design and responsive layout
- `google-apps-script.js` - Google Apps Script code for optional Sheets integration
- `definition.txt` - Original project requirements and feature specification

## Development Workflow

### Testing
- **Browser Testing**: Open `index.html` directly in browser - no build process needed
- **Data Persistence**: Test localStorage functionality across browser sessions
- **Email Integration**: Verify email client integration with mailto: links
- **Google Sheets**: Test webhook connectivity if configured

### Key Features to Understand
1. **Timer Logic**: Alternates between work (25min) and break (5min) sessions
2. **Task Selection**: Timer cannot start work sessions without selected task
3. **Progress Tracking**: Real-time stats and visual progress indicators
4. **Daily Reporting**: Automatic scheduling at 11:59 PM + manual report generation
5. **Settings Persistence**: All preferences saved to localStorage
6. **Audio Notifications**: Timer completion alerts

## Data Management

### Local Storage Schema
All data persisted under `pomodoroData` key containing:
- Timer settings (work/break durations)
- User email and webhook configuration
- Tasks array with completion status
- Work sessions with timestamps and durations
- Completed tasks history

### Google Sheets Integration
Optional webhook (`googleSheetsWebhookInput`) allows:
- Automatic data sync to Google Sheets
- Manual sync via "Sync Now" button
- Structured data with Date, Type, Description, Duration, Completion Time

## Common Development Tasks

### Adding New Features
1. Extend PomodoroTimer class methods
2. Add corresponding UI elements to `index.html`
3. Update CSS styles in `styles.css` for new elements
4. Test in browser for localStorage persistence

### Modifying Timer Behavior
- Core timer logic in `startTimer()`, `tick()`, `completeSession()` methods
- Session transitions handled in `completeSession()` method
- Progress updates managed by `updateDisplay()` method

### Updating Data Storage
- All persistence through `saveData()` method
- Data loading via `loadData()` method
- Schema changes require localStorage migration consideration

### Styling Changes
- CSS uses custom properties for consistent theming
- Responsive design with mobile-first approach
- Glassmorphism effects with backdrop-filter support