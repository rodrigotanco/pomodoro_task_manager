class PomodoroTimer {
    constructor() {
        this.workDuration = 25 * 60; // 25 minutes in seconds
        this.breakDuration = 5 * 60; // 5 minutes in seconds
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

        // Device identification and sync management
        this.deviceId = this.generateDeviceId();
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.syncTimer = null;
        this.deletedTaskIds = new Set(); // Track recently deleted/completed task IDs

        this.initializeElements();
        this.loadData();
        this.requestNotificationPermission();
        this.bindEvents();
        this.updateDisplay();
        this.scheduleDailyReport();
        this.startPeriodicSync();
    }

    initializeElements() {
        // Timer elements
        this.timeDisplay = document.getElementById('timeLeft');
        this.sessionTypeDisplay = document.getElementById('sessionType');
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
        this.debugSyncBtn = document.getElementById('debugSyncBtn');
        this.activityList = document.getElementById('activityList');

        // Sync status elements
        this.syncStatusIndicator = document.getElementById('syncStatusIndicator');
        this.syncStatusIcon = document.getElementById('syncStatusIcon');
        this.syncStatusText = document.getElementById('syncStatusText');
        this.syncLastTime = document.getElementById('syncLastTime');

        // Audio element
        this.alarmSound = document.getElementById('alarmSound');
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
        this.syncNowBtn.addEventListener('click', () => this.manualSync());
        this.debugSyncBtn.addEventListener('click', () => this.debugSync());

        // Google Sheets setup
        this.setupGoogleSheetsBtn.addEventListener('click', () => this.showSetupModal());

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

        // Auto-save data periodically
        setInterval(() => this.saveData(), 30000); // Save every 30 seconds
    }

    generateDeviceId() {
        let deviceId = localStorage.getItem('pomodoroDeviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('pomodoroDeviceId', deviceId);
        }
        return deviceId;
    }

    isTaskCompleted(taskId) {
        // Check if task is in completed tasks array
        const isInCompletedTasks = this.completedTasks.some(task => task.id == taskId);

        // Check if task is in recently deleted IDs
        const isRecentlyDeleted = this.deletedTaskIds.has(taskId);

        return isInCompletedTasks || isRecentlyDeleted;
    }

    addToDeletedTasks(taskId) {
        this.deletedTaskIds.add(taskId);

        // Clean up old deleted task IDs (keep only last 24 hours worth)
        this.cleanupDeletedTasks();

        // Save to localStorage for persistence
        this.saveDeletedTaskIds();
    }

    cleanupDeletedTasks() {
        // For now, keep deleted IDs simple - we can enhance later with timestamps
        // Limit to 100 recent deletions to prevent memory bloat
        if (this.deletedTaskIds.size > 100) {
            const idsArray = Array.from(this.deletedTaskIds);
            this.deletedTaskIds = new Set(idsArray.slice(-50)); // Keep last 50
        }
    }

    saveDeletedTaskIds() {
        const deletedIds = Array.from(this.deletedTaskIds);
        localStorage.setItem('pomodoroDeletedTaskIds', JSON.stringify(deletedIds));
    }

    loadDeletedTaskIds() {
        const savedDeletedIds = localStorage.getItem('pomodoroDeletedTaskIds');
        if (savedDeletedIds) {
            const idsArray = JSON.parse(savedDeletedIds);
            this.deletedTaskIds = new Set(idsArray);
        }
    }

    loadData() {
        const savedData = localStorage.getItem('pomodoroData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.tasks = (data.tasks || []).map(task => ({
                ...task,
                lastModified: task.lastModified || task.createdAt || new Date().toISOString(),
                deviceId: task.deviceId || this.deviceId
            }));
            this.completedTasks = data.completedTasks || [];
            this.workSessions = data.workSessions || [];
            this.sessionCount = data.sessionCount || 0;
            this.userEmail = data.userEmail || '';
            this.notificationsEnabled = data.notificationsEnabled !== undefined ? data.notificationsEnabled : true;
            this.googleSheetsWebhook = data.googleSheetsWebhook || '';
            this.workDuration = data.workDuration || 25 * 60;
            this.breakDuration = data.breakDuration || 5 * 60;
            this.lastSyncTime = data.lastSyncTime || null;

            // Update UI with loaded data
            this.workDurationInput.value = this.workDuration / 60;
            this.breakDurationInput.value = this.breakDuration / 60;
            this.userEmailInput.value = this.userEmail;
            this.enableNotificationsInput.checked = this.notificationsEnabled;
            this.googleSheetsWebhookInput.value = this.googleSheetsWebhook;
        }

        // Load deleted task IDs
        this.loadDeletedTaskIds();

        this.renderTasks();
        this.updateStats();
        this.updateActivityLog();
    }

    saveData() {
        const data = {
            tasks: this.tasks,
            completedTasks: this.completedTasks,
            workSessions: this.workSessions,
            sessionCount: this.sessionCount,
            userEmail: this.userEmail,
            notificationsEnabled: this.notificationsEnabled,
            googleSheetsWebhook: this.googleSheetsWebhook,
            workDuration: this.workDuration,
            breakDuration: this.breakDuration,
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
        this.userEmail = this.userEmailInput.value;
        this.notificationsEnabled = this.enableNotificationsInput.checked;
        this.googleSheetsWebhook = this.googleSheetsWebhookInput.value;

        // Update current session if not running
        if (!this.isRunning) {
            this.currentDuration = this.isWorkSession ? this.workDuration : this.breakDuration;
            this.timeLeft = this.currentDuration;
            this.updateDisplay();
        }

        this.saveData();
        this.settingsPanel.classList.add('hidden');
        this.addActivity('⚙️ Settings updated');
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

    startTimer() {
        // Prevent starting work session without a selected task
        if (this.isWorkSession && !this.selectedTaskId) {
            alert('Please select a task before starting a work session!');
            return;
        }

        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;

        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();

            if (this.timeLeft <= 0) {
                this.completeSession();
            }
        }, 1000);

        if (this.isWorkSession && this.selectedTaskId) {
            const task = this.tasks.find(t => t.id === this.selectedTaskId);
            this.addActivity(`🍅 Started work session: ${task.text}`);
        } else {
            this.addActivity('☕ Started break');
        }
    }

    pauseTimer() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        clearInterval(this.timer);
        this.addActivity('⏸️ Timer paused');
    }

    resetTimer() {
        this.isRunning = false;
        this.startBtn.disabled = this.isWorkSession && !this.selectedTaskId;
        this.pauseBtn.disabled = true;
        clearInterval(this.timer);

        this.currentDuration = this.isWorkSession ? this.workDuration : this.breakDuration;
        this.timeLeft = this.currentDuration;
        this.updateDisplay();
        this.addActivity('🔄 Timer reset');
    }

    completeCurrentTask() {
        if (!this.isWorkSession || !this.selectedTaskId) {
            return;
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
        clearInterval(this.timer);
        this.alarmSound.play().catch(e => console.log('Audio play failed:', e));

        // Show notifications
        if (this.isWorkSession) {
            const task = this.tasks.find(t => t.id === this.selectedTaskId);
            const taskName = task ? task.text : 'Unknown task';
            this.showNotification(
                '🍅 Work Session Complete!',
                `Time for a break! You finished working on: ${taskName}`,
                '✅'
            );
        } else {
            this.showNotification(
                '☕ Break Complete!',
                'Time to get back to work! Select a task and start a new session.',
                '💪'
            );
        }

        if (this.isWorkSession) {
            this.sessionCount++;
            const task = this.tasks.find(t => t.id === this.selectedTaskId);

            // Record work session
            const workSession = {
                id: Date.now(),
                taskId: this.selectedTaskId,
                taskText: task ? task.text : 'Unknown task',
                duration: this.workDuration,
                completedAt: new Date().toISOString()
            };
            this.workSessions.push(workSession);

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
            if (task && !task.completed) {
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
            }

            // Switch to break
            this.isWorkSession = false;
            this.currentDuration = this.breakDuration;
        } else {
            this.addActivity('✅ Break completed');

            // Switch to work
            this.isWorkSession = true;
            this.currentDuration = this.workDuration;
        }

        this.timeLeft = this.currentDuration;
        this.startBtn.disabled = this.isWorkSession && !this.selectedTaskId;
        this.pauseBtn.disabled = true;
        this.updateDisplay();
        this.updateStats();
        this.saveData();
    }

    updateDisplay() {
        // Update time display
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update session type
        this.sessionTypeDisplay.textContent = this.isWorkSession ? 'Work Session' : 'Break Time';

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

    addTask() {
        const text = this.taskInput.value.trim();
        if (!text) return;

        const now = new Date().toISOString();
        const task = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: now,
            lastModified: now,
            deviceId: this.deviceId
        };

        this.tasks.push(task);
        this.taskInput.value = '';
        this.renderTasks();
        this.saveData();
        this.addActivity(`📝 Added task: ${text}`);

        // Trigger immediate sync for new task
        this.syncTaskToServer(task);
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

        // Check minimum time requirement (30 seconds)
        if (this.isRunning && this.isWorkSession && this.selectedTaskId === taskId) {
            const elapsedTime = this.currentDuration - this.timeLeft;
            if (elapsedTime < 30) {
                alert('You need to spend at least 30 seconds on a task before completing it!');
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
                        this.addActivity(`✅ Task synced to Google Sheets: ${task.text}`);
                    } else {
                        console.log('Google Sheets sync failed for task:', result.reason);
                    }
                });

            // Also remove from server tasks (since it's completed and moved to completedTasks)
            this.deleteTaskFromServer(taskId);

            // Clear selection if completed task was selected
            if (this.selectedTaskId === taskId) {
                this.selectedTaskId = null;
            }

            this.renderTasks();
            this.updateDisplay();
            this.updateStats();
            this.saveData();
            this.addActivity(`✅ Completed task: ${task.text}`);
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

        this.tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.id === this.selectedTaskId ? 'selected' : ''}`;
            taskElement.onclick = () => this.selectTask(task.id);

            // Create elements safely without innerHTML
            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.className = 'task-radio';
            radioInput.checked = task.id === this.selectedTaskId;
            radioInput.readOnly = true;

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

            taskElement.appendChild(radioInput);
            taskElement.appendChild(taskText);
            taskElement.appendChild(taskActions);

            this.tasksList.appendChild(taskElement);
        });
    }

    updateStats() {
        const today = new Date().toDateString();

        // Count today's completed tasks
        const todayTasks = this.completedTasks.filter(task =>
            new Date(task.completedAt).toDateString() === today
        ).length;

        // Count today's work sessions
        const todaySessions = this.workSessions.filter(session =>
            new Date(session.completedAt).toDateString() === today
        ).length;

        // Calculate today's focus time
        const todayFocusTime = this.workSessions
            .filter(session => new Date(session.completedAt).toDateString() === today)
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

        // Keep only last 20 activities
        const activities = JSON.parse(localStorage.getItem('pomodoroActivities') || '[]');
        activities.unshift(activity);
        activities.splice(20);

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

    async testGoogleSheetsConnection() {
        if (!this.googleSheetsWebhook) {
            alert('❌ No webhook URL configured!\nPlease add your Google Apps Script webhook URL in settings.');
            return;
        }

        try {
            console.log('Testing connection to:', this.googleSheetsWebhook);

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
                    'Content-Type': 'application/json',
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
            }, 10000);
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
                    'Content-Type': 'application/json',
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
        const response = await fetch(this.googleSheetsWebhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
            }, 10000);
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
            }, 10000);
        });
    }

    async performFullSync() {
        if (this.syncInProgress) {
            console.log('Sync already in progress, skipping');
            return;
        }

        this.syncInProgress = true;
        this.updateSyncStatus('syncing');

        try {
            // Get tasks from server
            const serverResult = await this.getTasksFromServer();

            if (serverResult.success) {
                // Merge tasks with conflict resolution
                const mergeResult = this.mergeTasks(serverResult.tasks);

                // If there were changes, sync back to server
                if (mergeResult.hasChanges) {
                    await this.syncAllTasksToServer();
                }

                this.lastSyncTime = new Date().toISOString();
                this.saveData();
                this.updateSyncStatus('synced');

                console.log('Full sync completed successfully');
            } else {
                console.error('Failed to get tasks from server:', serverResult.reason);
                this.updateSyncStatus('error');
            }
        } catch (error) {
            console.error('Full sync error:', error);
            this.updateSyncStatus('error');
        } finally {
            this.syncInProgress = false;
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
                // Task exists locally - check for conflicts
                const localTask = this.tasks.find(t => t.id === taskId);
                const serverModified = new Date(serverTask.lastModified);
                const localModified = new Date(localTask.lastModified);

                if (serverModified > localModified) {
                    // Server version is newer, update local
                    const index = mergedTasks.findIndex(t => t.id === taskId);
                    mergedTasks[index] = serverTask;
                    hasChanges = true;
                    console.log('🔄 Updated task with server version:', serverTask.text);
                    this.addActivity(`🔄 Updated task from another device: ${serverTask.text}`);
                } else if (serverModified < localModified) {
                    console.log('📍 Keeping local version (newer):', localTask.text);
                } else {
                    console.log('🟰 Tasks in sync:', localTask.text);
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
        try {
            const response = await fetch(this.googleSheetsWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
            console.log('Fetch failed, trying JSONP fallback:', error.message);
            // Fallback to JSONP for file:// protocol
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

    async manualSync() {
        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return;
        }

        // Perform both task sync and activity sync
        await this.performFullSync();
        await this.syncTodayData();
    }

    startPeriodicSync() {
        // Initial sync on app start (after a short delay to let UI load)
        setTimeout(() => {
            this.performFullSync();
        }, 2000);

        // Schedule periodic sync every 60 seconds
        this.syncTimer = setInterval(() => {
            if (!this.syncInProgress) {
                this.performFullSync();
            }
        }, 60000);
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
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.pomodoroTimer = new PomodoroTimer();
});