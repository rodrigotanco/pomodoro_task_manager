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
