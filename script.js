// Utility function: Generate UUID v4 for unique task IDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Get today's date in UTC format (YYYY-MM-DD) for consistent cross-timezone comparisons
function getTodayUTC() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get date in UTC format (YYYY-MM-DD) from ISO timestamp
function getDateUTC(isoString) {
    const date = new Date(isoString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// SyncQueue class: Manages sync operations with debouncing to prevent race conditions
class SyncQueue {
    constructor(processor, debounceMs = 500, storageKey = 'pomodoroSyncQueue') {
        this.queue = [];
        this.isProcessing = false;
        this.debounceTimer = null;
        this.processor = processor; // Function that processes queued operations
        this.debounceMs = debounceMs;
        this.storageKey = storageKey;

        // Load persisted queue from localStorage
        this.loadQueue();
    }

    loadQueue() {
        try {
            const savedQueue = localStorage.getItem(this.storageKey);
            if (savedQueue) {
                this.queue = JSON.parse(savedQueue);
                console.log(`SyncQueue: Loaded ${this.queue.length} persisted operations from localStorage`);

                // Process loaded queue if it has items
                if (this.queue.length > 0) {
                    this.scheduleProcessing();
                }
            }
        } catch (error) {
            console.error('SyncQueue: Error loading persisted queue:', error);
            this.queue = [];
        }
    }

    saveQueue() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
        } catch (error) {
            console.error('SyncQueue: Error persisting queue:', error);
        }
    }

    enqueue(operation) {
        console.log('SyncQueue: Enqueuing operation:', operation.type, operation.data?.id || operation.data?.taskId);
        this.queue.push(operation);
        this.saveQueue(); // Persist to localStorage
        this.scheduleProcessing();
    }

    scheduleProcessing() {
        // Clear existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Schedule processing after debounce period
        this.debounceTimer = setTimeout(() => {
            this.processQueue();
        }, this.debounceMs);
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`SyncQueue: Processing ${this.queue.length} queued operations...`);

        // Get all queued operations and clear the queue
        const operations = [...this.queue];
        this.queue = [];
        this.saveQueue(); // Persist cleared queue

        try {
            // Process batch of operations
            await this.processor(operations);
            console.log('SyncQueue: Batch processing completed successfully');
        } catch (error) {
            console.error('SyncQueue: Error processing batch:', error);
        } finally {
            this.isProcessing = false;

            // Process any new operations that arrived during processing
            if (this.queue.length > 0) {
                this.scheduleProcessing();
            }
        }
    }

    clear() {
        this.queue = [];
        this.saveQueue(); // Persist cleared queue
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    // Flush queue immediately (for before unload)
    async flush() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        if (this.queue.length > 0) {
            console.log(`🔄 Flushing ${this.queue.length} pending sync operations before page unload`);
            await this.processQueue();
        }
    }
}

class PomodoroTimer {
    // Constants
    static AUTO_SAVE_INTERVAL = 30000;      // 30 seconds
    static SYNC_INTERVAL = 60000;           // 60 seconds (1 minute)
    static INITIAL_SYNC_DELAY = 2000;       // 2 seconds
    static JSONP_TIMEOUT = 10000;           // 10 seconds
    static DATA_RETENTION_DAYS = 30;        // Keep last 30 days
    static MIN_TASK_TIME = 30;              // 30 seconds minimum for task completion
    static MAX_DELETED_TASK_IDS = 100;      // Max deleted task IDs to track
    static MAX_ACTIVITY_LOG_ITEMS = 20;     // Max activity log items
    static DATE_CHECK_INTERVAL = 300000;    // 5 minutes
    static DELETED_TASK_RETENTION_DAYS = 90; // Keep deleted task IDs for 90 days

    constructor() {
        this.workDuration = 25 * 60; // 25 minutes in seconds
        this.breakDuration = 5 * 60; // 5 minutes in seconds
        this.longBreakDuration = 15 * 60; // 15 minutes in seconds
        this.longBreakInterval = 4; // Long break after 4 pomodoros (0 to disable)
        this.consecutiveWorkSessions = 0; // Track consecutive work sessions
        this.completedPomodoros = 0; // Track completed pomodoros in current cycle
        this.isLongBreak = false; // Track if current break is a long break
        this.currentDuration = this.workDuration;
        this.timeLeft = this.currentDuration;
        this.isRunning = false;
        this.isWorkSession = true;
        this.sessionCount = 0;
        this.timer = null;
        this.tasks = [];
        this.selectedTaskId = null;
        this.completedTasks = [];
        this.workSessions = [];
        this.userEmail = '';
        this.notificationsEnabled = true;
        this.soundSettings = {
            'short-break': { file: null, volume: 100, duration: 5, fileName: 'Default alarm' },
            'long-break': { file: null, volume: 100, duration: 5, fileName: 'Default alarm' },
            'work-start': { file: null, volume: 100, duration: 5, fileName: 'Default alarm' },
            'task-complete': { file: null, volume: 100, duration: 5, fileName: 'Default alarm' },
            'daily-reset': { file: null, volume: 100, duration: 5, fileName: 'Default alarm' }
        };

        // Sleep-resistant timer properties
        this.startTime = null;
        this.wakeLock = null;
        this.worker = null;

        // Device identification and sync management
        this.deviceId = this.generateDeviceId();
        this.lastSyncTime = null;
        // Granular sync locks to prevent one sync from blocking others
        this.syncLocks = {
            tasks: false,
            stats: false,
            archived: false,
            full: false
        };
        this.syncTimer = null;
        this.deletedTaskIds = new Map(); // Track recently deleted/completed task IDs with timestamps

        // Bulk selection state
        this.bulkSelectionMode = false;
        this.selectedTaskIds = new Set();
        this.archivedTasks = [];

        // Date change detection
        this.currentDate = new Date().toDateString();
        this.midnightResetTimer = null;
        this.dateCheckInterval = null;

        // Timers and intervals for cleanup
        this.autoSaveInterval = null;
        this.dailyReportTimer = null;
        this.workerBlobURL = null;

        // Initialize sync queue for batching operations
        this.syncQueue = new SyncQueue(
            (operations) => this.processSyncBatch(operations),
            500 // 500ms debounce
        );

        this.initializeElements();
        this.loadData();
        this.requestNotificationPermission();
        this.bindEvents();
        this.updateDisplay();
        this.scheduleDailyReport();
        this.scheduleMidnightReset();
        this.startPeriodicSync();
        this.initializeSleepResistance();
    }

    initializeElements() {
        // Timer elements
        this.timeDisplay = document.getElementById('timeLeft');
        this.sessionTypeDisplay = document.getElementById('sessionType');
        this.pomodoroProgress = document.getElementById('pomodoroProgress');
        this.pomodoroText = document.getElementById('pomodoroText');
        this.progressBar = document.getElementById('progress');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.sessionCountDisplay = document.getElementById('sessionCount');
        this.currentTaskDisplay = document.getElementById('currentTaskName');

        // Timer action buttons
        this.completeTaskBtn = document.getElementById('completeTaskBtn');
        this.skipBreakBtn = document.getElementById('skipBreakBtn');
        this.timerActions = document.getElementById('timerActions');

        // Settings elements
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.workDurationInput = document.getElementById('workDuration');
        this.breakDurationInput = document.getElementById('breakDuration');
        this.longBreakDurationInput = document.getElementById('longBreakDuration');
        this.longBreakIntervalInput = document.getElementById('longBreakInterval');
        this.userEmailInput = document.getElementById('userEmail');
        this.enableNotificationsInput = document.getElementById('enableNotifications');
        this.googleSheetsWebhookInput = document.getElementById('googleSheetsWebhook');
        this.setupGoogleSheetsBtn = document.getElementById('setupGoogleSheets');
        this.setupModal = document.getElementById('setupModal');
        this.closeModalBtn = document.getElementById('closeModal');
        this.copyScriptBtn = document.getElementById('copyScriptBtn');
        // this.testConnectionBtn = document.getElementById('testConnection'); // Commented out
        this.saveSettingsBtn = document.getElementById('saveSettings');

        // Task elements
        this.taskInput = document.getElementById('taskInput');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.tasksList = document.getElementById('tasksList');

        // Stats elements
        this.todayTasksDisplay = document.getElementById('todayTasks');
        this.todaySessionsDisplay = document.getElementById('todaySessions');
        this.todayTimeDisplay = document.getElementById('todayTime');
        this.sendReportBtn = document.getElementById('sendReportBtn');
        this.syncNowBtn = document.getElementById('syncNowBtn');
        this.activityList = document.getElementById('activityList');

        // Sync status elements
        this.syncStatusIndicator = document.getElementById('syncStatusIndicator');
        this.syncStatusIcon = document.getElementById('syncStatusIcon');
        this.syncStatusText = document.getElementById('syncStatusText');
        this.syncLastTime = document.getElementById('syncLastTime');
        this.statsSyncText = document.getElementById('statsSyncText');
        this.statsSyncLastTime = document.getElementById('statsSyncLastTime');

        // Bulk selection elements
        this.bulkSelectToggle = document.getElementById('bulkSelectToggle');
        this.bulkActionsBar = document.getElementById('bulkActionsBar');
        this.selectAllTasks = document.getElementById('selectAllTasks');
        this.selectedCount = document.getElementById('selectedCount');
        this.bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        this.bulkArchiveBtn = document.getElementById('bulkArchiveBtn');
        this.cancelSelectionBtn = document.getElementById('cancelSelectionBtn');

        // Audio element
        this.alarmSound = document.getElementById('alarmSound');

        // Sound settings elements - All 5 sound types
        this.shortBreakSoundInput = document.getElementById('shortBreakSound');
        this.shortBreakSoundName = document.getElementById('shortBreakSoundName');
        this.shortBreakVolumeInput = document.getElementById('shortBreakVolume');
        this.shortBreakDurationInput = document.getElementById('shortBreakDuration');

        this.longBreakSoundInput = document.getElementById('longBreakSound');
        this.longBreakSoundName = document.getElementById('longBreakSoundName');
        this.longBreakVolumeInput = document.getElementById('longBreakVolume');
        this.longBreakDurationInput = document.getElementById('longBreakDuration');

        this.workStartSoundInput = document.getElementById('workStartSound');
        this.workStartSoundName = document.getElementById('workStartSoundName');
        this.workStartVolumeInput = document.getElementById('workStartVolume');
        this.workStartDurationInput = document.getElementById('workStartDuration');

        this.taskCompleteSoundInput = document.getElementById('taskCompleteSound');
        this.taskCompleteSoundName = document.getElementById('taskCompleteSoundName');
        this.taskCompleteVolumeInput = document.getElementById('taskCompleteVolume');
        this.taskCompleteDurationInput = document.getElementById('taskCompleteDuration');

        this.dailyResetSoundInput = document.getElementById('dailyResetSound');
        this.dailyResetSoundName = document.getElementById('dailyResetSoundName');
        this.dailyResetVolumeInput = document.getElementById('dailyResetVolume');
        this.dailyResetDurationInput = document.getElementById('dailyResetDuration');

        // Pomodoro progress indicator
        this.pomodoroProgress = document.getElementById('pomodoroProgress');
    }

    bindEvents() {
        // Timer controls
        this.startBtn.addEventListener('click', () => this.startTimer());
        this.pauseBtn.addEventListener('click', () => this.pauseTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());

        // Timer actions
        this.completeTaskBtn.addEventListener('click', () => this.completeCurrentTask());
        this.skipBreakBtn.addEventListener('click', () => this.skipBreak());

        // Settings
        this.settingsBtn.addEventListener('click', () => this.toggleSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // Tasks
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Reports and sync
        this.sendReportBtn.addEventListener('click', () => this.sendReport());
        this.syncNowBtn.addEventListener('click', () => this.handleSyncButtonClick());

        // Bulk selection events
        this.bulkSelectToggle.addEventListener('click', () => this.toggleBulkSelection());
        this.selectAllTasks.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
        this.bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteTasks());
        this.bulkArchiveBtn.addEventListener('click', () => this.bulkArchiveTasks());
        this.cancelSelectionBtn.addEventListener('click', () => this.cancelBulkSelection());

        // Google Sheets setup
        this.setupGoogleSheetsBtn.addEventListener('click', () => this.showSetupModal());

        // Sound settings UI
        this.initSoundUI();

        // Add event listeners after ensuring elements exist
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => {
                this.hideSetupModal();
            });
        }

        if (this.copyScriptBtn) {
            this.copyScriptBtn.addEventListener('click', () => this.copyAppsScript());
        }

        // Close modal when clicking outside
        if (this.setupModal) {
            this.setupModal.addEventListener('click', (e) => {
                if (e.target === this.setupModal) {
                    this.hideSetupModal();
                }
            });
        }

        // Add ESC key listener to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.setupModal.classList.contains('hidden')) {
                this.hideSetupModal();
            }
        });
        // this.testConnectionBtn.addEventListener('click', () => this.testConnection()); // Commented out

        // Sound settings event listeners
        this.setupSoundEventListeners();

        // Auto-save data periodically
        this.autoSaveInterval = setInterval(() => this.saveData(), PomodoroTimer.AUTO_SAVE_INTERVAL);

        // Flush sync queue before page unload to prevent data loss
        window.addEventListener('beforeunload', async (e) => {
            console.log('🔄 Page unload detected, flushing sync queue...');
            // Flush the queue synchronously
            if (this.syncQueue && this.syncQueue.queue.length > 0) {
                // Note: Modern browsers limit what can be done in beforeunload
                // but we'll try to flush critical data
                await this.syncQueue.flush();
            }
        });
    }

    setupSoundEventListeners() {
        // Get all volume sliders and set up real-time display updates
        const volumeSliders = document.querySelectorAll('.volume-slider');
        volumeSliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const volumeDisplay = e.target.nextElementSibling;
                if (volumeDisplay && volumeDisplay.classList.contains('volume-value')) {
                    volumeDisplay.textContent = `${e.target.value}%`;
                }
            });
        });

        // Set up file input handlers for all 5 sound types
        if (this.shortBreakSoundInput) {
            this.shortBreakSoundInput.addEventListener('change', (e) => this.handleSoundFileUpload(e, 'short-break'));
        }
        if (this.longBreakSoundInput) {
            this.longBreakSoundInput.addEventListener('change', (e) => this.handleSoundFileUpload(e, 'long-break'));
        }
        if (this.workStartSoundInput) {
            this.workStartSoundInput.addEventListener('change', (e) => this.handleSoundFileUpload(e, 'work-start'));
        }
        if (this.taskCompleteSoundInput) {
            this.taskCompleteSoundInput.addEventListener('change', (e) => this.handleSoundFileUpload(e, 'task-complete'));
        }
        if (this.dailyResetSoundInput) {
            this.dailyResetSoundInput.addEventListener('change', (e) => this.handleSoundFileUpload(e, 'daily-reset'));
        }
    }

    handleSoundFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file size (< 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (file.size > maxSize) {
            showToast('File size must be less than 5MB', 'error');
            event.target.value = ''; // Clear the input
            return;
        }

        // Validate file type
        if (!file.type.startsWith('audio/')) {
            showToast('Please select an audio file', 'error');
            event.target.value = ''; // Clear the input
            return;
        }

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
            this.soundSettings[type].file = e.target.result;
            this.soundSettings[type].fileName = file.name;

            // Update filename display based on sound type
            const nameDisplayMap = {
                'short-break': this.shortBreakSoundName,
                'long-break': this.longBreakSoundName,
                'work-start': this.workStartSoundName,
                'task-complete': this.taskCompleteSoundName,
                'daily-reset': this.dailyResetSoundName
            };

            const nameDisplay = nameDisplayMap[type];
            if (nameDisplay) {
                nameDisplay.textContent = file.name;
            }

            showToast(`Sound file uploaded: ${file.name}`, 'success');
            this.saveData();
        };
        reader.onerror = () => {
            showToast('Failed to read audio file', 'error');
            event.target.value = ''; // Clear the input
        };
        reader.readAsDataURL(file);
    }

    async initializeSleepResistance() {
        // Initialize wake lock API if available
        if ('wakeLock' in navigator) {
            console.log('Wake Lock API is supported');
        } else {
            console.log('Wake Lock API is not supported');
        }

        // Initialize Web Worker for background timing
        this.initializeWorker();

        // Listen for visibility changes to detect when app becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isRunning) {
                this.correctTimerAfterWakeup();
            }
        });

        // Listen for page focus/blur events
        window.addEventListener('focus', () => {
            if (this.isRunning) {
                this.correctTimerAfterWakeup();
            }
        });
    }

    initializeWorker() {
        // Create a Web Worker for more reliable background timing
        const workerCode = `
            let timerInterval = null;
            let startTime = null;
            let duration = 0;

            self.addEventListener('message', function(e) {
                const { action, data } = e.data;

                if (action === 'start') {
                    startTime = Date.now();
                    duration = data.duration * 1000; // Convert to milliseconds

                    timerInterval = setInterval(() => {
                        const elapsed = Date.now() - startTime;
                        const remaining = Math.max(0, duration - elapsed);

                        self.postMessage({
                            type: 'tick',
                            timeLeft: Math.ceil(remaining / 1000),
                            elapsed: Math.floor(elapsed / 1000)
                        });

                        if (remaining <= 0) {
                            clearInterval(timerInterval);
                            self.postMessage({ type: 'complete' });
                        }
                    }, 1000);

                } else if (action === 'stop') {
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                } else if (action === 'getStatus') {
                    if (startTime) {
                        const elapsed = Date.now() - startTime;
                        const remaining = Math.max(0, duration - elapsed);
                        self.postMessage({
                            type: 'status',
                            timeLeft: Math.ceil(remaining / 1000),
                            elapsed: Math.floor(elapsed / 1000)
                        });
                    }
                }
            });
        `;

        try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.workerBlobURL = URL.createObjectURL(blob);
            this.worker = new Worker(this.workerBlobURL);

            this.worker.addEventListener('message', (e) => {
                const { type, timeLeft, elapsed } = e.data;

                if (type === 'tick') {
                    this.timeLeft = timeLeft;
                    this.updateDisplay();
                } else if (type === 'complete') {
                    this.completeSession();
                } else if (type === 'status') {
                    // Update timer with corrected time after wake-up
                    this.timeLeft = timeLeft;
                    this.updateDisplay();
                }
            });

            console.log('Web Worker initialized for background timing');
        } catch (error) {
            console.error('Failed to create Web Worker:', error);
        }
    }

    async requestWakeLock() {
        if ('wakeLock' in navigator && this.isRunning) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock acquired');

                this.wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                });
            } catch (error) {
                console.error('Failed to acquire wake lock:', error);
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            try {
                this.wakeLock.release();
                this.wakeLock = null;
                console.log('Wake lock released manually');
            } catch (error) {
                console.error('Failed to release wake lock:', error);
                this.wakeLock = null;
            }
        }
    }

    correctTimerAfterWakeup() {
        if (!this.isRunning || !this.startTime) return;

        // Calculate how much time should have passed
        const now = Date.now();
        const elapsedMs = now - this.startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        // Calculate what the time left should be
        const correctTimeLeft = Math.max(0, this.currentDuration - elapsedSeconds);

        // If there's a significant difference, correct it
        const timeDifference = Math.abs(this.timeLeft - correctTimeLeft);

        if (timeDifference > 2) { // More than 2 seconds difference
            console.log(`Timer correction: was ${this.timeLeft}s, should be ${correctTimeLeft}s`);
            this.timeLeft = correctTimeLeft;

            // Ask worker for status to sync
            if (this.worker) {
                this.worker.postMessage({ action: 'getStatus' });
            }

            this.updateDisplay();

            // Check if session should be complete
            if (this.timeLeft <= 0) {
                this.completeSession();
            }
        }
    }

    generateDeviceId() {
        let deviceId = localStorage.getItem('pomodoroDeviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('pomodoroDeviceId', deviceId);
        }
        return deviceId;
    }

    isTaskCompleted(taskId) {
        // Check if task is in completed tasks array
        const isInCompletedTasks = this.completedTasks.some(task => task.id == taskId);

        // Check if task is in recently deleted IDs Map
        const isRecentlyDeleted = this.deletedTaskIds.has(taskId);

        return isInCompletedTasks || isRecentlyDeleted;
    }

    addToDeletedTasks(taskId) {
        // Store task ID with current timestamp
        this.deletedTaskIds.set(taskId, Date.now());

        // Clean up old deleted task IDs
        this.cleanupDeletedTasks();

        // Save to localStorage for persistence
        this.saveDeletedTaskIds();
    }

    cleanupDeletedTasks() {
        // Remove deleted task IDs older than DELETED_TASK_RETENTION_DAYS
        const cutoffTime = Date.now() - (PomodoroTimer.DELETED_TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000);

        for (const [taskId, timestamp] of this.deletedTaskIds.entries()) {
            if (timestamp < cutoffTime) {
                this.deletedTaskIds.delete(taskId);
                console.log('Removed old deleted task ID from tracking:', taskId);
            }
        }
    }

    saveDeletedTaskIds() {
        // Convert Map to array of [id, timestamp] pairs for storage
        const deletedIdsArray = Array.from(this.deletedTaskIds.entries());
        localStorage.setItem('pomodoroDeletedTaskIds', JSON.stringify(deletedIdsArray));
    }

    loadDeletedTaskIds() {
        const savedDeletedIds = localStorage.getItem('pomodoroDeletedTaskIds');
        if (savedDeletedIds) {
            try {
                const deletedIdsArray = JSON.parse(savedDeletedIds);

                // Handle both old format (array of IDs) and new format (array of [id, timestamp] pairs)
                if (deletedIdsArray.length > 0) {
                    if (Array.isArray(deletedIdsArray[0])) {
                        // New format: array of [id, timestamp] pairs
                        this.deletedTaskIds = new Map(deletedIdsArray);
                    } else {
                        // Old format: array of IDs - convert to Map with current timestamp
                        const now = Date.now();
                        this.deletedTaskIds = new Map(deletedIdsArray.map(id => [id, now]));
                        console.log('Migrated old deleted task IDs format to new format');
                    }
                }

                // Clean up old entries after loading
                this.cleanupDeletedTasks();
            } catch (error) {
                console.error('Error loading deleted task IDs:', error);
                this.deletedTaskIds = new Map();
            }
        }
    }

    cleanupOldData() {
        // Clean up data older than DATA_RETENTION_DAYS
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - PomodoroTimer.DATA_RETENTION_DAYS);
        const cutoffTime = cutoffDate.getTime();

        // Clean completed tasks
        const initialCompletedCount = this.completedTasks.length;
        this.completedTasks = this.completedTasks.filter(task => {
            const taskDate = new Date(task.completedAt);
            return taskDate.getTime() >= cutoffTime;
        });

        // Clean work sessions
        const initialSessionsCount = this.workSessions.length;
        this.workSessions = this.workSessions.filter(session => {
            const sessionDate = new Date(session.completedAt);
            return sessionDate.getTime() >= cutoffTime;
        });

        const removedTasks = initialCompletedCount - this.completedTasks.length;
        const removedSessions = initialSessionsCount - this.workSessions.length;

        if (removedTasks > 0 || removedSessions > 0) {
            console.log(`Data cleanup: Removed ${removedTasks} old tasks and ${removedSessions} old sessions`);
            this.saveData(); // Save after cleanup
        }
    }

    updateSoundUI(soundType, volumeInput, durationInput, nameDisplay) {
        const settings = this.soundSettings[soundType];
        if (!settings) return;

        if (volumeInput) {
            volumeInput.value = settings.volume;
            const volumeDisplay = volumeInput.nextElementSibling;
            if (volumeDisplay && volumeDisplay.classList.contains('volume-value')) {
                volumeDisplay.textContent = `${settings.volume}%`;
            }
        }

        if (durationInput) {
            durationInput.value = settings.duration;
        }

        if (nameDisplay) {
            nameDisplay.textContent = settings.fileName || (settings.file ? 'Custom sound' : 'Default alarm');
        }
    }

    loadData() {
        const savedData = localStorage.getItem('pomodoroData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.tasks = (data.tasks || []).map(task => ({
                ...task,
                version: task.version || 1,  // Add version for old tasks without it
                lastModified: task.lastModified || task.createdAt || new Date().toISOString(),
                deviceId: task.deviceId || this.deviceId
            }));
            this.completedTasks = data.completedTasks || [];
            this.workSessions = data.workSessions || [];
            this.archivedTasks = data.archivedTasks || [];
            this.sessionCount = data.sessionCount || 0;
            this.userEmail = data.userEmail || '';
            this.notificationsEnabled = data.notificationsEnabled !== undefined ? data.notificationsEnabled : true;
            this.googleSheetsWebhook = data.googleSheetsWebhook || '';
            this.workDuration = data.workDuration || 25 * 60;
            this.breakDuration = data.breakDuration || 5 * 60;
            this.longBreakDuration = data.longBreakDuration || 15 * 60;
            this.longBreakInterval = data.longBreakInterval !== undefined ? data.longBreakInterval : 4;
            this.consecutiveWorkSessions = data.consecutiveWorkSessions || 0;
            this.isLongBreak = data.isLongBreak || false;
            this.lastSyncTime = data.lastSyncTime || null;

            // Load sound settings - support both old and new formats
            if (data.soundSettings) {
                // Merge saved settings with defaults
                Object.keys(this.soundSettings).forEach(soundType => {
                    if (data.soundSettings[soundType]) {
                        this.soundSettings[soundType] = {
                            ...this.soundSettings[soundType],
                            ...data.soundSettings[soundType]
                        };
                    }
                });
            }

            // Update UI with loaded data
            this.workDurationInput.value = this.workDuration / 60;
            this.breakDurationInput.value = this.breakDuration / 60;
            this.longBreakDurationInput.value = this.longBreakDuration / 60;
            this.longBreakIntervalInput.value = this.longBreakInterval;
            this.userEmailInput.value = this.userEmail;
            this.enableNotificationsInput.checked = this.notificationsEnabled;
            this.googleSheetsWebhookInput.value = this.googleSheetsWebhook;

            // Update sound settings UI for all 5 sound types
            this.updateSoundUI('short-break', this.shortBreakVolumeInput, this.shortBreakDurationInput, this.shortBreakSoundName);
            this.updateSoundUI('long-break', this.longBreakVolumeInput, this.longBreakDurationInput, this.longBreakSoundName);
            this.updateSoundUI('work-start', this.workStartVolumeInput, this.workStartDurationInput, this.workStartSoundName);
            this.updateSoundUI('task-complete', this.taskCompleteVolumeInput, this.taskCompleteDurationInput, this.taskCompleteSoundName);
            this.updateSoundUI('daily-reset', this.dailyResetVolumeInput, this.dailyResetDurationInput, this.dailyResetSoundName);
        }

        // Load deleted task IDs
        this.loadDeletedTaskIds();

        // Clean up old data (30+ days)
        this.cleanupOldData();

        this.renderTasks();
        this.updateStats();
        this.updateActivityLog();
        this.updateSyncButton();
    }

    saveData() {
        const data = {
            tasks: this.tasks,
            completedTasks: this.completedTasks,
            workSessions: this.workSessions,
            archivedTasks: this.archivedTasks,
            sessionCount: this.sessionCount,
            userEmail: this.userEmail,
            notificationsEnabled: this.notificationsEnabled,
            googleSheetsWebhook: this.googleSheetsWebhook,
            workDuration: this.workDuration,
            breakDuration: this.breakDuration,
            longBreakDuration: this.longBreakDuration,
            longBreakInterval: this.longBreakInterval,
            consecutiveWorkSessions: this.consecutiveWorkSessions,
            completedPomodoros: this.completedPomodoros,
            isLongBreak: this.isLongBreak,
            soundSettings: this.soundSettings,
            lastSave: new Date().toISOString(),
            lastSyncTime: this.lastSyncTime,
            deviceId: this.deviceId
        };
        localStorage.setItem('pomodoroData', JSON.stringify(data));
    }

    toggleSettings() {
        this.settingsPanel.classList.toggle('hidden');
    }

    saveSettings() {
        this.workDuration = parseInt(this.workDurationInput.value) * 60;
        this.breakDuration = parseInt(this.breakDurationInput.value) * 60;
        this.longBreakDuration = parseInt(this.longBreakDurationInput.value) * 60;
        this.longBreakInterval = parseInt(this.longBreakIntervalInput.value);
        this.userEmail = this.userEmailInput.value;
        this.notificationsEnabled = this.enableNotificationsInput.checked;
        this.googleSheetsWebhook = this.googleSheetsWebhookInput.value;

        // Update current session if not running
        if (!this.isRunning) {
            if (this.isWorkSession) {
                this.currentDuration = this.workDuration;
            } else {
                this.currentDuration = this.isLongBreak ? this.longBreakDuration : this.breakDuration;
            }
            this.timeLeft = this.currentDuration;
            this.updateDisplay();
        }

        this.saveData();
        this.updateSyncButton();
        this.settingsPanel.classList.add('hidden');
        this.addActivity('⚙️ Settings updated');
        showToast('Settings saved successfully', 'success');
    }

    initSoundUI() {
        const soundTypes = [
            { type: 'short-break', idPrefix: 'shortBreak' },
            { type: 'long-break', idPrefix: 'longBreak' },
            { type: 'work-start', idPrefix: 'workStart' },
            { type: 'task-complete', idPrefix: 'taskComplete' },
            { type: 'daily-reset', idPrefix: 'dailyReset' }
        ];

        soundTypes.forEach(({ type, idPrefix }) => {
            const fileInput = document.getElementById(`${idPrefix}Sound`);
            const volumeSlider = document.getElementById(`${idPrefix}Volume`);
            const durationInput = document.getElementById(`${idPrefix}Duration`);
            const fileNameSpan = document.getElementById(`${idPrefix}SoundName`);
            const volumeValue = fileInput?.closest('.sound-setting-item')?.querySelector('.volume-value');
            const testBtn = document.querySelector(`.test-sound-btn[data-sound-type="${type}"]`);
            const resetBtn = document.querySelector(`.reset-sound-btn[data-sound-type="${type}"]`);

            // File upload handler
            if (fileInput) {
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        const volume = volumeSlider ? parseFloat(volumeSlider.value) / 100 : 1.0;
                        const duration = durationInput ? parseInt(durationInput.value) * 1000 : 5000;

                        await window.alertSoundManager.saveSound(type, file, volume, duration);

                        if (fileNameSpan) {
                            fileNameSpan.textContent = file.name;
                        }

                        showToast(`${type} sound uploaded successfully`, 'success');
                    } catch (error) {
                        console.error('Error saving sound:', error);
                        showToast(error.message || 'Error uploading sound file', 'error');
                        fileInput.value = ''; // Reset file input
                    }
                });
            }

            // Volume slider handler
            if (volumeSlider) {
                volumeSlider.addEventListener('input', (e) => {
                    const value = e.target.value;
                    if (volumeValue) {
                        volumeValue.textContent = `${value}%`;
                    }
                });

                volumeSlider.addEventListener('change', async (e) => {
                    const volume = parseFloat(e.target.value) / 100;
                    const duration = durationInput ? parseInt(durationInput.value) * 1000 : 5000;
                    const currentConfig = window.alertSoundManager.soundTypes[type];

                    if (currentConfig.file) {
                        // Re-save with new volume
                        const response = await fetch(currentConfig.file);
                        const blob = await response.blob();
                        const file = new File([blob], currentConfig.fileName || 'sound.mp3');
                        await window.alertSoundManager.saveSound(type, file, volume, duration);
                    }
                });
            }

            // Duration input handler
            if (durationInput) {
                durationInput.addEventListener('change', async (e) => {
                    const duration = parseInt(e.target.value) * 1000;
                    const volume = volumeSlider ? parseFloat(volumeSlider.value) / 100 : 1.0;
                    const currentConfig = window.alertSoundManager.soundTypes[type];

                    if (currentConfig.file) {
                        // Re-save with new duration
                        const response = await fetch(currentConfig.file);
                        const blob = await response.blob();
                        const file = new File([blob], currentConfig.fileName || 'sound.mp3');
                        await window.alertSoundManager.saveSound(type, file, volume, duration);
                    }
                });
            }

            // Test button handler
            if (testBtn) {
                testBtn.addEventListener('click', async () => {
                    const soundName = window.alertSoundManager.soundTypes[type]?.name || type;
                    showToast(`Testing ${soundName} sound...`, 'info');
                    await window.alertSoundManager.testSound(type);
                });
            }

            // Reset button handler
            if (resetBtn) {
                resetBtn.addEventListener('click', async () => {
                    try {
                        await window.alertSoundManager.resetToDefault(type);

                        // Get default values for this sound type
                        const defaultConfig = window.alertSoundManager.soundTypes[type];
                        const defaultVolume = Math.round((defaultConfig.volume || 1.0) * 100);
                        const defaultDuration = (defaultConfig.duration || 5000) / 1000;

                        // Reset UI - filename
                        if (fileNameSpan) {
                            fileNameSpan.textContent = 'Default alarm';
                        }

                        // Reset UI - file input
                        if (fileInput) {
                            fileInput.value = '';
                        }

                        // Reset UI - volume slider and display
                        if (volumeSlider) {
                            volumeSlider.value = defaultVolume;
                        }
                        if (volumeValue) {
                            volumeValue.textContent = `${defaultVolume}%`;
                        }

                        // Reset UI - duration input
                        if (durationInput) {
                            durationInput.value = defaultDuration;
                        }

                        const soundName = defaultConfig.name || type;
                        showToast(`${soundName} reset to default`, 'success');
                    } catch (error) {
                        console.error('Error resetting sound:', error);
                        showToast('Error resetting sound', 'error');
                    }
                });
            }
        });
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }

        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                } else {
                    console.log('Notification permission denied');
                }
            } catch (error) {
                console.log('Error requesting notification permission:', error);
            }
        }
    }

    showNotification(title, body, icon = '🍅') {
        if (!this.notificationsEnabled) {
            return;
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notification = new Notification(title, {
                    body: body,
                    icon: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
                    badge: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍅</text></svg>`,
                    requireInteraction: true,
                    tag: 'pomodoro-timer'
                });

                // Auto-close notification after 5 seconds
                setTimeout(() => {
                    notification.close();
                }, 5000);

                // Focus window when notification is clicked
                notification.addEventListener('click', () => {
                    window.focus();
                    notification.close();
                });
            } catch (error) {
                console.log('Error showing notification:', error);
            }
        }
    }

    playSound(soundType, customDuration = null) {
        // Use AlertSoundManager if available (preferred)
        if (window.alertSoundManager) {
            window.alertSoundManager.playSound(soundType);
            return;
        }

        // Fallback to legacy sound system
        const soundConfig = this.soundSettings[soundType];
        if (!soundConfig) {
            console.warn(`Sound type ${soundType} not found`);
            return;
        }

        // Create audio element
        const audio = new Audio();
        const duration = customDuration || soundConfig.duration * 1000; // Convert to ms
        const volume = soundConfig.volume / 100;

        // Use custom sound if available, otherwise use default alarm
        if (soundConfig.file) {
            audio.src = soundConfig.file;
        } else if (this.alarmSound) {
            audio.src = this.alarmSound.src;
        } else {
            console.warn('No audio source available');
            return;
        }

        audio.volume = volume;

        // Play the sound
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log(`Playing ${soundType} sound for ${duration}ms at ${volume * 100}% volume`);

                    // Stop after duration
                    setTimeout(() => {
                        audio.pause();
                        audio.currentTime = 0;
                    }, duration);
                })
                .catch(error => {
                    console.error('Error playing sound:', error);
                });
        }
    }

    startTimer() {
        // Prevent starting work session without a selected task
        if (this.isWorkSession && !this.selectedTaskId) {
            alert('Please select a task before starting a work session!');
            return;
        }

        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;

        // Record start time for sleep-resistant timing
        this.startTime = Date.now();

        // Request wake lock to prevent sleep
        this.requestWakeLock();

        // Start Web Worker timer for background operation
        if (this.worker) {
            this.worker.postMessage({
                action: 'start',
                data: { duration: this.timeLeft }
            });
        } else {
            // Fallback timer for browsers without Web Worker support
            this.timer = setInterval(() => {
                this.timeLeft--;
                this.updateDisplay();

                if (this.timeLeft <= 0) {
                    this.completeSession();
                }
            }, 1000);
        }

        if (this.isWorkSession && this.selectedTaskId) {
            const task = this.tasks.find(t => t.id === this.selectedTaskId);
            if (task) {
                this.addActivity(`🍅 Started work session: ${task.text}`);
            } else {
                console.warn('Selected task not found, clearing selection');
                this.selectedTaskId = null;
                this.pauseTimer();
                return;
            }
        } else {
            this.addActivity('☕ Started break');
        }

        // Update pomodoro progress indicator to show active state
        this.updatePomodoroProgress();
    }

    pauseTimer() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;

        // Clear both timers
        clearInterval(this.timer);

        // Stop Web Worker
        if (this.worker) {
            this.worker.postMessage({ action: 'stop' });
        }

        // Release wake lock
        this.releaseWakeLock();

        // Clear start time
        this.startTime = null;

        this.addActivity('⏸️ Timer paused');
    }

    resetTimer() {
        this.isRunning = false;
        this.startBtn.disabled = this.isWorkSession && !this.selectedTaskId;
        this.pauseBtn.disabled = true;

        // Clear both timers
        clearInterval(this.timer);

        // Stop Web Worker
        if (this.worker) {
            this.worker.postMessage({ action: 'stop' });
        }

        // Release wake lock
        this.releaseWakeLock();

        // Clear start time
        this.startTime = null;

        this.currentDuration = this.isWorkSession ? this.workDuration : this.breakDuration;
        this.timeLeft = this.currentDuration;
        this.updateDisplay();
        this.addActivity('🔄 Timer reset');
    }

    completeCurrentTask() {
        if (!this.isWorkSession || !this.selectedTaskId) {
            return;
        }

        // Calculate elapsed time and create work session
        if (this.isRunning && this.startTime) {
            const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            const elapsedMinutes = Math.max(1, Math.floor(elapsedSeconds / 60)); // Minimum 1 minute for display

            const task = this.tasks.find(t => t.id === this.selectedTaskId);

            // Create work session for ANY duration (no threshold)
            const workSession = {
                id: generateUUID(),
                taskId: this.selectedTaskId,
                taskText: task ? task.text : 'Unknown task',
                duration: elapsedMinutes,  // Actual elapsed time
                completedAt: new Date().toISOString()
            };

            console.log('✅ Creating work session:', workSession);

            // Add to local storage
            this.workSessions.push(workSession);

            // Queue sync to Work Sessions sheet
            this.syncQueue.enqueue({ type: 'sync_work_session', data: workSession });

            // Log to Activity Log
            this.syncToGoogleSheets('Work Session', workSession.taskText, elapsedMinutes)
                .then(result => {
                    if (result.success) {
                        console.log('✅ Work session synced to Google Sheets:', workSession.taskText);
                    }
                });

            // Update stats and save
            this.updateStats();
            this.saveData();
        }

        // Complete the current task
        this.completeTask(this.selectedTaskId, { stopPropagation: () => {} });

        // If timer is running, pause it
        if (this.isRunning) {
            this.pauseTimer();
        }
    }

    skipBreak() {
        if (this.isWorkSession || !this.isRunning) {
            return;
        }

        // Stop the current break timer
        this.isRunning = false;
        clearInterval(this.timer);

        // Switch to work session
        this.isWorkSession = true;
        this.currentDuration = this.workDuration;
        this.timeLeft = this.currentDuration;

        // Update UI
        this.startBtn.disabled = !this.selectedTaskId;
        this.pauseBtn.disabled = true;
        this.updateDisplay();

        this.addActivity('⏭️ Break skipped');
    }

    createConfetti() {
        console.log('🎉 Creating canvas confetti animation!');
        // Play task complete sound
        if (window.alertSoundManager) {
            window.alertSoundManager.playSound('task-complete');
        } else {
            this.playSound('task-complete');
        }


        // Check if confetti library is loaded
        if (typeof confetti === 'undefined') {
            console.warn('Canvas confetti library not loaded, falling back to celebration message only');
            this.showCelebrationMessage();
            return;
        }

        // Create multiple confetti bursts for better effect
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];

        // Main confetti burst
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: colors
        });

        // Left side burst
        setTimeout(() => {
            confetti({
                particleCount: 50,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.7 },
                colors: colors
            });
        }, 250);

        // Right side burst
        setTimeout(() => {
            confetti({
                particleCount: 50,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.7 },
                colors: colors
            });
        }, 500);

        // Final center burst
        setTimeout(() => {
            confetti({
                particleCount: 80,
                spread: 100,
                origin: { y: 0.8 },
                colors: colors,
                shapes: ['star', 'circle'],
                scalar: 1.2
            });
        }, 750);

        // Also show a celebratory message
        this.showCelebrationMessage();
    }

    showCelebrationMessage() {
        const messages = [
            '🎉 Great job!',
            '✨ Task completed!',
            '🌟 Awesome work!',
            '🎊 Well done!',
            '💪 Keep it up!'
        ];

        const message = messages[Math.floor(Math.random() * messages.length)];

        // Create temporary celebration element
        const celebration = document.createElement('div');
        celebration.textContent = message;
        celebration.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 3rem;
            font-weight: bold;
            color: #ff6b6b;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            pointer-events: none;
            z-index: 2000;
            animation: celebrationPulse 2s ease-out forwards;
        `;

        document.body.appendChild(celebration);

        // Remove after animation
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 2000);
    }

    async syncTodayData() {
        const today = new Date().toDateString();
        const todayTasks = this.completedTasks.filter(task =>
            new Date(task.completedAt).toDateString() === today
        );
        const todaySessions = this.workSessions.filter(session =>
            new Date(session.completedAt).toDateString() === today
        );

        if (todayTasks.length === 0 && todaySessions.length === 0) {
            alert('📊 No data to sync today!\nComplete some tasks or work sessions first.');
            return;
        }

        let syncCount = 0;
        let errors = 0;

        // Sync completed tasks
        for (const task of todayTasks) {
            try {
                const result = await this.syncToGoogleSheets('Task', task.text);
                if (result.success) {
                    syncCount++;
                } else {
                    errors++;
                }
            } catch (error) {
                errors++;
            }
        }

        // Sync work sessions
        for (const session of todaySessions) {
            try {
                const result = await this.syncToGoogleSheets('Work Session', session.taskText, session.duration);
                if (result.success) {
                    syncCount++;
                } else {
                    errors++;
                }
            } catch (error) {
                errors++;
            }
        }

        if (errors === 0) {
            alert(`✅ Sync completed successfully!\n${syncCount} items synced to Google Sheets.`);
            this.addActivity(`🔄 Manually synced ${syncCount} items to Google Sheets`);
        } else {
            alert(`⚠️ Sync completed with errors\n${syncCount} items synced, ${errors} failed.`);
            this.addActivity(`🔄 Manual sync: ${syncCount} synced, ${errors} failed`);
        }
    }

    completeSession() {
        this.isRunning = false;

        // Clear both timers
        clearInterval(this.timer);

        // Stop Web Worker
        if (this.worker) {
            this.worker.postMessage({ action: 'stop' });
        }

        // Release wake lock
        this.releaseWakeLock();

        // Clear start time
        this.startTime = null;

        // Play appropriate alert sound based on session type
        if (this.isWorkSession) {
            // Work session complete - determine if next break is long or short
            const willBeLongBreak = this.longBreakInterval > 0 &&
                                   (this.completedPomodoros + 1) >= this.longBreakInterval;
            const soundType = willBeLongBreak ? 'long-break' : 'short-break';
            if (window.alertSoundManager) {
                window.alertSoundManager.playSound(soundType);
            } else {
                this.playSound(soundType);
            }
        } else {
            // Break complete - play work-start sound
            if (window.alertSoundManager) {
                window.alertSoundManager.playSound('work-start');
            } else {
                this.playSound('work-start');
            }
        }

        // Show notifications
        if (this.isWorkSession) {
            const task = this.tasks.find(t => t.id === this.selectedTaskId);
            const taskName = task ? task.text : 'Unknown task';

            // Already calculated above
            const willBeLongBreak = this.longBreakInterval > 0 &&
                                   (this.completedPomodoros + 1) >= this.longBreakInterval;

            this.showNotification(
                '🍅 Work Session Complete!',
                `Time for a ${willBeLongBreak ? 'long' : 'short'} break! You finished working on: ${taskName}`,
                '✅'
            );
        } else {
            const breakType = this.isLongBreak ? 'Long Break' : 'Short Break';
            this.showNotification(
                `☕ ${breakType} Complete!`,
                'Time to get back to work! Select a task and start a new session.',
                '💪'
            );
        }

        if (this.isWorkSession) {
            this.sessionCount++;
            const task = this.tasks.find(t => t.id === this.selectedTaskId);

            // Record work session
            const workSession = {
                id: generateUUID(),  // Use UUID instead of Date.now()
                taskId: this.selectedTaskId,
                taskText: task ? task.text : 'Unknown task',
                duration: this.workDuration,
                completedAt: new Date().toISOString()
            };
            this.workSessions.push(workSession);

            // Queue sync of work session to Work Sessions sheet
            this.syncQueue.enqueue({ type: 'sync_work_session', data: workSession });

            // Sync to Google Sheets automatically
            this.syncToGoogleSheets('Work Session', workSession.taskText, workSession.duration)
                .then(result => {
                    if (result.success) {
                        this.addActivity(`✅ Work session synced to Google Sheets: ${workSession.taskText}`);
                    } else {
                        console.log('Google Sheets sync failed:', result.reason);
                    }
                });

            // Handle case where Pomodoro is complete but task isn't finished
            // Only show prompt if task still exists and isn't completed
            if (task && !task.completed && this.tasks.find(t => t.id === this.selectedTaskId)) {
                const continueTask = confirm(
                    `🍅 Pomodoro completed!\n\nTask: "${task.text}"\n\nIs this task finished?\n\nClick OK if complete, Cancel to continue working on it.`
                );

                if (continueTask) {
                    // Mark task as complete
                    this.completeTask(this.selectedTaskId, { stopPropagation: () => {} });
                } else {
                    // Task continues to next Pomodoro
                    this.addActivity(`🔄 Continuing task: ${task.text}`);
                }
            } else if (this.selectedTaskId && !task) {
                // Task was deleted during session
                console.warn('Task was deleted during work session');
                this.selectedTaskId = null;
            }

            // Increment pomodoro counters
            this.consecutiveWorkSessions++;
            this.completedPomodoros++;

            // Determine if this should be a long break
            if (this.longBreakInterval > 0 && this.completedPomodoros >= this.longBreakInterval) {
                // Start long break
                this.isLongBreak = true;
                this.currentDuration = this.longBreakDuration;
                this.consecutiveWorkSessions = 0; // Reset counter for compatibility
                this.completedPomodoros = 0; // Reset pomodoro cycle
                this.addActivity('🎉 Long break time! You completed a full Pomodoro cycle');
            } else {
                // Start short break
                this.isLongBreak = false;
                this.currentDuration = this.breakDuration;
                this.addActivity(`✅ Short break time (${this.completedPomodoros} of ${this.longBreakInterval} pomodoros)`);
            }

            // Switch to break
            this.isWorkSession = false;
        } else {
            const breakType = this.isLongBreak ? 'long break' : 'short break';
            this.addActivity(`✅ ${breakType.charAt(0).toUpperCase() + breakType.slice(1)} completed`);

            // Reset long break flag and switch to work
            this.isLongBreak = false;
            this.isWorkSession = true;
            this.currentDuration = this.workDuration;
        }

        this.timeLeft = this.currentDuration;
        this.startBtn.disabled = this.isWorkSession && !this.selectedTaskId;
        this.pauseBtn.disabled = true;
        this.updateDisplay();
        this.updatePomodoroProgress(); // Update pomodoro cycle indicator
        this.updateStats();
        this.saveData();
    }

    updateDisplay() {
        // Update time display
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update session type
        if (this.isWorkSession) {
            this.sessionTypeDisplay.textContent = 'Work Session';
        } else {
            this.sessionTypeDisplay.textContent = this.isLongBreak ? 'Long Break' : 'Short Break';
        }

        // Update pomodoro progress
        if (this.longBreakInterval > 0) {
            const current = this.consecutiveWorkSessions;
            const total = this.longBreakInterval;
            this.pomodoroText.textContent = `${current} of ${total} pomodoros`;

            // Update visual progress indicators
            if (this.pomodoroProgress) {
                const steps = this.pomodoroProgress.querySelectorAll('.pomodoro-step');
                steps.forEach((step, index) => {
                    if (index < current) {
                        step.classList.add('completed');
                    } else {
                        step.classList.remove('completed');
                    }
                });
            }
        } else {
            this.pomodoroText.textContent = 'Long breaks disabled';
        }

        // Update progress bar
        const progress = ((this.currentDuration - this.timeLeft) / this.currentDuration) * 100;
        this.progressBar.style.width = `${progress}%`;

        // Update session count
        this.sessionCountDisplay.textContent = this.sessionCount;

        // Update current task
        if (this.selectedTaskId) {
            const task = this.tasks.find(t => t.id === this.selectedTaskId);
            this.currentTaskDisplay.textContent = task ? task.text : 'No task selected';
        } else {
            this.currentTaskDisplay.textContent = 'No task selected';
        }

        // Update start button state
        this.startBtn.disabled = this.isRunning || (this.isWorkSession && !this.selectedTaskId);

        // Update timer action buttons visibility
        this.updateTimerActions();
    }

    updateTimerActions() {
        // Show/hide timer actions based on current state
        if (this.isRunning) {
            this.timerActions.classList.remove('hidden');

            // Show complete task button during work sessions with selected task
            if (this.isWorkSession && this.selectedTaskId) {
                this.completeTaskBtn.classList.remove('hidden');
            } else {
                this.completeTaskBtn.classList.add('hidden');
            }

            // Show skip break button during break sessions
            if (!this.isWorkSession) {
                this.skipBreakBtn.classList.remove('hidden');
            } else {
                this.skipBreakBtn.classList.add('hidden');
            }
        } else {
            this.timerActions.classList.add('hidden');
            this.completeTaskBtn.classList.add('hidden');
            this.skipBreakBtn.classList.add('hidden');
        }
    }

    updatePomodoroProgress() {
        // Update the pomodoro cycle indicator UI
        if (!this.pomodoroProgress || this.longBreakInterval <= 0) return;

        const steps = this.pomodoroProgress.querySelectorAll('.pomodoro-step');
        const completedCount = this.completedPomodoros;
        const totalSteps = this.longBreakInterval;

        steps.forEach((step, index) => {
            // Clear all state classes first
            step.classList.remove('completed', 'active', 'pending');

            if (index < completedCount) {
                // Mark as completed
                step.classList.add('completed');
            } else if (index === completedCount && this.isWorkSession && this.isRunning) {
                // Mark as active (currently in progress)
                step.classList.add('active');
            } else if (index < totalSteps) {
                // Mark as pending
                step.classList.add('pending');
            }
        });

        // Update text display
        const pomodoroText = document.getElementById('pomodoroText');
        if (pomodoroText) {
            pomodoroText.textContent = `${completedCount} of ${totalSteps} pomodoros`;
        }
    }

    addTask() {
        const text = this.taskInput.value.trim();
        if (!text) return;

        const now = new Date().toISOString();
        const task = {
            id: generateUUID(),  // Use UUID instead of Date.now() for guaranteed uniqueness
            text: text,
            completed: false,
            version: 1,  // Initialize version for conflict resolution
            createdAt: now,
            lastModified: now,
            deviceId: this.deviceId
        };

        this.tasks.push(task);
        this.taskInput.value = '';
        this.renderTasks();
        this.saveData();
        this.addActivity(`📝 Added task: ${text}`);

        // Queue sync operation (will be debounced with other operations)
        this.syncQueue.enqueue({ type: 'sync_task', data: task });
    }

    selectTask(taskId) {
        // Prevent task selection during active work session (only allow during breaks or when paused)
        if (this.isRunning && this.isWorkSession) {
            return;
        }

        this.selectedTaskId = taskId;
        this.renderTasks();
        this.updateDisplay();
        this.saveData();
    }

    completeTask(taskId, event) {
        event.stopPropagation();

        // Check minimum time requirement
        if (this.isRunning && this.isWorkSession && this.selectedTaskId === taskId) {
            const elapsedTime = this.currentDuration - this.timeLeft;
            if (elapsedTime < PomodoroTimer.MIN_TASK_TIME) {
                alert(`You need to spend at least ${PomodoroTimer.MIN_TASK_TIME} seconds on a task before completing it!`);
                return;
            }

            // Stop the current session if task is completed early
            this.pauseTimer();
        }

        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = this.tasks[taskIndex];
            const now = new Date().toISOString();

            task.completed = true;
            task.completedAt = now;
            task.lastModified = now;
            task.deviceId = this.deviceId;
            task.version = (task.version || 1) + 1;  // Increment version on modification

            this.completedTasks.push(task);
            this.tasks.splice(taskIndex, 1);

            // Track as deleted/completed to prevent re-adding during sync
            this.addToDeletedTasks(taskId);

            // Create confetti animation
            console.log('Task completed - triggering confetti for:', task.text);
            this.createConfetti();

            // Sync completed task to Google Sheets (activity log)
            this.syncToGoogleSheets('Task', task.text)
                .then(result => {
                    if (result.success) {
                        console.log('Task synced to Google Sheets:', task.text);
                    } else {
                        console.log('Google Sheets sync failed for task:', result.reason);
                    }
                });

            // Find if there's a recent work session for this task (within last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const recentSession = this.workSessions
                .filter(s => s.taskId === taskId && s.completedAt > fiveMinutesAgo)
                .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

            // Use atomic complete_task action to prevent race condition
            this.completeTaskAtomically(task, recentSession);

            // Clear selection if completed task was selected
            if (this.selectedTaskId === taskId) {
                this.selectedTaskId = null;
            }

            this.renderTasks();
            this.updateDisplay();
            this.updateStats();
            this.saveData();
            // Add activity ONCE for task completion
            this.addActivity(`✅ Completed task: ${task.text}`);
        }
    }

    async completeTaskAtomically(task, workSession = null) {
        if (!this.googleSheetsWebhook) {
            console.log('No webhook configured - skipping atomic completion sync');
            return { success: false, reason: 'No webhook configured' };
        }

        console.log('🔄 Completing task atomically:', task.text, workSession ? 'with work session' : 'without work session');

        const data = {
            action: 'complete_task',
            task: task,
            workSession: workSession,
            deviceId: this.deviceId
        };

        try {
            const result = await this.performApiCall(data);
            if (result.success) {
                console.log('✅ Task completed atomically on server:', task.text);
            } else {
                console.error('❌ Atomic completion failed:', result);
            }
            return result;
        } catch (error) {
            console.error('❌ Atomic completion error:', error);
            return { success: false, reason: error.message };
        }
    }

    async deleteTaskFromServer(taskId) {
        if (!this.googleSheetsWebhook) {
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
            action: 'delete_task',
            taskId: taskId,
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    deleteTask(taskId, event) {
        event.stopPropagation();

        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = this.tasks[taskIndex];
            this.tasks.splice(taskIndex, 1);

            // Track as deleted to prevent re-adding during sync
            this.addToDeletedTasks(taskId);

            // Delete from server as well
            this.deleteTaskFromServer(taskId);

            // Clear selection if deleted task was selected
            if (this.selectedTaskId === taskId) {
                this.selectedTaskId = null;
            }

            this.renderTasks();
            this.updateDisplay();
            this.saveData();
            this.addActivity(`🗑️ Deleted task: ${task.text}`);
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    renderTasks() {
        this.tasksList.innerHTML = '';

        if (this.tasks.length === 0) {
            this.tasksList.innerHTML = '<div class="empty-state">No tasks yet. Add one above!</div>';
            this.bulkSelectToggle.style.display = 'none';
            return;
        }

        this.bulkSelectToggle.style.display = 'inline-block';

        this.tasks.forEach(task => {
            const taskElement = document.createElement('div');
            const isSelected = this.selectedTaskIds.has(task.id);
            let className = 'task-item';

            if (this.bulkSelectionMode) {
                className += ' selection-mode';
                if (isSelected) {
                    className += ' selected';
                }
            } else if (task.id === this.selectedTaskId) {
                className += ' selected';
            }

            taskElement.className = className;
            taskElement.dataset.taskId = task.id;

            // Checkbox for bulk selection (visible only in selection mode)
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.checked = isSelected;
            checkbox.style.display = this.bulkSelectionMode ? 'inline-block' : 'none';
            checkbox.onclick = (e) => {
                e.stopPropagation();
                this.handleTaskCheckbox(task.id, e.target.checked);
            };

            // Radio button for task selection (hidden in bulk mode)
            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.className = 'task-radio';
            radioInput.checked = task.id === this.selectedTaskId;
            radioInput.readOnly = true;
            radioInput.style.display = this.bulkSelectionMode ? 'none' : 'inline-block';

            const taskText = document.createElement('span');
            taskText.className = 'task-text';
            taskText.textContent = task.text; // Safe text content

            const taskActions = document.createElement('div');
            taskActions.className = 'task-actions';

            const completeBtn = document.createElement('button');
            completeBtn.className = 'task-btn complete-btn';
            completeBtn.textContent = '✓';
            completeBtn.onclick = (event) => this.completeTask(task.id, event);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-btn delete-btn';
            deleteBtn.textContent = '✗';
            deleteBtn.onclick = (event) => this.deleteTask(task.id, event);

            taskActions.appendChild(completeBtn);
            taskActions.appendChild(deleteBtn);

            // Only add click handler for task selection if NOT in bulk mode
            if (!this.bulkSelectionMode) {
                taskElement.onclick = () => this.selectTask(task.id);
            }

            taskElement.appendChild(checkbox);
            taskElement.appendChild(radioInput);
            taskElement.appendChild(taskText);
            taskElement.appendChild(taskActions);

            this.tasksList.appendChild(taskElement);
        });
    }

    updateStats() {
        const today = getTodayUTC();

        // Count today's completed tasks (using UTC for consistency)
        const todayTasks = this.completedTasks.filter(task =>
            getDateUTC(task.completedAt) === today
        ).length;

        // Count today's work sessions (using UTC for consistency)
        const todaySessions = this.workSessions.filter(session =>
            getDateUTC(session.completedAt) === today
        ).length;

        // Calculate today's focus time (using UTC for consistency)
        const todayFocusTime = this.workSessions
            .filter(session => getDateUTC(session.completedAt) === today)
            .reduce((total, session) => total + session.duration, 0);

        this.todayTasksDisplay.textContent = todayTasks;
        this.todaySessionsDisplay.textContent = todaySessions;
        this.todayTimeDisplay.textContent = `${Math.round(todayFocusTime / 60)}m`;
    }

    addActivity(text) {
        const activity = {
            id: Date.now(),
            text: text,
            timestamp: new Date().toISOString()
        };

        // Keep only last MAX_ACTIVITY_LOG_ITEMS activities
        const activities = JSON.parse(localStorage.getItem('pomodoroActivities') || '[]');
        activities.unshift(activity);
        activities.splice(PomodoroTimer.MAX_ACTIVITY_LOG_ITEMS);

        localStorage.setItem('pomodoroActivities', JSON.stringify(activities));
        this.updateActivityLog();
    }

    updateActivityLog() {
        const activities = JSON.parse(localStorage.getItem('pomodoroActivities') || '[]');
        this.activityList.innerHTML = '';

        activities.slice(0, 10).forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';

            const timeDiv = document.createElement('div');
            timeDiv.className = 'activity-time';
            timeDiv.textContent = new Date(activity.timestamp).toLocaleTimeString();

            const textDiv = document.createElement('div');
            textDiv.className = 'activity-text';
            textDiv.textContent = activity.text; // Safe text content

            activityElement.appendChild(timeDiv);
            activityElement.appendChild(textDiv);
            this.activityList.appendChild(activityElement);
        });
    }

    generateReport() {
        const today = new Date();
        const todayString = today.toDateString();
        const todayFormatted = today.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const todayTasks = this.completedTasks.filter(task =>
            new Date(task.completedAt).toDateString() === todayString
        );
        const todaySessions = this.workSessions.filter(session =>
            new Date(session.completedAt).toDateString() === todayString
        );
        const incompleteTasks = this.tasks;

        const totalFocusTime = todaySessions.reduce((total, session) => total + session.duration, 0);

        let report = `🍅 Daily Productivity Report\n${todayFormatted}\n\n`;

        report += `📊 SUMMARY\n`;
        report += `✅ Tasks Completed: ${todayTasks.length}\n`;
        report += `🍅 Work Sessions: ${todaySessions.length}\n`;
        report += `⏰ Total Focus Time: ${Math.round(totalFocusTime / 60)} minutes\n\n`;

        if (todayTasks.length > 0) {
            report += `✅ COMPLETED TASKS:\n`;
            todayTasks.forEach(task => {
                const time = new Date(task.completedAt).toLocaleTimeString();
                report += `• ${task.text} (${time})\n`;
            });
            report += `\n`;
        }

        if (todaySessions.length > 0) {
            report += `🍅 WORK SESSIONS:\n`;
            todaySessions.forEach(session => {
                const time = new Date(session.completedAt).toLocaleTimeString();
                const duration = Math.round(session.duration / 60);
                report += `• ${session.taskText} - ${duration}min (${time})\n`;
            });
            report += `\n`;
        }

        if (incompleteTasks.length > 0) {
            report += `⏳ REMAINING TASKS:\n`;
            incompleteTasks.forEach(task => {
                report += `• ${task.text}\n`;
            });
        }

        return report;
    }

    async checkServerVersion() {
        if (!this.googleSheetsWebhook) {
            return { success: false, reason: 'No webhook configured' };
        }

        try {
            const data = { action: 'get_version' };
            const result = await this.performApiCall(data);
            return result;
        } catch (error) {
            console.error('Error checking server version:', error);
            return { success: false, reason: error.message };
        }
    }

    async testGoogleSheetsConnection() {
        if (!this.googleSheetsWebhook) {
            alert('❌ No webhook URL configured!\nPlease add your Google Apps Script webhook URL in settings.');
            return;
        }

        try {
            console.log('Testing connection to:', this.googleSheetsWebhook);

            // Check server version first
            const versionResult = await this.checkServerVersion();
            if (versionResult.success) {
                console.log('✅ Server version:', versionResult.version, versionResult.versionName);
                if (versionResult.version < 3) {
                    alert(`⚠️ Server Update Required\n\nYour Google Apps Script is running version ${versionResult.version}.\nVersion 3 is required for stats sync.\n\nPlease update your Google Apps Script and redeploy.`);
                    return;
                }
            } else {
                console.warn('⚠️ Could not verify server version:', versionResult.reason);
            }

            // Test with GET request first
            const testResponse = await fetch(this.googleSheetsWebhook, {
                method: 'GET'
            });

            console.log('GET test response status:', testResponse.status);
            const testResult = await testResponse.text();
            console.log('GET test response:', testResult);

            // Now test POST with sample data
            const testData = {
                date: new Date().toISOString().split('T')[0],
                type: 'Test',
                description: 'Connection test from Pomodoro Timer',
                duration: 'N/A',
                completedTime: new Date().toLocaleString()
            };

            console.log('Sending test data:', testData);

            const response = await fetch(this.googleSheetsWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(testData)
            });

            console.log('POST response status:', response.status);
            const result = await response.text();
            console.log('POST response text:', result);

            try {
                const jsonResult = JSON.parse(result);
                if (jsonResult.success) {
                    alert('✅ Google Sheets connection successful!\nTest data added to your sheet.');
                    this.addActivity('✅ Google Sheets connection test successful');
                } else {
                    alert(`❌ Google Sheets error: ${jsonResult.error || 'Unknown error'}\nCheck console for details.`);
                }
            } catch (parseError) {
                alert(`❌ Invalid response from Google Apps Script\nResponse: ${result}\nCheck console for details.`);
            }

        } catch (error) {
            console.error('Connection test failed:', error);
            alert(`❌ Connection failed: ${error.message}\n\nPossible issues:\n• Wrong webhook URL\n• Apps Script not deployed as web app\n• Permissions not set correctly\n\nCheck console for details.`);
        }
    }

    syncToGoogleSheetsJSONP(type, description, duration = null) {
        return new Promise((resolve) => {
            if (!this.googleSheetsWebhook) {
                console.log('No Google Sheets webhook configured');
                resolve({ success: false, reason: 'No webhook configured' });
                return;
            }

            const data = {
                date: new Date().toISOString().split('T')[0],
                type: type,
                description: description,
                duration: duration ? Math.round(duration / 60) : 'N/A',
                completedTime: new Date().toLocaleString()
            };

            console.log('Syncing to Google Sheets via JSONP:', data);

            // Create unique callback name
            const callbackName = 'pomodoroCallback_' + Date.now();

            // Create script element for JSONP
            const script = document.createElement('script');
            const params = new URLSearchParams(data);
            params.append('callback', callbackName);

            script.src = this.googleSheetsWebhook + '?' + params.toString();

            // Set up callback function
            window[callbackName] = (response) => {
                console.log('JSONP response:', response);
                document.head.removeChild(script);
                delete window[callbackName];

                if (response.success) {
                    resolve({ success: true, data: response });
                } else {
                    resolve({ success: false, reason: response.error || 'Unknown error' });
                }
            };

            // Handle errors
            script.onerror = () => {
                console.error('JSONP request failed');
                document.head.removeChild(script);
                delete window[callbackName];
                resolve({ success: false, reason: 'Network error' });
            };

            // Add script to document
            document.head.appendChild(script);

            // Timeout after 10 seconds
            setTimeout(() => {
                if (window[callbackName]) {
                    console.error('JSONP request timeout');
                    document.head.removeChild(script);
                    delete window[callbackName];
                    resolve({ success: false, reason: 'Request timeout' });
                }
            }, PomodoroTimer.JSONP_TIMEOUT);
        });
    }

    // Enhanced sync methods for task synchronization
    async syncTaskToServer(task) {
        if (!this.googleSheetsWebhook) {
            console.log('No Google Sheets webhook configured for task sync');
            return { success: false, reason: 'No webhook configured' };
        }

        console.log('Syncing single task via POST:', task.text);

        const data = {
            action: 'sync_tasks',
            tasks: [task],
            deviceId: this.deviceId
        };

        try {
            const result = await this.performApiCall(data);
            console.log('POST sync successful for single task:', result);
            return result;
        } catch (error) {
            console.log('POST failed for single task sync, trying JSONP fallback:', error.message);
            console.log('Switching to JSONP for task:', task.text);
            const result = await this.syncTaskViaJSONP(task);
            console.log('JSONP fallback result for single task:', result);
            return result;
        }
    }

    async syncAllTasksToServer() {
        if (!this.googleSheetsWebhook || this.tasks.length === 0) {
            return { success: false, reason: 'No webhook configured or no tasks to sync' };
        }

        console.log('Attempting to sync', this.tasks.length, 'tasks via POST...');

        const data = {
            action: 'sync_tasks',
            tasks: this.tasks,
            deviceId: this.deviceId
        };

        try {
            const result = await this.performApiCall(data);
            console.log('POST sync successful:', result);
            return result;
        } catch (error) {
            console.log('POST failed for all tasks sync, trying JSONP fallback:', error.message);
            console.log('Switching to JSONP for', this.tasks.length, 'tasks...');

            // For JSONP, sync tasks one by one due to URL length limits
            let syncedCount = 0;
            let errors = 0;

            for (const task of this.tasks) {
                try {
                    console.log('Syncing task via JSONP:', task.text);
                    const result = await this.syncTaskViaJSONP(task);
                    if (result.success) {
                        syncedCount++;
                        console.log('✅ JSONP sync success for:', task.text);
                    } else {
                        errors++;
                        console.log('❌ JSONP sync failed for:', task.text, result.reason);
                    }
                } catch (taskError) {
                    errors++;
                    console.log('❌ JSONP sync error for:', task.text, taskError.message);
                }
            }

            const result = {
                success: errors === 0,
                syncedCount,
                errors,
                reason: errors > 0 ? `${errors} tasks failed to sync` : `Synced via JSONP fallback`
            };

            console.log('JSONP fallback result:', result);
            return result;
        }
    }

    async getTasksFromServer() {
        if (!this.googleSheetsWebhook) {
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
            action: 'get_tasks',
            deviceId: this.deviceId
        };

        try {
            // Try fetch first, fallback to JSONP
            const response = await fetch(this.googleSheetsWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(data)
            });

            const resultText = await response.text();
            const result = JSON.parse(resultText);

            if (result.success) {
                return { success: true, tasks: result.tasks || [] };
            } else {
                return { success: false, reason: result.error || 'Unknown error' };
            }
        } catch (error) {
            console.log('Fetch failed, trying JSONP fallback for get_tasks:', error.message);
            return await this.getTasksViaJSONP();
        }
    }

    async performApiCall(data) {
        // Use text/plain to bypass CORS preflight (Google Apps Script limitation)
        const response = await fetch(this.googleSheetsWebhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(data)
        });

        const resultText = await response.text();
        const result = JSON.parse(resultText);

        if (result.success) {
            console.log('Task sync successful:', result);
            return { success: true, data: result };
        } else {
            console.error('Task sync failed:', result);
            return { success: false, reason: result.error || 'Unknown error' };
        }
    }

    async syncTaskViaJSONP(task) {
        return new Promise((resolve) => {
            const callbackName = 'pomodoroSyncTask_' + Date.now();
            const script = document.createElement('script');
            const params = new URLSearchParams({
                action: 'sync_tasks',
                taskId: task.id,
                taskText: task.text,
                taskCompleted: task.completed ? 'true' : 'false',
                taskCreatedAt: task.createdAt,
                taskLastModified: task.lastModified,
                taskDeviceId: task.deviceId,
                deviceId: this.deviceId,
                callback: callbackName
            });

            script.src = this.googleSheetsWebhook + '?' + params.toString();

            window[callbackName] = (response) => {
                document.head.removeChild(script);
                delete window[callbackName];

                if (response.success) {
                    resolve({ success: true, data: response });
                } else {
                    resolve({ success: false, reason: response.error || 'Unknown error' });
                }
            };

            script.onerror = () => {
                document.head.removeChild(script);
                delete window[callbackName];
                resolve({ success: false, reason: 'Network error' });
            };

            document.head.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    document.head.removeChild(script);
                    delete window[callbackName];
                    resolve({ success: false, reason: 'Request timeout' });
                }
            }, PomodoroTimer.JSONP_TIMEOUT);
        });
    }

    async getTasksViaJSONP() {
        return new Promise((resolve) => {
            const callbackName = 'pomodoroGetTasks_' + Date.now();
            const script = document.createElement('script');
            const params = new URLSearchParams({
                action: 'get_tasks',
                deviceId: this.deviceId,
                callback: callbackName
            });

            script.src = this.googleSheetsWebhook + '?' + params.toString();

            window[callbackName] = (response) => {
                document.head.removeChild(script);
                delete window[callbackName];

                if (response.success) {
                    resolve({ success: true, tasks: response.tasks || [] });
                } else {
                    resolve({ success: false, reason: response.error || 'Unknown error' });
                }
            };

            script.onerror = () => {
                document.head.removeChild(script);
                delete window[callbackName];
                resolve({ success: false, reason: 'Network error' });
            };

            document.head.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    document.head.removeChild(script);
                    delete window[callbackName];
                    resolve({ success: false, reason: 'Request timeout' });
                }
            }, PomodoroTimer.JSONP_TIMEOUT);
        });
    }

    async performFullSync() {
        if (this.syncLocks.full) {
            console.log('Full sync already in progress, skipping');
            return;
        }

        this.syncLocks.full = true;
        this.updateSyncStatus('syncing');

        try {
            // Sync tasks (with separate lock)
            if (!this.syncLocks.tasks) {
                this.syncLocks.tasks = true;
                try {
                    const serverResult = await this.getTasksFromServer();
                    if (serverResult.success) {
                        const mergeResult = this.mergeTasks(serverResult.tasks);
                        if (mergeResult.hasChanges) {
                            await this.syncAllTasksToServer();
                        }
                    } else {
                        console.error('Failed to get tasks from server:', serverResult.reason);
                    }
                } finally {
                    this.syncLocks.tasks = false;
                }
            }

            // Sync stats (with separate lock, can run independently)
            if (!this.syncLocks.stats) {
                this.syncLocks.stats = true;
                try {
                    await this.refreshTodayStats();
                } catch (error) {
                    console.error('Stats sync error:', error);
                } finally {
                    this.syncLocks.stats = false;
                }
            }

            // Sync archived tasks (with separate lock, can run independently)
            if (!this.syncLocks.archived) {
                this.syncLocks.archived = true;
                try {
                    const archivedResult = await this.getArchivedTasksFromServer();
                    if (archivedResult.success) {
                        this.mergeArchivedTasks(archivedResult.archivedTasks || []);
                        console.log(`✅ Synced ${archivedResult.count || 0} archived tasks from server`);
                    } else {
                        console.log('📦 Archived tasks sync skipped:', archivedResult.reason);
                    }
                } catch (error) {
                    console.error('Archived tasks sync error:', error);
                } finally {
                    this.syncLocks.archived = false;
                }
            }

            this.lastSyncTime = new Date().toISOString();
            this.saveData();
            this.updateSyncStatus('synced');

            console.log('Full sync completed successfully');
        } catch (error) {
            console.error('Full sync error:', error);
            this.updateSyncStatus('error');
        } finally {
            this.syncLocks.full = false;
        }
    }

    async refreshTodayStats(showUserFeedback = false) {
        if (!this.googleSheetsWebhook) {
            const message = 'No webhook configured - stats sync disabled';
            console.log(message);
            if (showUserFeedback) {
                alert('❌ Stats Sync Failed\n\nNo Google Sheets webhook URL configured.\nPlease add your webhook URL in settings to enable stats sync across devices.');
            }
            return { success: false, reason: 'no_webhook' };
        }

        const today = getTodayUTC();
        console.log('🔄 [Stats Sync] Starting sync for:', today);

        try {
            let completedCount = 0;
            let sessionsCount = 0;
            let errors = [];

            // Get completed tasks from server for today
            console.log('🔄 [Stats Sync] Fetching completed tasks from server...');
            const completedResult = await this.getCompletedTasksFromServer(today);

            if (completedResult.success) {
                const beforeCount = this.completedTasks.length;
                this.mergeCompletedTasks(completedResult.data.completedTasks || []);
                const afterCount = this.completedTasks.length;
                const newTasks = afterCount - beforeCount;
                completedCount = completedResult.data.completedTasks?.length || 0;
                console.log(`✅ [Stats Sync] Received ${completedCount} completed tasks from server, merged ${newTasks} new tasks`);
            } else {
                const error = `Failed to fetch completed tasks: ${completedResult.reason || 'Unknown error'}`;
                console.error('❌ [Stats Sync]', error);
                errors.push(error);
            }

            // Get work sessions from server for today
            console.log('🔄 [Stats Sync] Fetching work sessions from server...');
            const sessionsResult = await this.getWorkSessionsFromServer(today);

            if (sessionsResult.success) {
                const beforeCount = this.workSessions.length;
                this.mergeWorkSessions(sessionsResult.data.workSessions || []);
                const afterCount = this.workSessions.length;
                const newSessions = afterCount - beforeCount;
                sessionsCount = sessionsResult.data.workSessions?.length || 0;
                console.log(`✅ [Stats Sync] Received ${sessionsCount} work sessions from server, merged ${newSessions} new sessions`);
            } else {
                const error = `Failed to fetch work sessions: ${sessionsResult.reason || 'Unknown error'}`;
                console.error('❌ [Stats Sync]', error);
                errors.push(error);
            }

            // Update stats display
            this.updateStats();
            console.log('✅ [Stats Sync] Stats display updated');

            // Store last successful sync time
            this.lastStatsSyncTime = new Date().toISOString();
            this.saveData();

            // Update stats sync status indicator
            if (this.statsSyncText) {
                if (errors.length === 0) {
                    this.statsSyncText.textContent = 'Synced';
                    if (this.statsSyncLastTime) {
                        const now = new Date().toLocaleTimeString();
                        this.statsSyncLastTime.textContent = `Last synced: ${now}`;
                    }
                } else {
                    this.statsSyncText.textContent = 'Partial sync';
                }
            }

            if (showUserFeedback) {
                if (errors.length === 0) {
                    alert(`✅ Stats Sync Successful!\n\nCompleted Tasks: ${completedCount}\nWork Sessions: ${sessionsCount}\n\nYour stats are now up to date.`);
                } else {
                    alert(`⚠️ Stats Sync Partial Success\n\nSome errors occurred:\n${errors.join('\n')}\n\nPlease check console for details.`);
                }
            }

            return {
                success: errors.length === 0,
                completedCount,
                sessionsCount,
                errors
            };

        } catch (error) {
            const errorMessage = `Error refreshing stats: ${error.message}`;
            console.error('❌ [Stats Sync]', errorMessage, error);

            // Update stats sync status indicator
            if (this.statsSyncText) {
                this.statsSyncText.textContent = 'Failed';
            }

            if (showUserFeedback) {
                alert(`❌ Stats Sync Failed\n\n${error.message}\n\nPossible causes:\n• Google Apps Script not deployed\n• Incorrect webhook URL\n• Network connection issue\n• Script needs to be updated to version 3\n\nCheck browser console for details.`);
            }

            return { success: false, reason: error.message, error };
        }
    }

    async getCompletedTasksFromServer(date = null) {
        if (!this.googleSheetsWebhook) {
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
            action: 'get_completed_tasks',
            date: date,
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    async getWorkSessionsFromServer(date = null) {
        if (!this.googleSheetsWebhook) {
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
            action: 'get_work_sessions',
            date: date,
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    mergeCompletedTasks(serverTasks) {
        // Create map of local tasks by ID for fast lookup
        const localMap = new Map(this.completedTasks.map(t => [t.id, t]));

        let addedCount = 0;
        let updatedCount = 0;

        // Add or update server tasks
        for (const serverTask of serverTasks) {
            const localTask = localMap.get(serverTask.id);

            if (!localTask) {
                // New task from server - add it
                this.completedTasks.push(serverTask);
                addedCount++;
            } else {
                // Task exists - check for conflicts using version and timestamp
                const serverVersion = serverTask.version || 1;
                const localVersion = localTask.version || 1;

                if (serverVersion > localVersion) {
                    // Server has newer version - update
                    const index = this.completedTasks.findIndex(t => t.id === serverTask.id);
                    this.completedTasks[index] = serverTask;
                    updatedCount++;
                    console.log(`Updated completed task from server (v${serverVersion} > v${localVersion}):`, serverTask.text);
                } else if (serverVersion === localVersion) {
                    // Same version - use timestamp
                    const serverModified = new Date(serverTask.lastModified || serverTask.completedAt);
                    const localModified = new Date(localTask.lastModified || localTask.completedAt);

                    if (serverModified > localModified) {
                        const index = this.completedTasks.findIndex(t => t.id === serverTask.id);
                        this.completedTasks[index] = serverTask;
                        updatedCount++;
                        console.log(`Updated completed task from server (newer timestamp):`, serverTask.text);
                    }
                }
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            // Sort by completion time (newest first)
            this.completedTasks.sort((a, b) =>
                new Date(b.completedAt) - new Date(a.completedAt)
            );
            console.log(`Stats merge: ${addedCount} added, ${updatedCount} updated completed tasks`);
            // Persist changes to localStorage
            this.saveData();
        }
    }

    mergeWorkSessions(serverSessions) {
        // Create map of local sessions by ID for fast lookup
        const localMap = new Map(this.workSessions.map(s => [s.id, s]));

        let addedCount = 0;
        let updatedCount = 0;

        // Add or update server sessions
        for (const serverSession of serverSessions) {
            const localSession = localMap.get(serverSession.id);

            if (!localSession) {
                // New session from server - add it
                this.workSessions.push(serverSession);
                addedCount++;
            } else {
                // Session exists - check if server version is different
                // Work sessions are usually immutable, but check for data corrections
                const serverDuration = serverSession.duration;
                const localDuration = localSession.duration;
                const serverCompleted = new Date(serverSession.completedAt);
                const localCompleted = new Date(localSession.completedAt);

                // If server has different data, prefer server (assumes server is source of truth)
                if (serverDuration !== localDuration || serverCompleted.getTime() !== localCompleted.getTime()) {
                    const index = this.workSessions.findIndex(s => s.id === serverSession.id);
                    this.workSessions[index] = serverSession;
                    updatedCount++;
                    console.log(`Updated work session from server (data correction):`, serverSession.id);
                }
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            // Sort by completion time (newest first)
            this.workSessions.sort((a, b) =>
                new Date(b.completedAt) - new Date(a.completedAt)
            );
            console.log(`Stats merge: ${addedCount} added, ${updatedCount} updated work sessions`);
            // Persist changes to localStorage
            this.saveData();
        }
    }

    mergeTasks(serverTasks) {
        let hasChanges = false;
        const mergedTasks = [...this.tasks];
        const localTaskIds = new Set(this.tasks.map(t => t.id));

        console.log('Merging tasks. Server tasks:', serverTasks.length, 'Local tasks:', this.tasks.length);

        // Add new tasks from server (with completion validation)
        for (const serverTask of serverTasks) {
            const taskId = serverTask.id;

            // Check if task is completed/deleted locally
            if (this.isTaskCompleted(taskId)) {
                console.log('⏭️ Skipping server task (already completed locally):', serverTask.text);
                this.addActivity(`⏭️ Ignored completed task from server: ${serverTask.text}`);
                continue;
            }

            if (!localTaskIds.has(taskId)) {
                // New task from server - add it
                mergedTasks.push(serverTask);
                hasChanges = true;
                console.log('➕ Added new task from server:', serverTask.text);
                this.addActivity(`🔄 Synced new task from another device: ${serverTask.text}`);
            } else {
                // Task exists locally - check for conflicts using version first, then timestamp
                const localTask = this.tasks.find(t => t.id === taskId);
                const serverVersion = serverTask.version || 1;
                const localVersion = localTask.version || 1;

                // Compare versions first (more reliable than timestamps)
                if (serverVersion > localVersion) {
                    // Server has newer version
                    const index = mergedTasks.findIndex(t => t.id === taskId);
                    mergedTasks[index] = { ...serverTask, version: serverVersion };
                    hasChanges = true;
                    console.log(`🔄 Updated task with server version (v${serverVersion} > v${localVersion}):`, serverTask.text);
                    this.addActivity(`🔄 Updated task from another device: ${serverTask.text}`);
                } else if (serverVersion < localVersion) {
                    // Local has newer version
                    console.log(`📍 Keeping local version (v${localVersion} > v${serverVersion}):`, localTask.text);
                } else {
                    // Same version - use timestamp as tiebreaker
                    const serverModified = new Date(serverTask.lastModified);
                    const localModified = new Date(localTask.lastModified);

                    if (serverModified > localModified) {
                        const index = mergedTasks.findIndex(t => t.id === taskId);
                        mergedTasks[index] = { ...serverTask, version: serverVersion };
                        hasChanges = true;
                        console.log('🔄 Updated task with server version (same version, newer timestamp):', serverTask.text);
                        this.addActivity(`🔄 Updated task from another device: ${serverTask.text}`);
                    } else if (serverModified < localModified) {
                        console.log('📍 Keeping local version (same version, newer timestamp):', localTask.text);
                    } else {
                        console.log('🟰 Tasks in sync (same version and timestamp):', localTask.text);
                    }
                }
            }
        }

        // Remove tasks that were completed on other devices
        const tasksToRemove = [];
        for (const localTask of mergedTasks) {
            const serverTask = serverTasks.find(st => st.id === localTask.id);
            if (!serverTask && !this.isTaskCompleted(localTask.id)) {
                // Task exists locally but not on server, and wasn't completed locally
                // This means it was completed/deleted on another device
                console.log('🗑️ Task was completed on another device:', localTask.text);
                tasksToRemove.push(localTask.id);
                this.addToDeletedTasks(localTask.id);
                this.addActivity(`✅ Task completed on another device: ${localTask.text}`);
                hasChanges = true;
            }
        }

        // Actually remove the tasks
        for (const taskId of tasksToRemove) {
            const index = mergedTasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                mergedTasks.splice(index, 1);
            }
        }

        if (hasChanges) {
            this.tasks = mergedTasks;
            this.renderTasks();
            this.updateDisplay();
            console.log('✅ Task merge completed. Final task count:', this.tasks.length);
        } else {
            console.log('📍 No changes needed during merge');
        }

        return { hasChanges };
    }

    updateSyncStatus(status) {
        if (!this.syncStatusIndicator) return;

        // Remove all status classes
        this.syncStatusIndicator.classList.remove('syncing', 'synced', 'error');

        switch (status) {
            case 'syncing':
                this.syncStatusIndicator.classList.add('syncing');
                this.syncStatusIcon.textContent = '🔄';
                this.syncStatusText.textContent = 'Syncing...';
                break;
            case 'synced':
                this.syncStatusIndicator.classList.add('synced');
                this.syncStatusIcon.textContent = '✅';
                this.syncStatusText.textContent = 'Synced';
                if (this.lastSyncTime) {
                    const syncTime = new Date(this.lastSyncTime);
                    this.syncLastTime.textContent = `Last: ${syncTime.toLocaleTimeString()}`;
                }
                break;
            case 'error':
                this.syncStatusIndicator.classList.add('error');
                this.syncStatusIcon.textContent = '❌';
                this.syncStatusText.textContent = 'Sync failed';
                break;
            case 'offline':
                this.syncStatusIcon.textContent = '⚪';
                this.syncStatusText.textContent = 'Offline';
                break;
            default:
                this.syncStatusIcon.textContent = '⚪';
                this.syncStatusText.textContent = 'Ready to sync';
        }

        console.log('Sync status updated:', status);
    }

    async syncToGoogleSheets(type, description, duration = null) {
        if (!this.googleSheetsWebhook) {
            console.log('No Google Sheets webhook configured');
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
            action: 'log_activity',
            date: new Date().toISOString().split('T')[0],
            type: type,
            description: description,
            duration: duration ? Math.round(duration / 60) : 'N/A',
            completedTime: new Date().toLocaleString()
        };

        console.log('Syncing to Google Sheets:', data);
        console.log('Webhook URL:', this.googleSheetsWebhook);

        // Try fetch first, fallback to JSONP
        // Use text/plain to bypass CORS preflight (Google Apps Script workaround)
        try {
            const response = await fetch(this.googleSheetsWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(data)
            });

            console.log('Sync response status:', response.status);
            const resultText = await response.text();
            console.log('Sync response text:', resultText);

            try {
                const result = JSON.parse(resultText);

                if (result.success) {
                    console.log('Google Sheets sync successful:', result);
                    return { success: true, data: result };
                } else {
                    console.error('Google Sheets sync failed:', result);
                    return { success: false, reason: result.error || 'Unknown error' };
                }
            } catch (parseError) {
                console.error('Failed to parse response:', parseError);
                return { success: false, reason: `Invalid response: ${resultText}` };
            }
        } catch (error) {
            // Detect CORS-specific errors
            const isCorsError = error.message.includes('CORS') ||
                               error.message.includes('fetch') ||
                               error.name === 'TypeError';

            if (isCorsError) {
                console.warn('⚠️ CORS error detected. This usually means:\n' +
                           '1. Google Apps Script needs to be redeployed\n' +
                           '2. The script needs CORS headers (doOptions function)\n' +
                           '3. Using JSONP fallback which works but is slower');
            }

            console.log('Fetch failed, trying JSONP fallback:', error.message);
            // Fallback to JSONP which bypasses CORS
            return await this.syncToGoogleSheetsJSONP(type, description, duration);
        }
    }

    showSetupModal() {
        if (this.setupModal) {
            this.setupModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    hideSetupModal() {
        if (this.setupModal) {
            this.setupModal.classList.add('hidden');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    copyCodeToClipboard(code) {
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                // Update button text temporarily
                const originalText = this.copyScriptBtn.innerHTML;
                this.copyScriptBtn.innerHTML = '✅ Copied to Clipboard!';
                this.copyScriptBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';

                setTimeout(() => {
                    this.copyScriptBtn.innerHTML = originalText;
                    this.copyScriptBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                }, 2000);

                this.addActivity('📋 Apps Script code copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy to clipboard:', err);
                this.fallbackCopyMethod(code);
            });
        } else {
            this.fallbackCopyMethod(code);
        }
    }

    copyAppsScript() {
        // Try to read the updated file first
        fetch('./google-apps-script.js')
            .then(response => response.text())
            .then(appsScriptCode => {
                this.copyCodeToClipboard(appsScriptCode);
            })
            .catch(error => {
                console.error('Could not load Google Apps Script file:', error);
                alert('Could not load the latest Google Apps Script code. Please check the google-apps-script.js file in your project directory.');
            });
    }

    fallbackCopyMethod(text) {
        // Fallback: Create textarea and select text
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            this.copyScriptBtn.innerHTML = '✅ Copied to Clipboard!';
            setTimeout(() => {
                this.copyScriptBtn.innerHTML = '📋 Copy Apps Script Code';
            }, 2000);
            this.addActivity('📋 Apps Script code copied to clipboard');
        } catch (err) {
            alert('Copy failed. Please copy the code manually from the google-apps-script.js file.');
        }

        document.body.removeChild(textarea);
    }

    testConnection() {
        this.testGoogleSheetsConnection();
    }

    sendReport() {
        if (!this.userEmail) {
            alert('Please set your email in settings first!');
            this.toggleSettings();
            return;
        }

        const report = this.generateReport();
        const today = new Date();
        const dateFormatted = today.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const subject = `🍅 Pomodoro Report - ${dateFormatted}`;

        // Add Google Sheets status to report
        let sheetsInfo = '';
        if (this.googleSheetsWebhook) {
            sheetsInfo = `\n\n📊 GOOGLE SHEETS INTEGRATION:\n`;
            sheetsInfo += `✅ Automatic sync enabled\n`;
            sheetsInfo += `✅ Data automatically updates your Google Sheet\n`;
            sheetsInfo += `\nNo manual action required - everything syncs in real-time!\n`;
        } else {
            sheetsInfo = `\n\n📊 GOOGLE SHEETS:\n`;
            sheetsInfo += `⚠️ Automatic sync not configured\n`;
            sheetsInfo += `Click 'Setup Instructions' in settings to enable automatic sync.\n`;
        }

        const enhancedReport = report + sheetsInfo;

        const mailtoLink = `mailto:${this.userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(enhancedReport)}`;

        window.open(mailtoLink);
        this.addActivity('📧 Daily report sent' + (this.googleSheetsWebhook ? ' (auto-sync enabled)' : ''));
    }

    async debugSync() {
        console.log('🔧 DEBUG SYNC STARTED');
        console.log('Device ID:', this.deviceId);
        console.log('Webhook URL:', this.googleSheetsWebhook);
        console.log('Current tasks:', this.tasks);

        if (!this.googleSheetsWebhook) {
            alert('❌ No webhook URL configured!\nPlease add your Google Apps Script webhook URL in settings.');
            return;
        }

        // Test connection first
        try {
            console.log('Testing connection...');
            const response = await fetch(this.googleSheetsWebhook);
            const result = await response.text();
            console.log('Connection test result:', result);
            this.addActivity('🔧 Connection test: ' + (response.ok ? 'OK' : 'Failed'));
        } catch (error) {
            console.error('Connection test failed:', error);
            this.addActivity('🔧 Connection test failed: ' + error.message);
        }

        // Test task sync if we have tasks
        if (this.tasks.length > 0) {
            console.log('Testing task sync...');
            const result = await this.syncAllTasksToServer();
            console.log('Task sync result:', result);
            this.addActivity('🔧 Task sync test: ' + (result.success ? 'Success' : result.reason));
        } else {
            console.log('No tasks to sync');
            this.addActivity('🔧 No tasks to sync');
        }

        // Test get tasks
        console.log('Testing get tasks...');
        const getResult = await this.getTasksFromServer();
        console.log('Get tasks result:', getResult);
        this.addActivity('🔧 Get tasks test: ' + (getResult.success ? `Found ${getResult.tasks?.length || 0} tasks` : getResult.reason));

        // Show current state for debugging
        console.log('Current deleted task IDs:', Array.from(this.deletedTaskIds));
        console.log('Current completed tasks:', this.completedTasks.map(t => ({id: t.id, text: t.text})));

        alert('Debug sync completed! Check the console (F12) and activity log for details.');

        // Additional debugging info
        if (this.deletedTaskIds.size > 0) {
            console.log('📋 Deleted task IDs being tracked:', Array.from(this.deletedTaskIds));
        }
    }

    handleSyncButtonClick() {
        if (!this.googleSheetsWebhook) {
            // No webhook configured, show setup instructions
            this.showSetupModal();
        } else {
            // Webhook configured, perform sync
            this.manualSync();
        }
    }

    updateSyncButton() {
        if (!this.googleSheetsWebhook) {
            this.syncNowBtn.textContent = '⚙️ Sync Setup';
            this.syncNowBtn.title = 'Configure Google Sheets sync';
        } else {
            this.syncNowBtn.textContent = '🔄 Sync Now';
            this.syncNowBtn.title = 'Manually sync with Google Sheets';
        }
    }

    async manualSync() {
        if (this.syncLocks.full) {
            console.log('Sync already in progress');
            return;
        }

        // Update both status indicators
        this.updateSyncStatus('syncing');
        if (this.statsSyncText) {
            this.statsSyncText.textContent = 'Syncing...';
        }

        // Perform full sync (includes task sync + stats sync)
        await this.performFullSync();

        // Also sync activity log
        await this.syncTodayData();

        // Show success message with details (using UTC for consistency)
        const today = getTodayUTC();
        const completedCount = this.completedTasks.filter(t =>
            getDateUTC(t.completedAt) === today
        ).length;
        const sessionsCount = this.workSessions.filter(s =>
            getDateUTC(s.completedAt) === today
        ).length;

        console.log(`✅ Manual sync completed! Today's stats: ${completedCount} tasks, ${sessionsCount} sessions`);
    }

    startPeriodicSync() {
        // Initial sync on app start (after a short delay to let UI load)
        setTimeout(() => {
            this.performFullSync();
        }, PomodoroTimer.INITIAL_SYNC_DELAY);

        // Schedule periodic sync every 60 seconds
        this.syncTimer = setInterval(() => {
            if (!this.syncLocks.full) {
                this.performFullSync();
            }
        }, PomodoroTimer.SYNC_INTERVAL);
    }

    scheduleDailyReport() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 0, 0);

        const timeUntilReport = tomorrow.getTime() - now.getTime();

        setTimeout(() => {
            if (this.userEmail) {
                this.sendReport();
            }
            // Schedule next day
            this.scheduleDailyReport();
        }, timeUntilReport);
    }

    scheduleMidnightReset() {
        // Use periodic checking instead of long setTimeout for reliability
        // Check every 5 minutes if the date has changed
        if (this.dateCheckInterval) {
            clearInterval(this.dateCheckInterval);
        }

        console.log('Scheduling periodic date checks for midnight reset');

        this.dateCheckInterval = setInterval(() => {
            const newDate = new Date().toDateString();

            if (newDate !== this.currentDate) {
                // Date has changed - trigger midnight reset
                console.log('Date changed detected:', this.currentDate, '->', newDate);

                this.currentDate = newDate;

                // Refresh the UI to show new day's stats
                this.updateStats();
                this.updateActivityLog();

                // Add activity notification
                this.addActivity('📅 New day started - stats reset');
                // Play daily reset sound
                if (window.alertSoundManager) {
                    window.alertSoundManager.playSound('daily-reset');
                } else {
                    this.playSound('daily-reset');
                }


                // Show notification if enabled
                this.showNotification(
                    '📅 New Day!',
                    'Your daily stats have been reset. Have a productive day!',
                    '🌅'
                );

                console.log('Midnight reset triggered - new day:', this.currentDate);
            }
        }, PomodoroTimer.DATE_CHECK_INTERVAL);
    }

    // Process batched sync operations
    async processSyncBatch(operations) {
        console.log(`Processing sync batch with ${operations.length} operations`);

        // Group operations by type
        const syncTasks = operations.filter(op => op.type === 'sync_task').map(op => op.data);
        const deleteTasks = operations.filter(op => op.type === 'delete_task').map(op => op.data);
        const syncCompletedTasks = operations.filter(op => op.type === 'sync_completed_task').map(op => op.data);
        const syncWorkSessions = operations.filter(op => op.type === 'sync_work_session').map(op => op.data);
        const syncArchivedTasks = operations.filter(op => op.type === 'sync_archived_task').map(op => op.data);

        // Sync all active tasks in one batch
        if (syncTasks.length > 0) {
            console.log(`Syncing ${syncTasks.length} active tasks...`);
            try {
                await this.syncAllTasksToServer();
            } catch (error) {
                console.error('Error syncing active tasks:', error);
            }
        }

        // Sync completed tasks in one batch
        if (syncCompletedTasks.length > 0) {
            console.log(`Syncing ${syncCompletedTasks.length} completed tasks...`);
            try {
                await this.syncCompletedTasksToServer(syncCompletedTasks);
            } catch (error) {
                console.error('Error syncing completed tasks:', error);
            }
        }

        // Sync work sessions in one batch
        if (syncWorkSessions.length > 0) {
            console.log(`Syncing ${syncWorkSessions.length} work sessions...`);
            try {
                await this.syncWorkSessionsToServer(syncWorkSessions);
            } catch (error) {
                console.error('Error syncing work sessions:', error);
            }
        }

        // Sync archived tasks in one batch
        if (syncArchivedTasks.length > 0) {
            console.log(`Syncing ${syncArchivedTasks.length} archived tasks...`);
            try {
                await this.syncArchivedTasksToServer(syncArchivedTasks);
            } catch (error) {
                console.error('Error syncing archived tasks:', error);
            }
        }

        // Delete tasks from server
        for (const taskId of deleteTasks) {
            try {
                await this.deleteTaskFromServer(taskId);
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    }

    async syncCompletedTasksToServer(completedTasks) {
        if (!this.googleSheetsWebhook || completedTasks.length === 0) {
            return { success: false, reason: 'No webhook configured or no tasks to sync' };
        }

        const data = {
            action: 'sync_completed_tasks',
            completedTasks: completedTasks,
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    async syncWorkSessionsToServer(workSessions) {
        if (!this.googleSheetsWebhook || workSessions.length === 0) {
            return { success: false, reason: 'No webhook configured or no sessions to sync' };
        }

        const data = {
            action: 'sync_work_sessions',
            workSessions: workSessions,
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    async syncArchivedTasksToServer(archivedTasks) {
        if (!this.googleSheetsWebhook || archivedTasks.length === 0) {
            return { success: false, reason: 'No webhook configured or no tasks to sync' };
        }

        const data = {
            action: 'sync_archived_tasks',
            archivedTasks: archivedTasks,
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    async getArchivedTasksFromServer() {
        if (!this.googleSheetsWebhook) {
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
            action: 'get_archived_tasks',
            deviceId: this.deviceId
        };

        return await this.performApiCall(data);
    }

    mergeArchivedTasks(serverTasks) {
        // Create map of local tasks by ID for fast lookup
        const localMap = new Map(this.archivedTasks.map(t => [t.id, t]));

        let addedCount = 0;

        // Add server tasks that aren't in local storage
        for (const serverTask of serverTasks) {
            if (!localMap.has(serverTask.id)) {
                this.archivedTasks.push(serverTask);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            // Sort by archive time (newest first)
            this.archivedTasks.sort((a, b) =>
                new Date(b.archivedAt) - new Date(a.archivedAt)
            );
            console.log(`Added ${addedCount} archived tasks from server`);
            // Persist changes to localStorage
            this.saveData();
        }
    }

    // Bulk Selection Methods
    toggleBulkSelection() {
        this.bulkSelectionMode = !this.bulkSelectionMode;

        if (this.bulkSelectionMode) {
            this.enterBulkSelectionMode();
        } else {
            this.exitBulkSelectionMode();
        }
    }

    enterBulkSelectionMode() {
        this.bulkSelectToggle.classList.add('active');
        this.bulkSelectToggle.textContent = '✖️ Cancel Selection';
        this.bulkActionsBar.classList.remove('hidden');
        this.selectedTaskIds.clear();
        this.updateSelectedCount();
        this.renderTasks();
    }

    exitBulkSelectionMode() {
        this.bulkSelectionMode = false;
        this.bulkSelectToggle.classList.remove('active');
        this.bulkSelectToggle.textContent = '☑️ Select Tasks';
        this.bulkActionsBar.classList.add('hidden');
        this.selectedTaskIds.clear();
        this.selectAllTasks.checked = false;
        this.renderTasks();
    }

    cancelBulkSelection() {
        this.exitBulkSelectionMode();
    }

    handleSelectAll(checked) {
        if (checked) {
            this.tasks.forEach(task => this.selectedTaskIds.add(task.id));
        } else {
            this.selectedTaskIds.clear();
        }
        this.updateSelectedCount();
        this.renderTasks();
    }

    handleTaskCheckbox(taskId, checked) {
        if (checked) {
            this.selectedTaskIds.add(taskId);
        } else {
            this.selectedTaskIds.delete(taskId);
        }

        // Update "select all" checkbox state
        this.selectAllTasks.checked = this.selectedTaskIds.size === this.tasks.length;
        this.selectAllTasks.indeterminate = this.selectedTaskIds.size > 0 && this.selectedTaskIds.size < this.tasks.length;

        this.updateSelectedCount();
        this.renderTasks();
    }

    updateSelectedCount() {
        const count = this.selectedTaskIds.size;
        this.selectedCount.textContent = `${count} selected`;

        // Disable bulk action buttons if nothing selected
        this.bulkDeleteBtn.disabled = count === 0;
        this.bulkArchiveBtn.disabled = count === 0;
    }

    bulkDeleteTasks() {
        if (this.selectedTaskIds.size === 0) return;

        const count = this.selectedTaskIds.size;
        const confirmed = confirm(`Delete ${count} task${count > 1 ? 's' : ''}? This cannot be undone.`);

        if (!confirmed) return;

        // Delete each selected task
        this.selectedTaskIds.forEach(taskId => {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                // Add to deleted tasks tracking
                this.deletedTaskIds.set(taskId, Date.now());

                // Queue delete sync
                this.syncQueue.enqueue({
                    type: 'delete_task',
                    data: { taskId, timestamp: Date.now() }
                });
            }
        });

        // Remove from tasks array
        this.tasks = this.tasks.filter(t => !this.selectedTaskIds.has(t.id));

        this.addActivity(`🗑️ Bulk deleted ${count} task${count > 1 ? 's' : ''}`);
        this.exitBulkSelectionMode();
        this.saveData();
        this.saveDeletedTaskIds();
        this.renderTasks();
    }

    bulkArchiveTasks() {
        if (this.selectedTaskIds.size === 0) return;

        const count = this.selectedTaskIds.size;
        const confirmed = confirm(`Archive ${count} task${count > 1 ? 's' : ''}? They will be moved to archived tasks.`);

        if (!confirmed) return;

        // Archive each selected task
        this.selectedTaskIds.forEach(taskId => {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                // Add to archived tasks
                const archivedTask = {
                    ...task,
                    archivedAt: new Date().toISOString()
                };
                this.archivedTasks.push(archivedTask);

                // Add to deleted tasks tracking (prevents re-adding from server)
                this.deletedTaskIds.set(taskId, Date.now());

                // Queue archived task sync to server
                this.syncQueue.enqueue({
                    type: 'sync_archived_task',
                    data: archivedTask
                });

                // Also delete from active tasks sheet on server
                this.syncQueue.enqueue({
                    type: 'delete_task',
                    data: { taskId, timestamp: Date.now() }
                });
            }
        });

        // Remove from active tasks array
        this.tasks = this.tasks.filter(t => !this.selectedTaskIds.has(t.id));

        this.addActivity(`📦 Bulk archived ${count} task${count > 1 ? 's' : ''}`);
        this.exitBulkSelectionMode();
        this.saveData();
        this.saveDeletedTaskIds();
        this.renderTasks();
    }

    // Cleanup method to prevent memory leaks
    cleanup() {
        console.log('Cleaning up Pomodoro Timer resources...');

        // Clear all intervals
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.dateCheckInterval) {
            clearInterval(this.dateCheckInterval);
            this.dateCheckInterval = null;
        }

        // Clear all timeouts
        if (this.midnightResetTimer) {
            clearTimeout(this.midnightResetTimer);
            this.midnightResetTimer = null;
        }
        if (this.dailyReportTimer) {
            clearTimeout(this.dailyReportTimer);
            this.dailyReportTimer = null;
        }

        // Terminate Web Worker
        if (this.worker) {
            this.worker.postMessage({ action: 'stop' });
            this.worker = null;
        }

        // Revoke blob URL
        if (this.workerBlobURL) {
            URL.revokeObjectURL(this.workerBlobURL);
            this.workerBlobURL = null;
        }

        // Release wake lock
        this.releaseWakeLock();

        // Clear sync queue
        if (this.syncQueue) {
            this.syncQueue.clear();
        }

        // Note: We don't remove event listeners here because they're on global objects
        // and removing them would require storing references to the listener functions
        // For a full cleanup in an SPA, consider using a more sophisticated event management system

        console.log('Cleanup complete');
    }
}

// ============================================================================
// Alert Sound Manager - Custom Alert Sounds System
// ============================================================================

class AlertSoundManager {
    constructor() {
        this.dbName = 'PomodoroAlertSounds';
        this.dbVersion = 1;
        this.storeName = 'sounds';
        this.db = null;

        // Sound types and their default configurations
        this.soundTypes = {
            'short-break': {
                file: null,
                volume: 1.0,
                duration: 5000,
                enabled: true,
                name: 'Short Break Alert'
            },
            'long-break': {
                file: null,
                volume: 1.0,
                duration: 5000,
                enabled: true,
                name: 'Long Break Alert'
            },
            'work-start': {
                file: null,
                volume: 1.0,
                duration: 5000,
                enabled: true,
                name: 'Work Start Alert'
            },
            'task-complete': {
                file: null,
                volume: 0.8,
                duration: 3000,
                enabled: true,
                name: 'Task Complete Alert'
            },
            'daily-reset': {
                file: null,
                volume: 0.7,
                duration: 3000,
                enabled: true,
                name: 'Daily Reset Alert'
            }
        };

        // Default alarm sound (embedded in HTML)
        this.defaultAlarmSound = document.getElementById('alarmSound');

        // Cache for loaded audio elements
        this.audioCache = {};

        this.initDB();
    }

    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('AlertSoundManager: IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'type' });
                    console.log('AlertSoundManager: Object store created');
                }
            };
        });
    }

    // Load sound configuration from IndexedDB
    async loadSound(type) {
        if (!this.soundTypes[type]) {
            console.error('Invalid sound type:', type);
            return null;
        }

        try {
            await this.ensureDBReady();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(type);

                request.onsuccess = () => {
                    if (request.result) {
                        // Merge with defaults
                        this.soundTypes[type] = {
                            ...this.soundTypes[type],
                            ...request.result
                        };
                        resolve(request.result);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error('Failed to load sound:', type, request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error loading sound:', type, error);
            return null;
        }
    }

    // Save sound configuration to IndexedDB
    async saveSound(type, file, volume, duration, enabled = true) {
        if (!this.soundTypes[type]) {
            throw new Error(`Invalid sound type: ${type}`);
        }

        // Validate file size (max 5MB)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file && file.size > MAX_SIZE) {
            throw new Error(`File too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        }

        try {
            await this.ensureDBReady();

            let audioData = null;
            if (file) {
                // Convert file to base64
                audioData = await this.fileToBase64(file);
            }

            const soundConfig = {
                type,
                file: audioData,
                fileName: file ? file.name : null,
                volume: parseFloat(volume),
                duration: parseInt(duration),
                enabled: Boolean(enabled)
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(soundConfig);

                request.onsuccess = () => {
                    // Update in-memory config
                    this.soundTypes[type] = {
                        ...this.soundTypes[type],
                        ...soundConfig
                    };

                    // Clear audio cache for this type
                    delete this.audioCache[type];

                    console.log('Sound saved successfully:', type);
                    resolve(soundConfig);
                };

                request.onerror = () => {
                    console.error('Failed to save sound:', type, request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error saving sound:', type, error);
            throw error;
        }
    }

    // Play sound by type
    async playSound(type) {
        if (!this.soundTypes[type]) {
            console.error('Invalid sound type:', type);
            return;
        }

        // Try to load sound config from DB
        await this.loadSound(type);

        const config = this.soundTypes[type];

        if (!config.enabled) {
            console.log('Sound disabled:', type);
            return;
        }

        console.log('Playing sound:', type, 'config:', config);

        try {
            let audio;

            if (config.file) {
                // Use custom sound
                if (!this.audioCache[type]) {
                    audio = new Audio(config.file);
                    this.audioCache[type] = audio;
                } else {
                    audio = this.audioCache[type];
                }
            } else {
                // Use default alarm sound
                audio = this.defaultAlarmSound;
                audio.currentTime = 0;
            }

            // Volume is 0-1, duration is in milliseconds
            audio.volume = typeof config.volume === 'number' ? config.volume : 1.0;
            audio.loop = true;

            console.log('Audio element:', audio, 'Volume:', audio.volume, 'Duration:', config.duration);

            // Play audio
            await audio.play().catch(e => {
                console.log('Audio play failed:', e);
                throw e;
            });

            console.log('Audio playing...');

            // Stop after duration (duration is in milliseconds)
            const duration = config.duration || 5000;
            setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.loop = false;
                console.log('Audio stopped after', duration, 'ms');
            }, duration);

        } catch (error) {
            console.error('Error playing sound:', type, error);
            // Fallback to default alarm
            this.playDefaultAlarm(config.duration);
        }
    }

    // Test sound (for UI preview)
    async testSound(type) {
        await this.playSound(type);
    }

    // Reset to default (remove custom sound)
    async resetToDefault(type) {
        if (!this.soundTypes[type]) {
            throw new Error(`Invalid sound type: ${type}`);
        }

        // Define default configurations for each sound type
        const defaults = {
            'short-break': { volume: 1.0, duration: 5000 },
            'long-break': { volume: 1.0, duration: 5000 },
            'work-start': { volume: 1.0, duration: 5000 },
            'task-complete': { volume: 0.8, duration: 3000 },
            'daily-reset': { volume: 0.7, duration: 3000 }
        };

        try {
            await this.ensureDBReady();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(type);

                request.onsuccess = () => {
                    // Reset in-memory config to defaults
                    const defaultConfig = defaults[type] || { volume: 1.0, duration: 5000 };
                    this.soundTypes[type] = {
                        ...this.soundTypes[type],
                        file: null,
                        fileName: null,
                        volume: defaultConfig.volume,
                        duration: defaultConfig.duration
                    };

                    // Clear audio cache
                    delete this.audioCache[type];

                    console.log('Sound reset to default:', type);
                    resolve();
                };

                request.onerror = () => {
                    console.error('Failed to reset sound:', type, request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error resetting sound:', type, error);
            throw error;
        }
    }

    // Helper: Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Helper: Ensure DB is ready
    async ensureDBReady() {
        if (!this.db) {
            await this.initDB();
        }
    }

    // Fallback to default alarm
    playDefaultAlarm(duration = 5000) {
        const audio = this.defaultAlarmSound;
        audio.volume = 1.0;
        audio.loop = true;
        audio.currentTime = 0;

        audio.play().catch(e => console.log('Default alarm play failed:', e));

        setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.loop = false;
        }, duration);
    }
}

// Global instance and function for Console 1
let alertSoundManager;

function playAlertSound(type) {
    if (!alertSoundManager) {
        console.error('AlertSoundManager not initialized');
        return;
    }
    alertSoundManager.playSound(type);
}

// Toast notification system
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}


// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.pomodoroTimer = new PomodoroTimer();
    alertSoundManager = new AlertSoundManager();
    window.alertSoundManager = alertSoundManager; // Expose globally
});