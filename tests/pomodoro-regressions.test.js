// Regression tests for the Pomodoro app bug fixes.
// Loads script.js in a vm with a stubbed DOM/localStorage (no dependencies).
// Run: node --test tests/pomodoro-regressions.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function makeEl(id = '') {
    const classes = new Set();
    const el = {
        id, children: [], style: {}, dataset: {}, value: '', checked: false,
        disabled: false, textContent: '', innerHTML: '',
        classList: {
            add: (...c) => c.forEach(x => classes.add(x)),
            remove: (...c) => c.forEach(x => classes.delete(x)),
            toggle: (c, force) => { const on = force === undefined ? !classes.has(c) : !!force; if (on) classes.add(c); else classes.delete(c); },
            contains: (c) => classes.has(c),
        },
        _classes: classes,
        _listeners: {},
        addEventListener: (type, fn) => { (el._listeners[type] ||= []).push(fn); },
        dispatch: (type, event = {}) => (el._listeners[type] || []).forEach(fn => fn({ stopPropagation() {}, ...event })),
        focus: () => {},
        select: () => {},
        appendChild: (c) => { el.children.push(c); return c; },
        append: (...cs) => cs.forEach(c => el.children.push(c)),
        remove: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        setAttribute: () => {},
        play: () => Promise.resolve(),
        pause: () => {},
    };
    return el;
}

function fakeRequest(result) {
    const req = { result };
    setTimeout(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
}

async function createApp(storageSeed = {}) {
    const els = {};
    const docListeners = {};
    const storage = { ...storageSeed };
    const dbStub = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
        transaction: () => ({
            objectStore: () => ({
                get: () => fakeRequest(null),
                put: () => fakeRequest(null),
                delete: () => fakeRequest(null),
            }),
        }),
    };
    class FakeWorker {
        constructor() { this.messages = []; }
        addEventListener() {}
        postMessage(m) { this.messages.push(m); }
    }
    const localStorage = {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; },
    };
    const sandbox = {
        console, setTimeout, clearTimeout, setInterval, clearInterval,
        Date, JSON, Math, Promise, URL, Blob: class {},
        localStorage, Worker: FakeWorker,
        indexedDB: { open: () => fakeRequest(dbStub) },
        navigator: {}, location: { href: '' },
        document: {
            getElementById: (id) => els[id] || (els[id] = makeEl(id)),
            querySelector: (sel) => els[`q:${sel}`] || (els[`q:${sel}`] = makeEl(sel)),
            querySelectorAll: () => [],
            createElement: () => makeEl(),
            addEventListener: (type, fn) => { docListeners[type] = fn; },
            body: makeEl('body'), head: makeEl('head'), hidden: false,
        },
        addEventListener: () => {}, removeEventListener: () => {},
        Audio: class { play() { return Promise.resolve(); } pause() {} },
        alert: () => {}, confirm: () => true,
        fetch: () => Promise.reject(new Error('offline')),
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SCRIPT, sandbox);
    await docListeners.DOMContentLoaded();
    const timer = sandbox.window.pomodoroTimer;
    assert.ok(timer, 'PomodoroTimer should instantiate');
    return { timer, els, storage, sandbox, docListeners, query: (sel) => els[`q:${sel}`] };
}

function cleanup(timer) {
    try { timer.cleanup(); } catch { /* best effort */ }
}

test('setup modal becomes visible (active) and hides again', async (t) => {
    const { timer, els } = await createApp();
    t.after(() => cleanup(timer));
    timer.showSetupModal();
    assert.ok(els.setupModal._classes.has('active'));
    timer.hideSetupModal();
    assert.ok(!els.setupModal._classes.has('active'));
});

test('sendReport without email opens settings instead of throwing', async (t) => {
    const { timer, els } = await createApp();
    t.after(() => cleanup(timer));
    timer.userEmail = '';
    assert.doesNotThrow(() => timer.sendReport());
    assert.ok(els.settingsModal._classes.has('active'));
});

test('reset during a long break restores the long-break duration', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.isWorkSession = false;
    timer.isLongBreak = true;
    timer.isRunning = false;
    timer.resetTimer();
    assert.strictEqual(timer.timeLeft, timer.longBreakDuration);
});

test('skipBreak stops the worker, clears startTime and long-break flag', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const worker = { messages: [], postMessage(m) { this.messages.push(m); } };
    timer.worker = worker;
    timer.isWorkSession = false;
    timer.isLongBreak = true;
    timer.isRunning = true;
    timer.startTime = Date.now();
    timer.skipBreak();
    assert.strictEqual(JSON.stringify(worker.messages), JSON.stringify([{ action: 'stop' }]));
    assert.strictEqual(timer.startTime, null);
    assert.strictEqual(timer.isLongBreak, false);
    assert.strictEqual(timer.isWorkSession, true);
});

test('saveSettings with empty duration keeps previous value (no NaN)', async (t) => {
    const { timer, els } = await createApp();
    t.after(() => cleanup(timer));
    timer.workDurationInput.value = '';
    timer.breakDurationInput.value = '5';
    timer.longBreakDurationInput.value = '15';
    timer.longBreakIntervalInput.value = '4';
    timer.isRunning = false;
    timer.isWorkSession = true;
    timer.saveSettings();
    assert.strictEqual(timer.workDuration, 25 * 60);
    assert.ok(!els.timeLeft.textContent.includes('NaN'));
});

test('loadData restores the saved pomodoro cycle counter', async (t) => {
    const seed = { pomodoroData: JSON.stringify({ tasks: [], completedPomodoros: 3, workDuration: 1500 }) };
    const { timer } = await createApp(seed);
    t.after(() => cleanup(timer));
    assert.strictEqual(timer.completedPomodoros, 3);
    assert.strictEqual(timer.consecutiveWorkSessions, 3);
});

test('corrupt pomodoroData does not prevent the app from starting', async (t) => {
    const { timer } = await createApp({ pomodoroData: '{bad json' });
    t.after(() => cleanup(timer));
    assert.ok(timer);
    assert.strictEqual(timer.tasks.length, 0);
});

test('completing a task before 30s records no work session', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.tasks = [{ id: 'task-1', text: 'Quick', completed: false, version: 1 }];
    timer.selectedTaskId = 'task-1';
    timer.isWorkSession = true;
    timer.isRunning = true;
    timer.startTime = Date.now();
    timer.currentDuration = 1500;
    timer.timeLeft = 1490; // only 10s elapsed
    timer.completeCurrentTask();
    assert.strictEqual(timer.workSessions.length, 0);
    assert.strictEqual(timer.tasks.length, 1);
    assert.strictEqual(timer.isRunning, true);
});

test('mergeTasks keeps local-only tasks when the server list is empty', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.tasks = [{ id: 'local-1', text: 'Offline task', completed: false, version: 1, createdAt: new Date().toISOString(), lastModified: new Date().toISOString(), deviceId: timer.deviceId }];
    const result = timer.mergeTasks([]);
    assert.strictEqual(timer.tasks.length, 1);
    assert.strictEqual(timer.tasks[0].id, 'local-1');
    assert.strictEqual(result.hasChanges, true); // kept tasks are re-uploaded
});

test('SyncQueue keeps operations queued when processing fails', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.syncQueue.processor = async () => { throw new Error('boom'); };
    timer.syncQueue.enqueue({ type: 'sync_task', data: { id: 'x' } });
    await timer.syncQueue.processQueue();
    assert.strictEqual(timer.syncQueue.queue.length, 1);
    timer.syncQueue.clear();
});

test('bulk delete_task payloads are normalized to plain task ids', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const deleted = [];
    timer.deleteTaskFromServer = async (id) => { deleted.push(id); return { success: true }; };
    await timer.processSyncBatch([{ type: 'delete_task', data: { taskId: 'abc-123', timestamp: 1 } }]);
    assert.deepStrictEqual(deleted, ['abc-123']);
});

test('showToast renders the message as text, not HTML', async (t) => {
    const { timer, sandbox, els } = await createApp();
    t.after(() => cleanup(timer));
    sandbox.showToast('<img src=x onerror=alert(1)>', 'error');
    const container = els.toastContainer;
    assert.strictEqual(container.children.length, 1);
    const toast = container.children[0];
    assert.strictEqual(toast.innerHTML, '');
    assert.strictEqual(toast.children[1].textContent, '<img src=x onerror=alert(1)>');
});

test('wake-up correction after pause/resume does not jump back up', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    // Resumed session: 900s left of 1500s, then 60s pass in another tab
    timer.isRunning = true;
    timer.isWorkSession = false;
    timer.currentDuration = 1500;
    timer.timeLeft = 900;
    timer.timerEndAt = Date.now() + 840 * 1000;
    timer.correctTimerAfterWakeup();
    assert.strictEqual(timer.timeLeft, 840);
});

test('beginCountdown sends the absolute end time to the worker', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const worker = { messages: [], postMessage(m) { this.messages.push(m); } };
    timer.worker = worker;
    timer.isRunning = true;
    timer.timerEndAt = 1234567890000;
    timer.beginCountdown();
    assert.strictEqual(worker.messages.length, 1);
    assert.strictEqual(worker.messages[0].action, 'start');
    assert.strictEqual(worker.messages[0].data.endAt, 1234567890000);
});

test('session that ends while away completes exactly once on return', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.tasks = [{ id: 'task-1', text: 'Focus', completed: false, version: 1 }];
    timer.selectedTaskId = 'task-1';
    timer.isWorkSession = true;
    timer.isRunning = true;
    timer.currentDuration = 1500;
    timer.timeLeft = 5;
    timer.timerEndAt = Date.now() - 1000; // ended while away
    timer.correctTimerAfterWakeup();
    timer.correctTimerAfterWakeup(); // duplicate wake/focus events are no-ops
    assert.strictEqual(timer.sessionCount, 1);
    assert.strictEqual(timer.isWorkSession, false); // moved to break
    assert.strictEqual(timer.isRunning, false);
});

test('running timer resumes after a page reload with correct remaining time', async (t) => {
    const first = await createApp();
    first.timer.tasks = [{ id: 'task-9', text: 'Deep work', completed: false, version: 1, createdAt: new Date().toISOString(), lastModified: new Date().toISOString(), deviceId: first.timer.deviceId }];
    first.timer.selectedTaskId = 'task-9';
    first.timer.isWorkSession = true;
    first.timer.currentDuration = 1500;
    first.timer.timeLeft = 1500;
    first.timer.startTimer();
    assert.ok(first.timer.isRunning);
    // Simulate OS killing the page: stop local countdowns without pausing,
    // persisted end time remains in storage.
    cleanup(first.timer);

    const second = await createApp(first.storage);
    t.after(() => cleanup(second.timer));
    assert.strictEqual(second.timer.isRunning, true);
    assert.strictEqual(second.timer.selectedTaskId, 'task-9');
    assert.ok(second.timer.timeLeft <= 1500 && second.timer.timeLeft >= 1495, `timeLeft=${second.timer.timeLeft}`);
    assert.strictEqual(second.timer.timerEndAt, first.timer.timerEndAt);
});

test('session that ends while the page is killed completes on next load', async (t) => {
    const now = Date.now();
    const seed = {
        pomodoroData: JSON.stringify({
            tasks: [{ id: 'task-7', text: 'Away task', completed: false, version: 1, createdAt: new Date(now).toISOString(), lastModified: new Date(now).toISOString() }],
            sessionCount: 0, workDuration: 1500, breakDuration: 300,
        }),
        pomodoroTimerState: JSON.stringify({
            isRunning: true, isWorkSession: true, isLongBreak: false,
            selectedTaskId: 'task-7', currentDuration: 1500, timeLeft: 0,
            timerEndAt: now - 60 * 1000, savedAt: now - 60 * 1000,
        }),
    };
    const { timer } = await createApp(seed);
    t.after(() => cleanup(timer));
    await new Promise(r => setTimeout(r, 200)); // deferred completion on init
    assert.strictEqual(timer.sessionCount, 1);
    assert.strictEqual(timer.isWorkSession, false);
    assert.strictEqual(timer.isRunning, false);
});

test('plan mode hides the timer and persists; starting forces focus view', async (t) => {
    const { timer, query, storage } = await createApp();
    t.after(() => cleanup(timer));
    timer.setViewMode('plan');
    assert.ok(query('main')._classes.has('planning-mode'));
    assert.strictEqual(storage.pomodoroViewMode, 'plan');
    assert.ok(timer.planViewBtn._classes.has('active'));

    const restored = await createApp(storage);
    t.after(() => cleanup(restored.timer));
    assert.ok(restored.query('main')._classes.has('planning-mode'));

    // Starting a session always returns to the timer view
    restored.timer.tasks = [{ id: 'task-1', text: 'Focus task', completed: false, version: 1 }];
    restored.timer.selectedTaskId = 'task-1';
    restored.timer.isWorkSession = true;
    restored.timer.startTimer();
    assert.strictEqual(restored.timer.viewMode, 'timer');
    assert.ok(!restored.query('main')._classes.has('planning-mode'));
    assert.ok(restored.query('main')._classes.has('focus-mode'));
});

test('double-click edit renames a task on Enter, cancels on Escape, rejects empty', async (t) => {
    const { timer, els } = await createApp();
    t.after(() => cleanup(timer));
    timer.tasks = [{ id: 'a', text: 'Old name', completed: false, version: 1 }];
    timer.selectedTaskId = 'a';
    timer.renderTasks();

    // Stub DOM keeps earlier renders; always use the most recent task row
    const textSpan = () => timer.tasksList.children.at(-1).children.find(c => c.className === 'task-text');

    // The name span carries the dblclick handler
    assert.ok((textSpan()._listeners.dblclick || []).length >= 1);

    // Two quick row clicks also open the editor (selection re-renders the
    // row, which would otherwise swallow the browser's native dblclick)
    timer.tasksList.children.at(-1).onclick();
    timer.tasksList.children.at(-1).onclick();
    assert.ok(textSpan().children[0]);
    textSpan().children[0].dispatch('keydown', { key: 'Escape' });

    // Save on Enter
    textSpan().dispatch('dblclick');
    let input = textSpan().children[0];
    assert.strictEqual(input.value, 'Old name');
    input.value = '  New name  ';
    input.dispatch('keydown', { key: 'Enter' });
    assert.strictEqual(timer.tasks[0].text, 'New name');
    assert.strictEqual(timer.tasks[0].version, 2);
    assert.strictEqual(els.currentTaskName.textContent, 'New name');

    // Cancel on Escape
    textSpan().dispatch('dblclick');
    input = textSpan().children[0];
    input.value = 'Discarded';
    input.dispatch('keydown', { key: 'Escape' });
    assert.strictEqual(timer.tasks[0].text, 'New name');

    // Empty name reverts
    textSpan().dispatch('dblclick');
    input = textSpan().children[0];
    input.value = '   ';
    input.dispatch('keydown', { key: 'Enter' });
    assert.strictEqual(timer.tasks[0].text, 'New name');
});

test('single timer button cycles I-will-work / Pause / Continue labels', async (t) => {
    const { timer, els } = await createApp();
    t.after(() => cleanup(timer));
    // No task: disabled prompt
    timer.updateDisplay();
    assert.strictEqual(els.startBtnLabel.textContent, 'Select a task to start');
    assert.strictEqual(els.startBtn.disabled, true);

    timer.tasks = [{ id: 'a', text: 'Task A', completed: false, version: 1 }];
    timer.selectedTaskId = 'a';
    timer.isWorkSession = true;
    timer.currentDuration = 1500;
    timer.timeLeft = 1500;
    timer.updateDisplay();
    assert.strictEqual(els.startBtnLabel.textContent, 'I will work on this task');
    assert.strictEqual(els.startBtn.disabled, false);

    timer.toggleTimer(); // start
    assert.strictEqual(timer.isRunning, true);
    assert.strictEqual(els.startBtnLabel.textContent, 'Pause');
    assert.ok(els.startBtn._classes.has('is-running'));

    timer.timeLeft = 1200; // simulate elapsed before pausing
    timer.timerEndAt = Date.now() + 1200 * 1000;
    timer.toggleTimer(); // pause
    assert.strictEqual(timer.isRunning, false);
    assert.strictEqual(els.startBtnLabel.textContent, 'Continue working on this task');
    assert.ok(!els.startBtn._classes.has('is-running'));

    timer.toggleTimer(); // resume
    assert.strictEqual(timer.isRunning, true);
    assert.strictEqual(els.startBtnLabel.textContent, 'Pause');
    timer.pauseTimer();

    // Break states use break wording
    timer.isWorkSession = false;
    timer.currentDuration = 300;
    timer.timeLeft = 300;
    timer.updateDisplay();
    assert.strictEqual(els.startBtnLabel.textContent, 'Start break');
});

test('one-click start from Plan selects the task and enters focus running', async (t) => {
    const { timer, query } = await createApp();
    t.after(() => cleanup(timer));
    timer.setViewMode('plan');
    timer.tasks = [
        { id: 'a', text: 'Task A', completed: false, version: 1 },
        { id: 'b', text: 'Task B', completed: false, version: 1 },
    ];
    timer.renderTasks();
    // Task rows expose a start (▶) action
    const actions = timer.tasksList.children[1].children.find(c => c.className === 'task-actions');
    assert.ok(actions.children.some(c => c.className.includes('start-btn')));

    timer.startTask('b', { stopPropagation() {} });
    assert.strictEqual(timer.selectedTaskId, 'b');
    assert.strictEqual(timer.isRunning, true);
    assert.strictEqual(timer.isWorkSession, true);
    assert.strictEqual(timer.viewMode, 'timer');
    assert.ok(!query('main')._classes.has('planning-mode'));
    assert.ok(query('main')._classes.has('focus-mode'));
});

test('one-click start during a break jumps straight into the work session', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.tasks = [{ id: 'a', text: 'Task A', completed: false, version: 1 }];
    timer.isWorkSession = false; // break in progress
    timer.isRunning = true;
    timer.currentDuration = timer.breakDuration;
    timer.timeLeft = 120;
    timer.startTask('a', { stopPropagation() {} });
    assert.strictEqual(timer.isWorkSession, true);
    assert.strictEqual(timer.isRunning, true);
    assert.ok(timer.timeLeft > timer.breakDuration); // fresh work duration, counting down
});

test('task list collapses in focus mode while a work session runs', async (t) => {
    const { timer, query, els } = await createApp();
    t.after(() => cleanup(timer));
    timer.tasks = [{ id: 'task-1', text: 'Focus task', completed: false, version: 1 }];
    timer.selectedTaskId = 'task-1';
    timer.isWorkSession = true;
    timer.currentDuration = 1500;
    timer.timeLeft = 1500;
    timer.startTimer();
    assert.strictEqual(timer.isRunning, true);
    assert.ok(query('.tasks-section')._classes.has('focus-collapsed'));
    assert.ok(query('main')._classes.has('focus-mode'));
    assert.ok(!els.tasksCollapsedHint._classes.has('hidden'));
    // Current task is promoted above the timer
    assert.strictEqual(els.currentTaskName.textContent, 'Focus task');
    assert.ok(!els.currentTaskFocus._classes.has('no-task'));

    timer.pauseTimer();
    assert.ok(!query('.tasks-section')._classes.has('focus-collapsed'));
    assert.ok(els.tasksCollapsedHint._classes.has('hidden'));
});

test('breaks do not collapse the task list (next task can be picked)', async (t) => {
    const { timer, query } = await createApp();
    t.after(() => cleanup(timer));
    timer.isWorkSession = false;
    timer.isRunning = true;
    timer.updateDisplay();
    assert.ok(!query('.tasks-section')._classes.has('focus-collapsed'));
});

test('restorePomodoroCounter uses the latest session of the day', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const now = Date.now();
    timer.workSessions = [
        { id: 'old', taskId: 't', taskText: 'A', duration: 1500, completedAt: new Date(now - 3600e3).toISOString(), pomodoroCount: 1 },
        { id: 'new', taskId: 't', taskText: 'A', duration: 1500, completedAt: new Date(now).toISOString(), pomodoroCount: 3 },
    ];
    timer.restorePomodoroCounter();
    assert.strictEqual(timer.completedPomodoros, 3);
});

// ---------------------------------------------------------------------------
// Audit bugs (GitHub issue #1). Sync tests run the real Apps Script backend
// against an in-memory spreadsheet.
// ---------------------------------------------------------------------------

function makeServer() {
    const sheets = {};
    const lock = { waits: 0, releases: 0, timeout: false };
    const makeSheet = () => {
        const rows = [];
        return {
            rows,
            getLastRow: () => rows.length,
            getRange: (r, c, numRows = 1, numCols = 1) => ({
                setValues: (values) => values.forEach((row, i) => {
                    rows[r - 1 + i] = rows[r - 1 + i] || [];
                    row.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; });
                }),
                getValues: () => Array.from({ length: numRows }, (_, i) =>
                    Array.from({ length: numCols }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
                getValue: () => (rows[r - 1] || [])[c - 1] ?? '',
                setFontWeight() {}, setBackground() {}, setFontColor() {},
            }),
            deleteRow: (r) => rows.splice(r - 1, 1),
            autoResizeColumns() {},
        };
    };
    const context = {
        console: { log() {}, error() {} },
        LockService: {
            getScriptLock: () => ({
                waitLock: () => {
                    if (lock.timeout) throw new Error('Lock timeout');
                    lock.waits++;
                },
                releaseLock: () => { lock.releases++; },
            }),
        },
        SpreadsheetApp: {
            getActiveSpreadsheet: () => ({
                getSheetByName: (name) => sheets[name] || null,
                insertSheet: (name) => (sheets[name] = makeSheet()),
            }),
        },
        ContentService: { createTextOutput: (text) => ({ text, setMimeType() { return this; } }), MimeType: {} },
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8'), context);
    const run = (body) => context.doPost({ postData: { contents: body }, parameter: {} }).text;
    return {
        sheets,
        lock,
        get: (parameter) => JSON.parse(context.doGet({ parameter }).text),
        post: (data) => JSON.parse(run(JSON.stringify(data))),
        fetch: async (url, options) => {
            const text = run(options.body);
            return { status: 200, ok: true, text: async () => text };
        },
        dataRows: (name) => Math.max(0, (sheets[name]?.rows.length ?? 0) - 1),
    };
}

async function createSyncedApp(server, t) {
    const app = await createApp({ pomodoroData: JSON.stringify({ tasks: [], googleSheetsWebhook: 'http://sheet.test' }) });
    app.sandbox.fetch = server.fetch;
    t.after(() => cleanup(app.timer));
    return app;
}

function addTask(timer, text) {
    timer.taskInput.value = text;
    timer.addTask();
    return timer.tasks.at(-1);
}

// Fast-forward a running countdown
function elapse(timer, seconds) {
    timer.timerEndAt -= seconds * 1000;
    timer.startTime -= seconds * 1000;
    timer.timeLeft = timer.getRemainingSeconds();
}

function runFullSession(timer) {
    timer.startTimer();
    elapse(timer, timer.timeLeft);
    timer.completeSession();
}

const noEvent = { stopPropagation() {} };
// Arrays made inside the vm have a different prototype, which deepStrictEqual rejects
const plain = (value) => JSON.parse(JSON.stringify(value));
const activityLog = (app) => JSON.parse(app.storage.pomodoroActivities || '[]').map(a => a.text);

test('bug 1: index.html has no duplicate element IDs', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.deepStrictEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('bug 1: saving settings without edits keeps the long break length', async (t) => {
    const { timer, els } = await createApp({ pomodoroData: JSON.stringify({ tasks: [], longBreakDuration: 900 }) });
    t.after(() => cleanup(timer));
    assert.strictEqual(els.longBreakDuration.value, 15);
    timer.saveSettings();
    assert.strictEqual(timer.longBreakDuration, 900);
    assert.strictEqual(els.longBreakAlertDuration.value, 5); // Alert length has its own input
});

test('bug 5: Plan during a running session shows the task list', async (t) => {
    const { timer, query } = await createApp();
    t.after(() => cleanup(timer));
    timer.selectTask(addTask(timer, 'Focus').id);
    timer.startTimer();
    assert.ok(query('.tasks-section')._classes.has('focus-collapsed'));

    timer.setViewMode('plan');
    assert.ok(timer.isRunning);
    assert.ok(!query('.tasks-section')._classes.has('focus-collapsed'));
    assert.ok(!query('main')._classes.has('focus-mode'));

    timer.setViewMode('timer');
    assert.ok(query('.tasks-section')._classes.has('focus-collapsed'));
    assert.ok(query('main')._classes.has('focus-mode'));
});

test('bug 5: deleting the running task from Plan stops its session', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const task = addTask(timer, 'Focus');
    timer.selectTask(task.id);
    timer.startTimer();
    elapse(timer, 600);
    timer.setViewMode('plan');
    timer.deleteTask(task.id, noEvent);
    assert.strictEqual(timer.isRunning, false);
    assert.strictEqual(timer.timeLeft, timer.workDuration);
    assert.strictEqual(timer.workSessions.length, 0);
});

test('bug 2: long breaks still happen when a sync runs after every pomodoro', async (t) => {
    const server = makeServer();
    const { timer, sandbox } = await createSyncedApp(server, t);
    sandbox.confirm = () => false;
    timer.selectTask(addTask(timer, 'Cycle').id);
    const counts = [];
    let longBreaks = 0;
    for (let i = 0; i < 8; i++) {
        runFullSession(timer);
        if (timer.isLongBreak) longBreaks++;
        await timer.performFullSync();
        counts.push(timer.completedPomodoros);
        runFullSession(timer);
    }
    assert.deepStrictEqual(counts, [1, 2, 3, 0, 1, 2, 3, 0]);
    assert.strictEqual(longBreaks, 2);
});

test('bug 6: finishing a task early gives the next task a fresh session', async (t) => {
    const { timer, sandbox, els } = await createApp();
    t.after(() => cleanup(timer));
    sandbox.confirm = () => false;
    const first = addTask(timer, 'First');
    const second = addTask(timer, 'Second');
    timer.selectTask(first.id);
    timer.startTimer();
    elapse(timer, 600);
    timer.completeCurrentTask();
    assert.strictEqual(timer.timeLeft, 1500);

    timer.selectTask(second.id);
    assert.strictEqual(els.startBtnLabel.textContent, 'I will work on this task');
    runFullSession(timer);
    assert.deepStrictEqual(plain(timer.workSessions.map(s => [s.taskText, s.duration])), [['First', 600], ['Second', 1500]]);
});

test('bug 6: switching tasks while paused credits the old task and starts fresh', async (t) => {
    const { timer, sandbox } = await createApp();
    t.after(() => cleanup(timer));
    sandbox.confirm = () => false;
    const first = addTask(timer, 'First');
    const second = addTask(timer, 'Second');
    timer.selectTask(first.id);
    timer.startTimer();
    elapse(timer, 600);
    timer.pauseTimer();
    timer.selectTask(second.id);
    assert.strictEqual(timer.timeLeft, 1500);
    assert.deepStrictEqual(plain(timer.workSessions.map(s => [s.taskText, s.duration])), [['First', 600]]);
});

test('bug 6: a session logs its own length after settings change mid-run', async (t) => {
    const { timer, sandbox } = await createApp();
    t.after(() => cleanup(timer));
    sandbox.confirm = () => false;
    timer.selectTask(addTask(timer, 'Task').id);
    timer.startTimer();
    timer.workDuration = 3000;
    elapse(timer, timer.timeLeft);
    timer.completeSession();
    assert.strictEqual(timer.workSessions[0].duration, 1500);
});

test('completing a task from the end-of-session prompt records one session', async (t) => {
    const { timer, sandbox } = await createApp();
    t.after(() => cleanup(timer));
    sandbox.confirm = () => true;
    timer.selectTask(addTask(timer, 'Task').id);
    runFullSession(timer);
    assert.strictEqual(timer.workSessions.length, 1);
    assert.strictEqual(timer.completedTasks.length, 1);
    assert.strictEqual(timer.isWorkSession, false);
    assert.strictEqual(timer.timeLeft, timer.breakDuration);
});

test('bug 3: a task deleted on one device leaves the other and stays gone', async (t) => {
    const server = makeServer();
    const A = await createSyncedApp(server, t);
    const B = await createSyncedApp(server, t);
    const task = addTask(A.timer, 'Shared');
    await A.timer.syncQueue.flush();
    await B.timer.performFullSync();
    assert.ok(B.timer.tasks.some(x => x.id === task.id));

    A.timer.deleteTask(task.id, noEvent);
    await A.timer.syncQueue.flush();
    await B.timer.performFullSync();
    assert.ok(!B.timer.tasks.some(x => x.id === task.id));
    assert.strictEqual(server.dataRows('Tasks'), 0);
});

test('bug 3: a task completed on one device leaves the other', async (t) => {
    const server = makeServer();
    const A = await createSyncedApp(server, t);
    const B = await createSyncedApp(server, t);
    const task = addTask(A.timer, 'Shared');
    await A.timer.syncQueue.flush();
    await B.timer.performFullSync();

    A.timer.completeTask(task.id, noEvent);
    await A.timer.syncQueue.flush();
    await B.timer.performFullSync();
    assert.ok(!B.timer.tasks.some(x => x.id === task.id));
    assert.strictEqual(server.dataRows('Tasks'), 0);
});

test('bug 3: a stale client cannot upload a finished task again', async (t) => {
    const server = makeServer();
    const task = { id: 't', text: 'Old', version: 1, createdAt: new Date().toISOString() };
    server.post({ action: 'sync_tasks', tasks: [task] });
    server.post({ action: 'delete_task', taskId: 't' });
    server.post({ action: 'sync_tasks', tasks: [task] });
    assert.strictEqual(server.dataRows('Tasks'), 0);
    assert.deepStrictEqual(server.post({ action: 'get_tasks' }).deletedTaskIds, ['t']);
});

test('bug 3: a session running on a task removed elsewhere can finish first', async (t) => {
    const server = makeServer();
    const { timer } = await createSyncedApp(server, t);
    const task = addTask(timer, 'Shared');
    timer.selectTask(task.id);
    timer.startTimer();
    timer.mergeTasks([], [task.id]);
    assert.ok(timer.isRunning);
    assert.ok(timer.tasks.some(x => x.id === task.id));

    timer.pauseTimer();
    timer.mergeTasks([], [task.id]);
    assert.ok(!timer.tasks.some(x => x.id === task.id));
    assert.strictEqual(timer.selectedTaskId, null);
});

test('bug 3: unsynced local tasks with no deletion record are still kept', async (t) => {
    const server = makeServer();
    const { timer } = await createSyncedApp(server, t);
    const task = addTask(timer, 'Local only');
    timer.syncQueue.clear();
    await timer.performFullSync();
    assert.ok(timer.tasks.some(x => x.id === task.id));
    assert.strictEqual(server.dataRows('Tasks'), 1);
});

test('bug 4: work made offline reaches the server once back online', async (t) => {
    const server = makeServer();
    const { timer, sandbox } = await createSyncedApp(server, t);
    sandbox.confirm = () => false;
    const keep = addTask(timer, 'Session task');
    const done = addTask(timer, 'Finish offline');
    const gone = addTask(timer, 'Delete offline');
    await timer.syncQueue.flush();
    assert.strictEqual(server.dataRows('Tasks'), 3);

    sandbox.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    timer.syncToGoogleSheetsJSONP = async () => ({ success: false, reason: 'offline' });
    timer.selectTask(keep.id);
    runFullSession(timer);
    timer.completeTask(done.id, noEvent);
    timer.deleteTask(gone.id, noEvent);
    await timer.syncQueue.flush();
    assert.strictEqual(timer.syncQueue.queue.length, 3);
    assert.strictEqual(timer.syncQueue.consecutiveFailures, 1);

    sandbox.fetch = server.fetch;
    await timer.syncQueue.flush();
    assert.strictEqual(timer.syncQueue.queue.length, 0);
    assert.strictEqual(timer.syncQueue.consecutiveFailures, 0);
    assert.strictEqual(server.dataRows('Work Sessions'), 1);
    assert.strictEqual(server.dataRows('Completed Tasks'), 1);
    assert.strictEqual(server.dataRows('Tasks'), 1);
});

test('bug 4: a {success:false} server reply also keeps operations queued', async (t) => {
    const server = makeServer();
    const { timer, sandbox } = await createSyncedApp(server, t);
    sandbox.fetch = async () => ({ status: 200, text: async () => JSON.stringify({ success: false, error: 'quota' }) });
    timer.syncQueue.enqueue({ type: 'sync_work_session', data: { id: 's', duration: 60 } });
    await timer.syncQueue.flush();
    assert.strictEqual(timer.syncQueue.queue.length, 1);
    timer.syncQueue.clear();
});

test('bug 4: retries back off and are capped at 5 minutes', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const delayAfter = (failures) => {
        timer.syncQueue.consecutiveFailures = failures;
        return timer.syncQueue.getRetryDelay();
    };
    assert.deepStrictEqual([1, 2, 3, 20].map(delayAfter), [5000, 10000, 20000, 300000]);
});

test('bug 4: without a webhook the queue drains instead of retrying forever', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.selectTask(addTask(timer, 'No sync').id);
    timer.syncQueue.enqueue({ type: 'sync_work_session', data: { id: 's', duration: 60 } });
    await timer.syncQueue.flush();
    assert.strictEqual(timer.syncQueue.queue.length, 0);
});

test('bug 7: archived tasks from the server are merged locally', async (t) => {
    const server = makeServer();
    const { timer } = await createSyncedApp(server, t);
    server.post({ action: 'sync_archived_tasks', archivedTasks: [{ id: 'x', text: 'Old', createdAt: 'c', archivedAt: new Date().toISOString() }] });
    await timer.performFullSync();
    assert.deepStrictEqual(plain(timer.archivedTasks.map(a => a.id)), ['x']);
});

test('bug 8: date filters use the client timezone', async (t) => {
    const server = makeServer();
    const completedAt = '2026-11-06T01:30:00.000Z'; // 20:30 on Nov 5 in New York
    server.post({ action: 'sync_work_sessions', workSessions: [{ id: 's', taskText: 'T', duration: 1500, completedAt }] });
    server.post({ action: 'complete_task', task: { id: 'c', text: 'T', createdAt: 'c', completedAt } });
    const query = (action, key, date, timezoneOffset) => server.post({ action, date, timezoneOffset })[key].length;

    assert.strictEqual(query('get_work_sessions', 'workSessions', '2026-11-05', 300), 1);
    assert.strictEqual(query('get_work_sessions', 'workSessions', '2026-11-06', 300), 0);
    assert.strictEqual(query('get_completed_tasks', 'completedTasks', '2026-11-05', 300), 1);
    assert.strictEqual(query('get_work_sessions', 'workSessions', '2026-11-06', undefined), 1); // Older clients: UTC

    const { timer, sandbox } = await createSyncedApp(server, t);
    const bodies = [];
    sandbox.fetch = async (url, options) => { bodies.push(JSON.parse(options.body)); return server.fetch(url, options); };
    await timer.refreshTodayStats();
    assert.ok(bodies.length === 2 && bodies.every(b => b.timezoneOffset === new Date().getTimezoneOffset()));
});

test('bug 9: ticking a paused task records the time worked', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    const task = addTask(timer, 'Paused');
    timer.selectTask(task.id);
    timer.startTimer();
    elapse(timer, 600);
    timer.pauseTimer();
    timer.completeTask(task.id, noEvent);
    assert.deepStrictEqual(plain(timer.workSessions.map(s => s.duration)), [600]);
    assert.strictEqual(timer.timeLeft, timer.workDuration);
});

test('bug 10: saving settings while paused keeps the countdown', async (t) => {
    const { timer } = await createApp();
    t.after(() => cleanup(timer));
    timer.selectTask(addTask(timer, 'Paused').id);
    timer.startTimer();
    elapse(timer, 600);
    timer.pauseTimer();
    timer.workDurationInput.value = '25';
    timer.saveSettings();
    assert.strictEqual(timer.timeLeft, 900);
    assert.strictEqual(timer.currentDuration, 1500);

    // A session that hasn't started still picks up the new length
    timer.resetTimer();
    timer.workDurationInput.value = '30';
    timer.saveSettings();
    assert.strictEqual(timer.timeLeft, 1800);
});

for (const action of ['bulkDeleteTasks', 'bulkArchiveTasks']) {
    test(`bug 11: ${action} clears the selected task`, async (t) => {
        const { timer, els } = await createApp();
        t.after(() => cleanup(timer));
        const task = addTask(timer, 'Selected');
        timer.selectTask(task.id);
        timer.toggleBulkSelection();
        timer.handleTaskCheckbox(task.id, true);
        timer[action]();
        assert.strictEqual(timer.selectedTaskId, null);
        assert.strictEqual(els.currentTaskName.textContent, 'No task selected');
        assert.strictEqual(els.startBtn.disabled, true);
    });
}

test('bug 12: sync does not round local session lengths', async (t) => {
    const server = makeServer();
    const { timer } = await createSyncedApp(server, t);
    timer.selectTask(addTask(timer, 'Short').id);
    timer.startTimer();
    elapse(timer, 40);
    timer.completeCurrentTask();
    await timer.syncQueue.flush();
    await timer.performFullSync();
    assert.strictEqual(timer.workSessions[0].duration, 40);
    assert.strictEqual(server.dataRows('Work Sessions'), 1);
});

test('bug 13: skipped server tasks do not flood the activity log', async (t) => {
    const server = makeServer();
    const app = await createSyncedApp(server, t);
    const task = addTask(app.timer, 'Finished');
    app.timer.addToDeletedTasks(task.id);
    app.timer.tasks = [];
    for (let i = 0; i < 3; i++) app.timer.mergeTasks([task]);
    assert.strictEqual(activityLog(app).filter(x => x.startsWith('⏭️')).length, 0);
});

test('bug 14: own tasks are not reported as coming from another device', async (t) => {
    const server = makeServer();
    const app = await createSyncedApp(server, t);
    const task = addTask(app.timer, 'Mine');
    const lastModified = task.lastModified;
    await app.timer.syncQueue.flush();
    await app.timer.performFullSync();
    assert.strictEqual(server.post({ action: 'get_tasks' }).tasks[0].lastModified, lastModified);
    assert.ok(!activityLog(app).some(x => x.includes('another device')));

    // Also with a backend that hasn't been redeployed yet
    app.timer.mergeTasks([{ ...task, deviceId: app.timer.deviceId, lastModified: new Date(Date.now() + 1000).toISOString() }]);
    assert.ok(!activityLog(app).some(x => x.includes('another device')));
});

test('follow-up: every server request holds the script lock', () => {
    const server = makeServer();
    server.post({ action: 'sync_tasks', tasks: [{ id: 'a', text: 'A', createdAt: 'c' }] });
    server.post({ action: 'no_such_action' });
    server.get({ action: 'get_tasks' });
    assert.strictEqual(server.lock.waits, 3);
    assert.strictEqual(server.lock.releases, 3);
    assert.strictEqual(server.dataRows('Tasks'), 1);
});

test('follow-up: the lock is released when a request fails', () => {
    const server = makeServer();
    assert.strictEqual(server.post({ action: 'complete_task' }).success, false); // No task: throws
    assert.strictEqual(server.lock.releases, 1);
});

test('follow-up: a lock timeout writes nothing and the client retries', async (t) => {
    const server = makeServer();
    const { timer } = await createSyncedApp(server, t);
    server.lock.timeout = true;
    assert.strictEqual(server.get({ action: 'get_tasks' }).success, false);
    timer.syncQueue.enqueue({ type: 'sync_work_session', data: { id: 's', taskText: 'T', duration: 60 } });
    await timer.syncQueue.flush();
    assert.strictEqual(timer.syncQueue.queue.length, 1);
    assert.strictEqual(server.dataRows('Work Sessions'), 0);

    server.lock.timeout = false;
    await timer.syncQueue.flush();
    assert.strictEqual(timer.syncQueue.queue.length, 0);
    assert.strictEqual(server.dataRows('Work Sessions'), 1);
});

test('follow-up: archived tasks are listed, newest first, as plain text', async (t) => {
    const { timer, els, sandbox } = await createApp();
    t.after(() => cleanup(timer));
    assert.ok(els.archivedSection._classes.has('hidden'));

    sandbox.confirm = () => true;
    const task = addTask(timer, '<b>Older</b>');
    timer.toggleBulkSelection();
    timer.handleTaskCheckbox(task.id, true);
    timer.bulkArchiveTasks();
    timer.archivedTasks[0].archivedAt = '2026-01-01T12:00:00.000Z';
    timer.mergeArchivedTasks([{ id: 'n', text: 'Newer', archivedAt: '2026-06-01T12:00:00.000Z' }]);

    assert.ok(!els.archivedSection._classes.has('hidden'));
    assert.strictEqual(els.archivedCount.textContent, 2);
    // The stub DOM keeps earlier renders; the last two rows are the latest render
    const rows = els.archivedList.children.slice(-2);
    assert.strictEqual(rows[0].children[0].textContent, 'Newer');
    assert.strictEqual(rows[1].children[0].textContent, '<b>Older</b>');
    assert.strictEqual(rows[1].children[0].innerHTML, '');
});

test('follow-up: progress dots grow to match the long-break interval', async (t) => {
    const { timer, els } = await createApp();
    t.after(() => cleanup(timer));
    const progress = els.pomodoroProgress;
    progress.querySelectorAll = () => progress.children;
    timer.longBreakInterval = 6;
    timer.updateDisplay();
    assert.strictEqual(progress.children.length, 6);
    assert.strictEqual(progress.children[5].dataset.step, '6');
});

test('follow-up: disabled long breaks do not log "of 0 pomodoros"', async (t) => {
    const app = await createApp();
    t.after(() => cleanup(app.timer));
    app.sandbox.confirm = () => false;
    app.timer.longBreakInterval = 0;
    app.timer.selectTask(addTask(app.timer, 'Task').id);
    runFullSession(app.timer);
    assert.strictEqual(app.timer.isLongBreak, false);
    assert.ok(!activityLog(app).some(x => x.includes('of 0')));
    assert.ok(activityLog(app).includes('✅ Short break time'));
});

test('follow-up: the activity log uses the local date', async (t) => {
    const previousTZ = process.env.TZ;
    process.env.TZ = 'America/New_York';
    t.after(() => {
        if (previousTZ === undefined) delete process.env.TZ;
        else process.env.TZ = previousTZ;
    });
    const server = makeServer();
    const { timer, sandbox } = await createSyncedApp(server, t);
    const fixed = Date.parse('2026-11-06T01:30:00.000Z'); // 20:30 on Nov 5 in New York
    sandbox.Date = class extends Date {
        constructor(...args) { if (args.length) super(...args); else super(fixed); }
        static now() { return fixed; }
    };
    t.after(() => { sandbox.Date = Date; });
    const result = await timer.syncToGoogleSheets('Task', 'Evening task');
    assert.strictEqual(result.success, true);
    assert.strictEqual(server.sheets['Activity Log'].rows[1][0], '2026-11-05');
});

test('follow-up: a blocked daily report is not logged as sent', async (t) => {
    const app = await createApp();
    t.after(() => cleanup(app.timer));
    app.timer.userEmail = 'someone@example.com';

    app.sandbox.open = () => null;
    app.timer.sendReport();
    assert.ok(activityLog(app)[0].includes('blocked'));
    assert.strictEqual(app.els.toastContainer.children.length, 1);

    app.sandbox.open = () => ({});
    app.timer.sendReport();
    assert.ok(activityLog(app)[0].includes('opened in your email app'));
    assert.ok(!activityLog(app).some(x => x.includes('report sent')));
});

test('follow-up: resetting the daily-reset sound turns it back off', async (t) => {
    const { timer, sandbox } = await createApp();
    t.after(() => cleanup(timer));
    const manager = sandbox.window.alertSoundManager;
    manager.soundTypes['daily-reset'].enabled = true; // As after uploading a custom sound
    await manager.resetToDefault('daily-reset');
    assert.strictEqual(manager.soundTypes['daily-reset'].enabled, false);

    manager.soundTypes['short-break'].enabled = false;
    await manager.resetToDefault('short-break');
    assert.strictEqual(manager.soundTypes['short-break'].enabled, true);
});
