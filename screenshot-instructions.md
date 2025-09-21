# Screenshot Instructions for User Guide

This document outlines the screenshots needed to complete the user guide. Replace the placeholder divs in `user-guide.html` with actual screenshots.

## Required Screenshots

### 1. Main Timer Interface
**Location in guide:** Getting Started section
**Filename suggestion:** `timer-interface.png`
**What to capture:**
- Main timer showing 25:00
- Task list with 2-3 example tasks
- One task selected (highlighted)
- Timer controls (Start, Pause, Reset buttons)
- Current session type "Work Session"
- Progress bar (empty state)

### 2. PWA Installation - Mobile
**Location in guide:** Install as Web App section
**Filename suggestions:** `mobile-install-1.png`, `mobile-install-2.png`
**What to capture:**
- Safari/Chrome browser with timer open
- Share menu showing "Add to Home Screen" option
- Home screen with Pomodoro Timer icon added

### 3. PWA Installation - Desktop
**Location in guide:** Install as Web App section
**Filename suggestions:** `desktop-install-1.png`, `desktop-install-2.png`
**What to capture:**
- Chrome/Edge browser with install icon in address bar
- Install prompt dialog
- Installed PWA running in its own window

### 4. Settings Panel
**Location in guide:** Key Features section
**Filename suggestion:** `settings-panel.png`
**What to capture:**
- Settings panel open showing:
  - Work/Break duration inputs
  - Email field
  - Notifications checkbox
  - Google Sheets webhook URL field
  - Setup Instructions button

### 5. Google Sheets Integration
**Location in guide:** Google Sheets Integration section
**Filename suggestions:** `apps-script-setup.png`, `google-sheet-result.png`
**What to capture:**
- Google Apps Script editor with the Pomodoro code
- Resulting Google Sheet with sample data (Activity Log, Tasks sheets)
- Deployment dialog in Apps Script

### 6. Active Timer Session
**Location in guide:** Pro Tips section
**Filename suggestion:** `active-session.png`
**What to capture:**
- Timer running (e.g., 18:42 remaining)
- Selected task highlighted
- Progress bar partially filled
- "Complete Task" and "Skip Break" buttons visible
- Session counter showing completed sessions

### 7. Notification Example
**Location in guide:** Key Features section
**Filename suggestion:** `notification-example.png`
**What to capture:**
- Desktop notification popup showing session completion
- Should include tomato emoji and completion message

### 8. Daily Stats and Progress
**Location in guide:** Pro Tips section
**Filename suggestion:** `daily-stats.png`
**What to capture:**
- Today's Progress section showing:
  - Tasks completed: 5
  - Work sessions: 8
  - Focus time: 200m
- Recent Activity list with several entries
- Sync status indicator showing "Synced"

## Screenshot Guidelines

### Technical Requirements
- **Resolution:** Minimum 1200px wide for desktop screenshots
- **Format:** PNG for best quality
- **Mobile:** Use device screenshots (actual phone/tablet)
- **Desktop:** Use actual browser screenshots

### Visual Standards
- **Clean UI:** No personal data, use sample tasks like "Write report", "Review emails"
- **Consistent timing:** Use realistic times (e.g., 23:45, 18:32, not 00:00)
- **Good lighting:** Ensure clear, well-lit screenshots
- **Crop appropriately:** Focus on relevant UI elements

### Sample Task Names to Use
- "Write project proposal"
- "Review team feedback"
- "Research competitor analysis"
- "Update presentation slides"
- "Plan next sprint"
- "Read industry articles"

### Implementation Steps
1. Take all required screenshots
2. Optimize images (compress while maintaining quality)
3. Save to `/images/` folder in the project
4. Replace placeholder divs in `user-guide.html` with:
   ```html
   <img src="images/screenshot-name.png" alt="Description" class="screenshot">
   ```
5. Add CSS styling for `.screenshot` class for responsive images

### Additional CSS for Screenshots
Add this CSS to the user guide:

```css
.screenshot {
    width: 100%;
    max-width: 800px;
    height: auto;
    border-radius: 10px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
    margin: 20px auto;
    display: block;
}

.screenshot-small {
    max-width: 400px;
}

.screenshot-mobile {
    max-width: 300px;
}
```

## Priority Order
1. **High Priority:** Main timer interface, Settings panel, Active session
2. **Medium Priority:** PWA installation (both mobile and desktop)
3. **Low Priority:** Google Sheets setup, Notifications, Daily stats

Complete the high-priority screenshots first as they're most essential for user understanding.