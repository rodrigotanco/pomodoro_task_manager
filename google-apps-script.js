// Google Apps Script code for automatic Pomodoro data sync
// Instructions:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Delete existing code and paste this entire file
// 4. Save the project (name it "Pomodoro Sync")
// 5. Deploy as web app (Execute as: Me, Access: Anyone)
// 6. Copy the web app URL and use it in the Pomodoro timer settings

function doPost(e) {
  try {
    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);

    // Check if headers exist, if not add them
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
      sheet.getRange(1, 1, 1, 5).setValues([
        ['Date', 'Type', 'Description', 'Duration (min)', 'Completed Time']
      ]);

      // Format the header row
      const headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }

    // Find the next empty row
    const nextRow = sheet.getLastRow() + 1;

    // Add the data
    sheet.getRange(nextRow, 1, 1, 5).setValues([[
      data.date,
      data.type,
      data.description,
      data.duration,
      data.completedTime
    ]]);

    // Auto-resize columns for better display
    sheet.autoResizeColumns(1, 5);

    // Handle JSONP callback if present
    const callback = e.parameter ? e.parameter.callback : null;
    const response = {
      success: true,
      message: 'Data added successfully',
      row: nextRow
    };

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    // Handle JSONP callback for errors too
    const callback = e.parameter ? e.parameter.callback : null;
    const errorResponse = {
      success: false,
      error: error.toString()
    };

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// Handle GET requests with data for JSONP (fallback method)
function handleJSONPData(e) {
  try {
    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Extract data from URL parameters
    const data = {
      date: e.parameter.date,
      type: e.parameter.type,
      description: e.parameter.description,
      duration: e.parameter.duration,
      completedTime: e.parameter.completedTime
    };

    // Check if headers exist, if not add them
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
      sheet.getRange(1, 1, 1, 5).setValues([
        ['Date', 'Type', 'Description', 'Duration (min)', 'Completed Time']
      ]);

      // Format the header row
      const headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }

    // Find the next empty row
    const nextRow = sheet.getLastRow() + 1;

    // Add the data
    sheet.getRange(nextRow, 1, 1, 5).setValues([[
      data.date,
      data.type,
      data.description,
      data.duration,
      data.completedTime
    ]]);

    // Auto-resize columns for better display
    sheet.autoResizeColumns(1, 5);

    return {
      success: true,
      message: 'Data added successfully via JSONP',
      row: nextRow
    };

  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

function doGet(e) {
  // Check if this is a data submission via GET (JSONP fallback)
  if (e.parameter.date && e.parameter.type && e.parameter.description) {
    const result = handleJSONPData(e);
    const callback = e.parameter.callback;

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Handle JSONP callback for status check
  const callback = e.parameter.callback;

  const response = {
    status: 'Pomodoro Google Apps Script is running',
    timestamp: new Date().toISOString()
  };

  if (callback) {
    // JSONP response
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // Regular JSON response
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }
}