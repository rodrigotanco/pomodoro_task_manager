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

        this.initializeElements();
        this.loadData();
        this.requestNotificationPermission();
        this.bindEvents();
        this.updateDisplay();
        this.scheduleDailyReport();
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
        this.activityList = document.getElementById('activityList');

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
        this.syncNowBtn.addEventListener('click', () => this.syncTodayData());

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

    loadData() {
        const savedData = localStorage.getItem('pomodoroData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.tasks = data.tasks || [];
            this.completedTasks = data.completedTasks || [];
            this.workSessions = data.workSessions || [];
            this.sessionCount = data.sessionCount || 0;
            this.userEmail = data.userEmail || '';
            this.notificationsEnabled = data.notificationsEnabled !== undefined ? data.notificationsEnabled : true;
            this.googleSheetsWebhook = data.googleSheetsWebhook || '';
            this.workDuration = data.workDuration || 25 * 60;
            this.breakDuration = data.breakDuration || 5 * 60;

            // Update UI with loaded data
            this.workDurationInput.value = this.workDuration / 60;
            this.breakDurationInput.value = this.breakDuration / 60;
            this.userEmailInput.value = this.userEmail;
            this.enableNotificationsInput.checked = this.notificationsEnabled;
            this.googleSheetsWebhookInput.value = this.googleSheetsWebhook;
        }
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
            lastSave: new Date().toISOString()
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

        const task = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.taskInput.value = '';
        this.renderTasks();
        this.saveData();
        this.addActivity(`📝 Added task: ${text}`);
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
            task.completed = true;
            task.completedAt = new Date().toISOString();

            this.completedTasks.push(task);
            this.tasks.splice(taskIndex, 1);

            // Create confetti animation
            console.log('Task completed - triggering confetti for:', task.text);
            this.createConfetti();

            // Sync completed task to Google Sheets
            this.syncToGoogleSheets('Task', task.text)
                .then(result => {
                    if (result.success) {
                        this.addActivity(`✅ Task synced to Google Sheets: ${task.text}`);
                    } else {
                        console.log('Google Sheets sync failed for task:', result.reason);
                    }
                });

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

    deleteTask(taskId, event) {
        event.stopPropagation();

        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = this.tasks[taskIndex];
            this.tasks.splice(taskIndex, 1);

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

    async syncToGoogleSheets(type, description, duration = null) {
        if (!this.googleSheetsWebhook) {
            console.log('No Google Sheets webhook configured');
            return { success: false, reason: 'No webhook configured' };
        }

        const data = {
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

    copyAppsScript() {
        const appsScriptCode = `// Google Apps Script code for automatic Pomodoro data sync
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
}`;

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(appsScriptCode).then(() => {
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
                this.fallbackCopyMethod(appsScriptCode);
            });
        } else {
            this.fallbackCopyMethod(appsScriptCode);
        }
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