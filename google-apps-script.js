// Google Apps Script code for automatic Pomodoro data sync with full task synchronization
// Version: 3.0.2 with text/plain CORS bypass
//
// Instructions:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Delete existing code and paste this entire file
// 4. Save the project (name it "Pomodoro Sync")
// 5. Deploy as web app:
//    - Click "Deploy" → "New deployment" (NOT "Manage deployments")
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Copy the web app URL and use it in the Pomodoro timer settings
//
// CORS WORKAROUND: Google Apps Script doesn't always respect CORS headers when
// deployed as a Web App. To bypass this limitation, the client sends requests
// with Content-Type: text/plain which is treated as a "simple request" and
// doesn't trigger CORS preflight. The doOptions() function is still included
// for completeness, but the text/plain approach is more reliable.

// Configuration
const ACTIVITY_SHEET_NAME = 'Activity Log';
const TASKS_SHEET_NAME = 'Tasks';
const COMPLETED_TASKS_SHEET_NAME = 'Completed Tasks';
const WORK_SESSIONS_SHEET_NAME = 'Work Sessions';
const ARCHIVED_TASKS_SHEET_NAME = 'Archived Tasks';
const SETTINGS_SHEET_NAME = 'Settings';

// Task schema version - increment when changing task structure
const TASK_SCHEMA_VERSION = 3; // Added Completed Tasks and Work Sessions sync

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400' // 24 hours cache for preflight
};

// Handle OPTIONS requests for CORS preflight
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(CORS_HEADERS);
}

// Helper functions for sheet management
function getOrCreateSheet(name, headers = []) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    if (headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }
  } else if (headers.length > 0 && (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
  }

  return sheet;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'log_activity';

    let response = {};

    switch (action) {
      case 'log_activity':
        response = logActivity(data);
        break;
      case 'sync_tasks':
        response = syncTasks(data);
        break;
      case 'get_tasks':
        response = getTasks(data);
        break;
      case 'update_task':
        response = updateTask(data);
        break;
      case 'delete_task':
        response = deleteTask(data);
        break;
      case 'complete_task':
        response = completeTask(data);
        break;
      case 'sync_completed_tasks':
        response = syncCompletedTasks(data);
        break;
      case 'get_completed_tasks':
        response = getCompletedTasks(data);
        break;
      case 'sync_work_sessions':
        response = syncWorkSessions(data);
        break;
      case 'get_work_sessions':
        response = getWorkSessions(data);
        break;
      case 'sync_archived_tasks':
        response = syncArchivedTasks(data);
        break;
      case 'get_archived_tasks':
        response = getArchivedTasks(data);
        break;
      case 'get_version':
        response = getVersion();
        break;
      default:
        response = { success: false, error: 'Unknown action: ' + action };
    }

    // Handle JSONP callback if present
    const callback = e.parameter ? e.parameter.callback : null;

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
        .setHeaders(CORS_HEADERS);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(CORS_HEADERS);
    }

  } catch (error) {
    const callback = e.parameter ? e.parameter.callback : null;
    const errorResponse = {
      success: false,
      error: error.toString()
    };

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
        .setHeaders(CORS_HEADERS);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(CORS_HEADERS);
    }
  }
}

// Activity logging (original functionality)
function logActivity(data) {
  const sheet = getOrCreateSheet(ACTIVITY_SHEET_NAME, [
    'Date', 'Type', 'Description', 'Duration (min)', 'Completed Time'
  ]);

  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, 5).setValues([[
    data.date,
    data.type,
    data.description,
    data.duration,
    data.completedTime
  ]]);

  sheet.autoResizeColumns(1, 5);

  return {
    success: true,
    message: 'Activity logged successfully',
    row: nextRow
  };
}

// Task synchronization functions
function syncTasks(data) {
  console.log('syncTasks called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const tasks = data.tasks || [];
  const deviceId = data.deviceId || 'unknown';
  const timestamp = new Date().toISOString();

  console.log('Processing', tasks.length, 'tasks for device:', deviceId);

  let syncedCount = 0;
  let conflictsCount = 0;
  const conflicts = [];

  for (const task of tasks) {
    console.log('Processing task for sync:', task.id, task.text);

    const existingRowIndex = findTaskRow(sheet, task.id);

    if (existingRowIndex === -1) {
      // New task - add it
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 9).setValues([[
        task.id,
        task.text,
        task.completed || false,
        task.version || 1,
        task.createdAt,
        task.completedAt || '',
        timestamp,
        deviceId,
        'synced'
      ]]);
      syncedCount++;
      console.log('Added new task to sheet:', task.text);
    } else {
      // Existing task - check for conflicts using version first, then timestamp
      const existingData = sheet.getRange(existingRowIndex, 1, 1, 9).getValues()[0];
      const existingVersion = existingData[3] || 1;
      const taskVersion = task.version || 1;

      console.log('Comparing versions - Client:', taskVersion, 'Server:', existingVersion);

      if (taskVersion > existingVersion) {
        // Client has newer version - update
        sheet.getRange(existingRowIndex, 1, 1, 9).setValues([[
          task.id,
          task.text,
          task.completed || false,
          taskVersion,
          task.createdAt,
          task.completedAt || '',
          timestamp,
          deviceId,
          'synced'
        ]]);
        syncedCount++;
        console.log('Updated task with newer version:', task.text);
      } else if (taskVersion < existingVersion) {
        // Server has newer version - conflict
        conflictsCount++;
        conflicts.push({
          taskId: task.id,
          reason: 'newer_version_exists',
          serverVersion: existingVersion,
          clientVersion: taskVersion
        });
        console.log('Conflict detected - server has newer version:', task.id);
      } else {
        // Same version - use timestamp as tiebreaker
        const existingModified = new Date(existingData[6]);
        const taskModified = new Date(task.lastModified || task.createdAt);

        if (taskModified > existingModified) {
          sheet.getRange(existingRowIndex, 1, 1, 9).setValues([[
            task.id,
            task.text,
            task.completed || false,
            taskVersion,
            task.createdAt,
            task.completedAt || '',
            timestamp,
            deviceId,
            'synced'
          ]]);
          syncedCount++;
          console.log('Updated task (same version, newer timestamp):', task.text);
        } else {
          console.log('Task already in sync:', task.text);
        }
      }
    }
  }

  const result = {
    success: true,
    message: `Synced ${syncedCount} tasks`,
    syncedCount,
    conflictsCount,
    conflicts
  };

  console.log('syncTasks result:', JSON.stringify(result));
  return result;
}

function getTasks(data) {
  console.log('getTasks called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const lastRow = sheet.getLastRow();
  console.log('Tasks sheet last row:', lastRow);

  if (lastRow <= 1) {
    console.log('No tasks found in sheet');
    return { success: true, tasks: [] };
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 9);
  const values = dataRange.getValues();

  const tasks = values
    .filter(row => row[0]) // Filter out empty rows
    .map(row => ({
      id: row[0],
      text: row[1],
      completed: row[2],
      version: row[3] || 1,
      createdAt: row[4],
      completedAt: row[5] || null,
      lastModified: row[6],
      deviceId: row[7],
      syncStatus: row[8]
    }));

  const result = {
    success: true,
    tasks: tasks,
    count: tasks.length
  };

  console.log('getTasks result:', JSON.stringify(result));
  return result;
}

function updateTask(data) {
  const sheet = getOrCreateSheet(TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const task = data.task;
  const deviceId = data.deviceId || 'unknown';
  const timestamp = new Date().toISOString();

  const rowIndex = findTaskRow(sheet, task.id);

  if (rowIndex === -1) {
    return { success: false, error: 'Task not found' };
  }

  sheet.getRange(rowIndex, 1, 1, 9).setValues([[
    task.id,
    task.text,
    task.completed || false,
    task.version || 1,
    task.createdAt,
    task.completedAt || '',
    timestamp,
    deviceId,
    'synced'
  ]]);

  return {
    success: true,
    message: 'Task updated successfully'
  };
}

function deleteTask(data) {
  console.log('deleteTask called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const taskId = data.taskId;
  const rowIndex = findTaskRow(sheet, taskId);

  if (rowIndex === -1) {
    console.log('Task not found for deletion:', taskId);
    // Return success even if task not found (might have been deleted already)
    return {
      success: true,
      message: 'Task already deleted or not found',
      taskId: taskId,
      wasFound: false
    };
  }

  // Get task details before deletion for confirmation
  const taskData = sheet.getRange(rowIndex, 1, 1, 8).getValues()[0];
  const taskText = taskData[1];

  sheet.deleteRow(rowIndex);

  console.log('Task deleted successfully:', taskText);

  return {
    success: true,
    message: 'Task deleted successfully',
    taskId: taskId,
    taskText: taskText,
    wasFound: true
  };
}

// Atomically complete a task: delete from active tasks and add to completed tasks
function completeTask(data) {
  console.log('completeTask called with data:', JSON.stringify(data));

  const task = data.task;
  const workSession = data.workSession;
  const deviceId = data.deviceId || 'unknown';
  const timestamp = new Date().toISOString();

  // Step 1: Delete from active tasks sheet
  const tasksSheet = getOrCreateSheet(TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const rowIndex = findTaskRow(tasksSheet, task.id);
  if (rowIndex !== -1) {
    tasksSheet.deleteRow(rowIndex);
    console.log('Deleted task from active tasks:', task.text);
  }

  // Step 2: Add to completed tasks sheet
  const completedSheet = getOrCreateSheet(COMPLETED_TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const existingCompletedRow = findCompletedTaskRow(completedSheet, task.id);
  if (existingCompletedRow === -1) {
    const nextRow = completedSheet.getLastRow() + 1;
    completedSheet.getRange(nextRow, 1, 1, 9).setValues([[
      task.id,
      task.text,
      true,
      task.version || 1,
      task.createdAt,
      task.completedAt || timestamp,
      timestamp,
      deviceId,
      'synced'
    ]]);
    console.log('Added to completed tasks:', task.text);
  }

  // Step 3: Add work session if provided
  if (workSession) {
    const sessionsSheet = getOrCreateSheet(WORK_SESSIONS_SHEET_NAME, [
      'ID', 'Task ID', 'Task Text', 'Duration (min)', 'Completed At', 'Device ID', 'Sync Status'
    ]);

    const existingSessionRow = findWorkSessionRow(sessionsSheet, workSession.id);
    if (existingSessionRow === -1) {
      const nextRow = sessionsSheet.getLastRow() + 1;
      sessionsSheet.getRange(nextRow, 1, 1, 7).setValues([[
        workSession.id,
        workSession.taskId || '',
        workSession.taskText || task.text,
        Math.round(workSession.duration / 60),
        workSession.completedAt || timestamp,
        deviceId,
        'synced'
      ]]);
      console.log('Added work session:', workSession.id);
    }
  }

  return {
    success: true,
    message: 'Task completed atomically',
    taskId: task.id,
    taskText: task.text
  };
}

function findTaskRow(sheet, taskId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const ids = idRange.getValues().flat();

  const index = ids.findIndex(id => id == taskId);
  return index === -1 ? -1 : index + 2; // +2 because array is 0-indexed and we start from row 2
}

// Handle GET requests with data for JSONP (fallback method)
function handleJSONPData(e) {
  try {
    const action = e.parameter.action || 'log_activity';

    switch (action) {
      case 'log_activity':
        return handleJSONPActivity(e);
      case 'get_tasks':
        return handleJSONPGetTasks(e);
      case 'sync_tasks':
        return handleJSONPSyncTasks(e);
      default:
        return { success: false, error: 'JSONP action not supported: ' + action };
    }
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

function handleJSONPActivity(e) {
  const data = {
    date: e.parameter.date,
    type: e.parameter.type,
    description: e.parameter.description,
    duration: e.parameter.duration,
    completedTime: e.parameter.completedTime
  };

  return logActivity(data);
}

function handleJSONPGetTasks(e) {
  const data = {
    deviceId: e.parameter.deviceId || 'unknown'
  };

  return getTasks(data);
}

function handleJSONPSyncTasks(e) {
  // For JSONP, we can only send one task at a time due to URL length limits
  const task = {
    id: e.parameter.taskId,
    text: e.parameter.taskText,
    completed: e.parameter.taskCompleted === 'true',
    createdAt: e.parameter.taskCreatedAt,
    lastModified: e.parameter.taskLastModified,
    deviceId: e.parameter.taskDeviceId
  };

  const data = {
    tasks: [task],
    deviceId: e.parameter.deviceId || 'unknown'
  };

  return syncTasks(data);
}

function doGet(e) {
  // Check if this is a data submission via GET (JSONP fallback)
  if (e.parameter.action || (e.parameter.date && e.parameter.type && e.parameter.description)) {
    const result = handleJSONPData(e);
    const callback = e.parameter.callback;

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
        .setHeaders(CORS_HEADERS);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(CORS_HEADERS);
    }
  }

  // Handle JSONP callback for status check
  const callback = e.parameter.callback;

  const response = {
    status: 'Pomodoro Google Apps Script with Full Sync is running',
    timestamp: new Date().toISOString(),
    supportedActions: ['log_activity', 'sync_tasks', 'get_tasks', 'update_task', 'delete_task', 'complete_task', 'sync_completed_tasks', 'get_completed_tasks', 'sync_work_sessions', 'get_work_sessions', 'sync_archived_tasks', 'get_archived_tasks'],
    jsonpActions: ['log_activity', 'get_tasks', 'sync_tasks'],
    version: '3.0.0-with-archived-sync',
    schemaVersion: TASK_SCHEMA_VERSION
  };

  if (callback) {
    // JSONP response
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT)
      .setHeaders(CORS_HEADERS);
  } else {
    // Regular JSON response
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(CORS_HEADERS);
  }
}

// Completed Tasks synchronization functions
function syncCompletedTasks(data) {
  console.log('syncCompletedTasks called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(COMPLETED_TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const tasks = data.completedTasks || [];
  const deviceId = data.deviceId || 'unknown';
  const timestamp = new Date().toISOString();

  console.log('Processing', tasks.length, 'completed tasks for device:', deviceId);

  let syncedCount = 0;

  for (const task of tasks) {
    // Check if task already exists
    const existingRowIndex = findCompletedTaskRow(sheet, task.id);

    if (existingRowIndex === -1) {
      // New completed task - add it
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 9).setValues([[
        task.id,
        task.text,
        task.completed || true,
        task.version || 1,
        task.createdAt,
        task.completedAt || timestamp,
        timestamp,
        deviceId,
        'synced'
      ]]);
      syncedCount++;
      console.log('Added completed task to sheet:', task.text);
    } else {
      console.log('Completed task already exists:', task.text);
    }
  }

  return {
    success: true,
    message: `Synced ${syncedCount} completed tasks`,
    syncedCount
  };
}

function getCompletedTasks(data) {
  console.log('getCompletedTasks called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(COMPLETED_TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Last Modified', 'Device ID', 'Sync Status'
  ]);

  const filterDate = data.date; // Optional: filter by date (format: "YYYY-MM-DD" in UTC)
  const lastRow = sheet.getLastRow();

  console.log('Completed tasks sheet last row:', lastRow);

  if (lastRow <= 1) {
    console.log('No completed tasks found in sheet');
    return { success: true, completedTasks: [] };
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 9);
  const values = dataRange.getValues();

  let tasks = values
    .filter(row => row[0]) // Filter out empty rows
    .map(row => ({
      id: row[0],
      text: row[1],
      completed: row[2],
      version: row[3] || 1,
      createdAt: row[4],
      completedAt: row[5],
      lastModified: row[6],
      deviceId: row[7],
      syncStatus: row[8]
    }));

  // Filter by date if provided (using UTC format YYYY-MM-DD for consistency)
  if (filterDate) {
    tasks = tasks.filter(task => {
      const taskDate = new Date(task.completedAt);
      const taskDateUTC = `${taskDate.getUTCFullYear()}-${String(taskDate.getUTCMonth() + 1).padStart(2, '0')}-${String(taskDate.getUTCDate()).padStart(2, '0')}`;
      return taskDateUTC === filterDate;
    });
    console.log(`Filtered to ${tasks.length} tasks for date: ${filterDate}`);
  }

  return {
    success: true,
    completedTasks: tasks,
    count: tasks.length
  };
}

function findCompletedTaskRow(sheet, taskId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const ids = idRange.getValues().flat();

  const index = ids.findIndex(id => id == taskId);
  return index === -1 ? -1 : index + 2;
}

// Work Sessions synchronization functions
function syncWorkSessions(data) {
  console.log('syncWorkSessions called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(WORK_SESSIONS_SHEET_NAME, [
    'ID', 'Task ID', 'Task Text', 'Duration (min)', 'Completed At', 'Device ID', 'Sync Status'
  ]);

  const sessions = data.workSessions || [];
  const deviceId = data.deviceId || 'unknown';
  const timestamp = new Date().toISOString();

  console.log('Processing', sessions.length, 'work sessions for device:', deviceId);

  let syncedCount = 0;

  for (const session of sessions) {
    // Check if session already exists
    const existingRowIndex = findWorkSessionRow(sheet, session.id);

    if (existingRowIndex === -1) {
      // New work session - add it
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 7).setValues([[
        session.id,
        session.taskId || '',
        session.taskText || 'Unknown task',
        Math.round(session.duration / 60), // Convert seconds to minutes
        session.completedAt || timestamp,
        deviceId,
        'synced'
      ]]);
      syncedCount++;
      console.log('Added work session to sheet:', session.taskText);
    } else {
      console.log('Work session already exists:', session.id);
    }
  }

  return {
    success: true,
    message: `Synced ${syncedCount} work sessions`,
    syncedCount
  };
}

function getWorkSessions(data) {
  console.log('getWorkSessions called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(WORK_SESSIONS_SHEET_NAME, [
    'ID', 'Task ID', 'Task Text', 'Duration (min)', 'Completed At', 'Device ID', 'Sync Status'
  ]);

  const filterDate = data.date; // Optional: filter by date (format: "YYYY-MM-DD" in UTC)
  const lastRow = sheet.getLastRow();

  console.log('Work sessions sheet last row:', lastRow);

  if (lastRow <= 1) {
    console.log('No work sessions found in sheet');
    return { success: true, workSessions: [] };
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = dataRange.getValues();

  let sessions = values
    .filter(row => row[0]) // Filter out empty rows
    .map(row => ({
      id: row[0],
      taskId: row[1],
      taskText: row[2],
      duration: row[3] * 60, // Convert minutes back to seconds
      completedAt: row[4],
      deviceId: row[5],
      syncStatus: row[6]
    }));

  // Filter by date if provided (using UTC format YYYY-MM-DD for consistency)
  if (filterDate) {
    sessions = sessions.filter(session => {
      const sessionDate = new Date(session.completedAt);
      const sessionDateUTC = `${sessionDate.getUTCFullYear()}-${String(sessionDate.getUTCMonth() + 1).padStart(2, '0')}-${String(sessionDate.getUTCDate()).padStart(2, '0')}`;
      return sessionDateUTC === filterDate;
    });
    console.log(`Filtered to ${sessions.length} sessions for date: ${filterDate}`);
  }

  return {
    success: true,
    workSessions: sessions,
    count: sessions.length
  };
}

function findWorkSessionRow(sheet, sessionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const ids = idRange.getValues().flat();

  const index = ids.findIndex(id => id == sessionId);
  return index === -1 ? -1 : index + 2;
}

// Archived Tasks synchronization functions
function syncArchivedTasks(data) {
  console.log('syncArchivedTasks called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(ARCHIVED_TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Archived At', 'Device ID', 'Sync Status'
  ]);

  const tasks = data.archivedTasks || [];
  const deviceId = data.deviceId || 'unknown';
  const timestamp = new Date().toISOString();

  console.log('Processing', tasks.length, 'archived tasks for device:', deviceId);

  let syncedCount = 0;

  for (const task of tasks) {
    // Check if task already exists
    const existingRowIndex = findArchivedTaskRow(sheet, task.id);

    if (existingRowIndex === -1) {
      // New archived task - add it
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 9).setValues([[
        task.id,
        task.text,
        task.completed || false,
        task.version || 1,
        task.createdAt,
        task.completedAt || '',
        task.archivedAt || timestamp,
        deviceId,
        'synced'
      ]]);
      syncedCount++;
      console.log('Added archived task to sheet:', task.text);
    } else {
      console.log('Archived task already exists:', task.text);
    }
  }

  return {
    success: true,
    message: `Synced ${syncedCount} archived tasks`,
    syncedCount
  };
}

function getArchivedTasks(data) {
  console.log('getArchivedTasks called with data:', JSON.stringify(data));

  const sheet = getOrCreateSheet(ARCHIVED_TASKS_SHEET_NAME, [
    'ID', 'Text', 'Completed', 'Version', 'Created At', 'Completed At', 'Archived At', 'Device ID', 'Sync Status'
  ]);

  const lastRow = sheet.getLastRow();

  console.log('Archived tasks sheet last row:', lastRow);

  if (lastRow <= 1) {
    console.log('No archived tasks found in sheet');
    return { success: true, archivedTasks: [] };
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 9);
  const values = dataRange.getValues();

  const tasks = values
    .filter(row => row[0]) // Filter out empty rows
    .map(row => ({
      id: row[0],
      text: row[1],
      completed: row[2],
      version: row[3] || 1,
      createdAt: row[4],
      completedAt: row[5],
      archivedAt: row[6],
      deviceId: row[7],
      syncStatus: row[8]
    }));

  return {
    success: true,
    archivedTasks: tasks,
    count: tasks.length
  };
}

function findArchivedTaskRow(sheet, taskId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const ids = idRange.getValues().flat();

  const index = ids.findIndex(id => id == taskId);
  return index === -1 ? -1 : index + 2;
}

// Get version information
function getVersion() {
  return {
    success: true,
    version: TASK_SCHEMA_VERSION,
    versionName: '3.0.0-stats-sync',
    features: [
      'UUID-based task IDs',
      'Version-based conflict resolution',
      'Cross-device stats sync',
      'Completed tasks sync',
      'Work sessions sync',
      'Archived tasks sync'
    ]
  };
}