# 🧪 Cross-Device Sync Testing Guide

Complete step-by-step instructions for testing task and stats synchronization across multiple devices.

---

## 📋 Prerequisites Checklist

Before testing, ensure you have:

- [ ] ✅ **Pushed latest code to GitHub** (`git push origin main`)
- [ ] ✅ **Updated Google Apps Script** (copied from Setup button)
- [ ] ✅ **Created NEW deployment** in Google Apps Script
- [ ] ✅ **Updated webhook URL** in both devices' settings
- [ ] ✅ **Hard refreshed the app** on both devices (Ctrl+F5 or Cmd+Shift+R)

---

## 🚀 Initial Setup (Do This First!)

### Step 1: Deploy Updated Google Apps Script

1. **Open your app**: https://rodrigotanco.github.io/pomodoro_task_manager/
2. **Click Settings (⚙️)**
3. **Click "📋 Setup Instructions"**
4. **Click "📋 Copy Apps Script Code"** (should show "✅ Copied!")
5. **Open your Google Sheet**
6. **Go to Extensions → Apps Script**
7. **Select all existing code** (Ctrl+A)
8. **Paste the new code** (Ctrl+V)
9. **Save** (Ctrl+S)
10. **Click "Deploy" → "New deployment"** ⚠️ IMPORTANT: Must be "NEW deployment"
11. **Select:**
    - Type: **Web app**
    - Execute as: **Me**
    - Who has access: **Anyone**
12. **Click "Deploy"**
13. **Copy the web app URL** (e.g., `https://script.google.com/macros/s/...`)

### Step 2: Configure Both Devices

**On Device A (e.g., Desktop):**
1. Open https://rodrigotanco.github.io/pomodoro_task_manager/
2. Hard refresh: **Ctrl+F5** (Windows) or **Cmd+Shift+R** (Mac)
3. Click **Settings (⚙️)**
4. Paste the **webhook URL** from Step 1
5. Click **Save Settings**
6. Open browser console (**F12**)

**On Device B (e.g., Phone/Tablet):**
1. Open https://rodrigotanco.github.io/pomodoro_task_manager/
2. Hard refresh: Long-press reload button → "Hard refresh"
3. Click **Settings (⚙️)**
4. Paste the **same webhook URL**
5. Click **Save Settings**

---

## 🧪 Test 1: Task Synchronization

### Scenario: Create task on Device A, see it on Device B

**On Device A:**
1. ✅ Add a task: `"Test Task from Device A"`
2. ✅ Wait 5 seconds (automatic sync happens)
3. ✅ Check console, should see:
   ```
   Syncing 1 tasks to server...
   Task sync successful
   ```

**On Device B:**
1. ✅ Click **"🔄 Sync Now"** button
2. ✅ Wait for sync to complete
3. ✅ Check console, should see:
   ```
   Full sync completed successfully
   ➕ Added new task from server: Test Task from Device A
   ```
4. ✅ **Expected result**: Task appears in Device B's list

### ✅ Success Criteria:
- Task appears on Device B within 2 seconds of sync
- No CORS errors in console
- Console shows "Added new task from server"

### ❌ If It Fails:
- Check webhook URL is correct on both devices
- Verify you did "New deployment" (not "Manage deployments")
- Look for errors in browser console
- Check Google Apps Script Executions (View → Executions)

---

## 🧪 Test 2: Task Completion Sync

### Scenario: Complete task on Device A, see completion on Device B

**On Device A:**
1. ✅ Select the test task
2. ✅ Click **Start** timer (or skip and complete directly)
3. ✅ Click **✅ Complete Task** button
4. ✅ Check console, should see:
   ```
   Task completed - triggering confetti
   Syncing completed task to Completed Tasks sheet
   ```
5. ✅ Task should disappear from active tasks list

**On Device B:**
1. ✅ Click **"🔄 Sync Now"**
2. ✅ Check console, should see:
   ```
   🗑️ Task was completed on another device: Test Task from Device A
   ```
3. ✅ **Expected result**: Task disappears from Device B's list

### ✅ Success Criteria:
- Task removed from active list on both devices
- Console shows "Task completed on another device"
- No duplicate tasks created

---

## 🧪 Test 3: Today's Stats Sync

### Scenario: Complete task and work session on Device A, stats sync to Device B

**On Device A:**
1. ✅ Add a new task: `"Stats Sync Test"`
2. ✅ Select the task
3. ✅ Click **Start** (25-minute timer)
4. ✅ Let it run for 10+ seconds
5. ✅ Click **✅ Complete Task** (completes task + session)
6. ✅ Check "Today's Progress" section:
   - Tasks Completed: Should increase by 1
   - Work Sessions: Should increase by 1
   - Focus Time: Should show time
7. ✅ Check console, should see:
   ```
   🔄 [Stats Sync] Syncing completed task
   🔄 [Stats Sync] Syncing work session
   ```

**On Device B:**
1. ✅ Note current stats (Tasks/Sessions/Time)
2. ✅ Click **"🔄 Sync Now"**
3. ✅ Check console, should see:
   ```
   🔄 [Stats Sync] Starting sync for: [today's date]
   🔄 [Stats Sync] Fetching completed tasks from server...
   ✅ [Stats Sync] Received 1 completed tasks from server
   🔄 [Stats Sync] Fetching work sessions from server...
   ✅ [Stats Sync] Received 1 work sessions from server
   ✅ [Stats Sync] Stats display updated
   ```
4. ✅ **Expected result**: Stats on Device B match Device A

### ✅ Success Criteria:
- Completed tasks count matches across devices
- Work sessions count matches across devices
- Focus time matches across devices (±1 minute acceptable)
- Stats sync status shows "Synced" with timestamp

---

## 🧪 Test 4: Automatic Periodic Sync

### Scenario: Verify automatic sync works every 60 seconds

**On Device A:**
1. ✅ Add a task: `"Auto Sync Test"`
2. ✅ **DON'T** click Sync Now
3. ✅ Wait 60-65 seconds
4. ✅ Watch console for automatic sync:
   ```
   Full sync completed successfully
   ```

**On Device B:**
1. ✅ **DON'T** click Sync Now
2. ✅ Wait 60-65 seconds
3. ✅ Check console for automatic sync
4. ✅ **Expected result**: Task appears automatically within 2 minutes

### ✅ Success Criteria:
- Sync happens automatically every 60 seconds
- Console shows "Full sync completed successfully"
- No manual intervention needed

---

## 🧪 Test 5: CORS Verification

### Scenario: Verify NO CORS errors in console

**On Either Device:**
1. ✅ Open browser console (F12)
2. ✅ Click **"🔄 Sync Now"**
3. ✅ Go to **Network tab**
4. ✅ Look for POST requests to your webhook URL

### ✅ Success Criteria (What You SHOULD See):
```
✅ POST https://script.google.com/macros/s/.../exec  Status: 200
✅ Content-Type: text/plain;charset=utf-8
✅ Response: {"success":true,...}
```

### ❌ Failure Signs (What You SHOULD NOT See):
```
❌ Access to fetch... blocked by CORS policy
❌ OPTIONS request with Status: (failed)
❌ No 'Access-Control-Allow-Origin' header
```

### If You See CORS Errors:
1. **Hard refresh the page** (Ctrl+F5)
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Verify you pushed latest code to GitHub**
4. **Wait 2 minutes for GitHub Pages to deploy**

---

## 🧪 Test 6: Conflict Resolution

### Scenario: Edit same task on both devices simultaneously

**Setup:**
1. ✅ Add task on Device A: `"Conflict Test"`
2. ✅ Sync to Device B
3. ✅ Turn OFF internet on Device B (Airplane mode)

**On Device A (Online):**
1. ✅ Edit the task text to: `"Conflict Test - Updated on A"`
2. ✅ Wait for sync

**On Device B (Offline):**
1. ✅ Edit the same task to: `"Conflict Test - Updated on B"`
2. ✅ Task saved locally only

**Reconnect Device B:**
1. ✅ Turn internet back ON
2. ✅ Click **"🔄 Sync Now"**
3. ✅ Check console for conflict resolution:
   ```
   🔄 Updated task with server version: Conflict Test - Updated on A
   ```
4. ✅ **Expected result**: Device A's version wins (higher version number)

### ✅ Success Criteria:
- Version-based conflict resolution works
- No duplicate tasks created
- Latest version (by version number) wins
- Console shows "Updated task with server version"

---

## 🧪 Test 7: Deleted Tasks Tracking

### Scenario: Verify deleted/completed tasks don't re-appear

**On Device A:**
1. ✅ Add 3 tasks: `Task 1`, `Task 2`, `Task 3`
2. ✅ Wait for sync

**On Device B:**
1. ✅ Click Sync, verify all 3 tasks appear
2. ✅ Complete `Task 1` and `Task 2`

**On Device A:**
1. ✅ Click **"🔄 Sync Now"**
2. ✅ Check console:
   ```
   🗑️ Task was completed on another device: Task 1
   🗑️ Task was completed on another device: Task 2
   ```
3. ✅ **Expected result**: Only `Task 3` remains active

### ✅ Success Criteria:
- Completed tasks don't re-appear on other devices
- Deleted tasks are tracked for 90 days
- Console shows "Task completed on another device"

---

## 📊 Verify Google Sheets Data

### Check What's Being Saved

1. **Open your Google Sheet**
2. **Look for these tabs** (sheets):
   - ✅ **Tasks** - Active tasks (should match your app)
   - ✅ **Activity Log** - All completed tasks/sessions
   - ✅ **Completed Tasks** - Today's completed tasks
   - ✅ **Work Sessions** - Today's work sessions

3. **Verify data matches**:
   - Task text matches what you see in app
   - Timestamps are recent
   - Device IDs are different for each device
   - Version numbers increment on updates

---

## 🐛 Troubleshooting Common Issues

### Issue 1: "Sync Now" button shows error

**Symptoms:**
- Sync status shows "Sync failed"
- Console shows errors

**Solutions:**
1. Check webhook URL in settings
2. Verify Google Apps Script is deployed
3. Check Google Apps Script Executions for errors
4. Re-deploy Google Apps Script as "New deployment"

---

### Issue 2: Tasks not syncing between devices

**Symptoms:**
- Add task on Device A
- Task doesn't appear on Device B after sync

**Solutions:**
1. Open console on both devices
2. Click Sync on Device B
3. Look for error messages
4. Verify webhook URL is identical on both devices
5. Check Google Sheet - is the task there?
6. Verify automatic sync is working (wait 60 seconds)

---

### Issue 3: Stats show different numbers on each device

**Symptoms:**
- Device A shows 5 completed tasks
- Device B shows 3 completed tasks

**Solutions:**
1. Check dates match (stats are per-day)
2. Click Sync on Device B
3. Check console for stats sync logs:
   ```
   🔄 [Stats Sync] Received X completed tasks
   ```
4. Verify "Completed Tasks" sheet in Google Sheets has the data
5. Check Device B isn't in different timezone

---

### Issue 4: CORS errors still appearing

**Symptoms:**
```
❌ Access to fetch... blocked by CORS policy
```

**Solutions:**
1. **Hard refresh**: Ctrl+F5 or Cmd+Shift+R
2. **Clear cache**: Settings → Privacy → Clear browsing data
3. **Verify latest code**:
   - Open script.js in DevTools → Sources
   - Search for "Content-Type"
   - Should see: `'Content-Type': 'text/plain;charset=utf-8'`
4. **Check GitHub Pages deployed**: Wait 2 minutes after push
5. **Verify no browser extensions blocking**: Try incognito mode

---

### Issue 5: Duplicate tasks appearing

**Symptoms:**
- Same task appears 2-3 times
- Task IDs are different

**Solutions:**
1. Check task IDs (console logs show them)
2. Verify UUIDs are being used (not Date.now())
3. Check Google Sheet for duplicate entries
4. Clear localStorage on one device:
   ```javascript
   localStorage.clear()
   location.reload()
   ```
5. Re-sync from Google Sheets

---

## 📝 Test Results Template

Use this template to document your test results:

```
## Test Results - [Date]

### Environment:
- Device A: [Browser/OS]
- Device B: [Browser/OS]
- Webhook URL: [First 50 chars...]

### Test 1: Task Synchronization
- Status: ✅ Pass / ❌ Fail
- Notes: [Any observations]

### Test 2: Task Completion Sync
- Status: ✅ Pass / ❌ Fail
- Notes: [Any observations]

### Test 3: Today's Stats Sync
- Status: ✅ Pass / ❌ Fail
- Device A Stats: [X tasks, Y sessions, Z minutes]
- Device B Stats: [X tasks, Y sessions, Z minutes]
- Match: ✅ Yes / ❌ No

### Test 4: Automatic Periodic Sync
- Status: ✅ Pass / ❌ Fail
- Sync interval observed: [X seconds]

### Test 5: CORS Verification
- Status: ✅ Pass / ❌ Fail
- CORS errors found: ✅ None / ❌ [Error message]

### Test 6: Conflict Resolution
- Status: ✅ Pass / ❌ Fail
- Winner: [Device A/B version]

### Test 7: Deleted Tasks Tracking
- Status: ✅ Pass / ❌ Fail
- Re-appeared: ✅ None / ❌ [Count]

### Overall Result: ✅ All Pass / ⚠️ Partial / ❌ Failed
```

---

## 🎯 Expected Timeline

Normal sync operations should complete:
- **Manual sync**: 1-3 seconds
- **Automatic sync**: Every 60 seconds
- **Task creation → visible on other device**: <65 seconds (next auto-sync)
- **Stats sync**: 1-2 seconds (included in main sync)

---

## 🆘 Getting Help

If tests fail after following this guide:

1. **Check browser console** for errors
2. **Check Google Apps Script Executions**:
   - Open Apps Script editor
   - Click "Executions" (left sidebar)
   - Look for failed executions
   - Click to see error details
3. **Verify Google Sheet structure**:
   - Should have 4 sheets: Tasks, Activity Log, Completed Tasks, Work Sessions
   - Each should have headers in row 1
4. **Test with fresh data**:
   - Clear localStorage: `localStorage.clear()`
   - Reload page
   - Try syncing from Google Sheets

---

## ✅ Success Indicators

You'll know sync is working perfectly when:

✅ No CORS errors in console
✅ Console shows "Full sync completed successfully"
✅ Tasks appear on other devices within 60 seconds
✅ Stats match across all devices
✅ Completed tasks sync correctly
✅ No duplicate tasks created
✅ Sync status shows "Synced" with timestamp
✅ Google Sheets shows all data correctly

---

**🎉 Happy Testing!**

If all tests pass, your cross-device sync is working perfectly!