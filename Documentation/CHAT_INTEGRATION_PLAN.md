# Hybrid Chat Integration Plan for Pomodoro Task Manager

**Version:** 1.0
**Date:** 2025-10-21
**Status:** Planning Phase
**Privacy Level:** Privacy-First with User Choice

---

## 🎯 Project Overview

Integrate a privacy-preserving chat interface into the Pomodoro Task Manager PWA, allowing users to interact with their tasks and timer through natural language while maintaining the app's core privacy principles.

### Core Principles
1. **Privacy First** - Default to zero external data sharing
2. **User Choice** - Let users choose their privacy/capability trade-off
3. **Progressive Enhancement** - Works without AI, better with it
4. **No Breaking Changes** - Existing functionality remains intact
5. **Mobile Friendly** - Works on all devices

---

## 🏗️ Architecture Overview

### Hybrid AI Approach (4 Tiers)

Users can choose their preferred mode in Settings:

| Tier | Name | Privacy | Intelligence | Setup | Cost | Internet Required |
|------|------|---------|--------------|-------|------|-------------------|
| **1** | Command Parser | 100% Private | Basic | None | Free | No |
| **2** | Local Browser AI | 100% Private | Good | Model download | Free | Download only |
| **3** | Local Server | 100% Private | Very Good | Install app | Free | No |
| **4** | Cloud AI | Data shared | Excellent | API key | ~$5/mo | Yes |

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Pomodoro PWA (Browser)                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Chat Widget UI Component                │  │
│  │  - Floating button                                   │  │
│  │  - Expandable chat panel                            │  │
│  │  - Message history                                   │  │
│  │  - Input field with suggestions                      │  │
│  └───────────────────────┬──────────────────────────────┘  │
│                          │                                  │
│  ┌───────────────────────▼──────────────────────────────┐  │
│  │           Chat Manager (chat-manager.js)             │  │
│  │  - Routes to appropriate AI tier                     │  │
│  │  - Handles responses                                 │  │
│  │  - Context management                                │  │
│  └───┬────────┬─────────┬────────────┬─────────────────┘  │
│      │        │         │            │                     │
│  ┌───▼──┐ ┌──▼───┐ ┌───▼────┐ ┌─────▼──────┐            │
│  │Tier 1│ │Tier 2│ │ Tier 3 │ │  Tier 4    │            │
│  │Parser│ │WebLLM│ │ Ollama │ │ Claude API │            │
│  └───┬──┘ └──┬───┘ └───┬────┘ └─────┬──────┘            │
│      │       │         │            │                     │
│  ┌───▼───────▼─────────▼────────────▼─────────────────┐  │
│  │         PomodoroTimer Class (script.js)            │  │
│  │  - Task CRUD operations                            │  │
│  │  - Timer control                                   │  │
│  │  - Statistics                                      │  │
│  │  - Data access layer                              │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                   │
│  ┌────────────────────▼───────────────────────────────┐  │
│  │           Browser localStorage                     │  │
│  │  - Tasks, Sessions, Settings (encrypted)           │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

External (Optional):
  - Tier 3: localhost:11434 (Ollama/GPT4All)
  - Tier 4: api.anthropic.com (Claude) / api.openai.com (GPT)
```

---

## 📋 Implementation Phases

### **Phase 1: Foundation - Chat UI + Command Parser**
**Timeline:** Week 1 (20-30 hours)
**Privacy:** 100% Private
**Dependencies:** None

#### Deliverables
1. Chat widget UI component
2. Command parsing engine
3. Integration with existing PomodoroTimer class
4. Basic command set
5. Mobile responsive design

#### File Structure
```
chat/
├── components/
│   ├── chat-widget.html         # Chat UI markup template
│   ├── chat-widget.js           # UI logic and event handlers
│   └── chat-widget.css          # Styling and animations
├── core/
│   ├── chat-manager.js          # Central chat orchestrator
│   ├── command-parser.js        # Tier 1: Pattern matching engine
│   └── response-generator.js    # Format responses
└── utils/
    ├── pattern-matcher.js       # Fuzzy matching utilities
    └── context-tracker.js       # Conversation context
```

#### Command Set (Tier 1)

**Task Management:**
- `add task [name]` - Create new task
  - Examples: "add task review PR", "create task update docs"
- `complete task [number|name]` - Mark task as done
  - Examples: "complete task 1", "finish review PR", "done with first task"
- `delete task [number|name]` - Remove task
  - Examples: "delete task 2", "remove update docs"
- `list tasks` - Show all active tasks
  - Examples: "show tasks", "what do I have to do", "my tasks"
- `archive completed` - Move completed tasks to archive
  - Examples: "archive done tasks", "clean up completed"

**Pomodoro Control:**
- `start pomodoro [for task]` - Begin work session
  - Examples: "start pomodoro", "begin timer for task 1", "work on review PR"
- `stop timer` - Stop current session
  - Examples: "stop", "pause timer", "cancel pomodoro"
- `start break` - Begin break manually
  - Examples: "take a break", "start short break", "start long break"
- `skip break` - Skip break and start work
  - Examples: "skip this break", "continue working"
- `timer status` - Check current timer state
  - Examples: "how much time left", "timer status", "what's the time"

**Statistics & Insights:**
- `show stats` - Display daily statistics
  - Examples: "my stats", "how am I doing", "today's progress"
- `show history` - View completed tasks
  - Examples: "what did I complete", "show history", "completed tasks"
- `export report` - Generate productivity report
  - Examples: "export today", "send report", "email stats"

**Settings:**
- `change work duration [minutes]` - Set work session length
  - Examples: "set work time to 30", "change pomodoro to 45 minutes"
- `change break duration [minutes]` - Set break length
  - Examples: "set break to 10 minutes", "change short break to 7"
- `enable/disable notifications` - Toggle notifications
  - Examples: "turn on notifications", "disable alerts"
- `change sound [type]` - Customize alert sounds
  - Examples: "change work sound", "set custom break alert"

**Help & Information:**
- `help` - Show available commands
  - Examples: "help", "what can you do", "commands"
- `about` - App information
  - Examples: "about", "version", "info"

#### Pattern Matching Engine

```javascript
// command-parser.js structure
class CommandParser {
  constructor() {
    this.patterns = {
      // Task patterns
      addTask: [
        /^(add|create|new|make)\s+(a\s+)?(task|todo)?\s*:?\s*(.+)$/i,
        /^(.+)\s+(to|as)\s+(task|todo)$/i
      ],
      completeTask: [
        /^(complete|done|finish|check|mark)\s+(task\s+)?(\d+|.+?)(\s+as\s+done)?$/i,
        /^task\s+(\d+|.+?)\s+(is\s+)?(done|complete|finished)$/i
      ],
      // ... more patterns
    };

    this.aliases = {
      'add': ['create', 'new', 'make'],
      'complete': ['done', 'finish', 'check', 'mark'],
      // ... more aliases
    };
  }

  parse(input) {
    // Normalize input
    const normalized = this.normalize(input);

    // Try to match patterns
    for (const [command, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match) {
          return this.buildCommand(command, match);
        }
      }
    }

    // Fuzzy matching for typos
    return this.fuzzyMatch(normalized);
  }

  fuzzyMatch(input) {
    // Levenshtein distance for command suggestions
    // Return best match or "unknown command" with suggestions
  }

  buildCommand(type, matchGroups) {
    // Extract parameters from regex groups
    return {
      type,
      params: this.extractParams(type, matchGroups),
      confidence: 1.0
    };
  }
}
```

#### Integration Points

**Modify script.js:**
```javascript
class PomodoroTimer {
  constructor() {
    // ... existing code ...

    // Add chat manager
    this.chatManager = new ChatManager(this);
  }

  // Add chat command handler
  async handleChatCommand(input) {
    try {
      const result = await this.chatManager.process(input);
      return result;
    } catch (error) {
      console.error('Chat error:', error);
      return {
        success: false,
        message: 'Sorry, I couldn\'t process that command.',
        suggestions: this.chatManager.getSuggestions()
      };
    }
  }

  // Expose methods for chat commands
  getChatContext() {
    return {
      tasks: this.tasks,
      completedTasks: this.completedTasks,
      isRunning: this.isRunning,
      currentTask: this.currentTask,
      timeRemaining: this.timeRemaining,
      todayStats: this.getTodayStats(),
      settings: this.settings
    };
  }
}
```

#### UI Components

**Chat Widget Design:**
```html
<!-- chat-widget.html structure -->
<div id="chat-widget" class="chat-widget collapsed">
  <!-- Floating button -->
  <button id="chat-toggle" class="chat-toggle-btn" aria-label="Open chat">
    <svg class="chat-icon"><!-- Chat bubble icon --></svg>
    <span class="unread-badge" hidden>1</span>
  </button>

  <!-- Expandable panel -->
  <div id="chat-panel" class="chat-panel" hidden>
    <!-- Header -->
    <div class="chat-header">
      <h3>Pomodoro Assistant</h3>
      <div class="chat-status">
        <span class="status-indicator" data-tier="1"></span>
        <span class="status-text">Command Mode</span>
      </div>
      <button class="chat-close" aria-label="Close chat">×</button>
    </div>

    <!-- Messages -->
    <div class="chat-messages" id="chat-messages">
      <!-- Welcome message -->
      <div class="message bot-message welcome">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <p>Hi! I can help you manage tasks and pomodoros.</p>
          <div class="suggestions">
            <button class="suggestion-chip">Add task</button>
            <button class="suggestion-chip">Start pomodoro</button>
            <button class="suggestion-chip">Show stats</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="chat-input-container">
      <textarea
        id="chat-input"
        class="chat-input"
        placeholder="Type a command or question..."
        rows="1"
        maxlength="500"
      ></textarea>
      <button id="chat-send" class="chat-send-btn" aria-label="Send message">
        <svg class="send-icon"><!-- Send icon --></svg>
      </button>
    </div>

    <!-- Footer -->
    <div class="chat-footer">
      <button class="chat-footer-btn" id="show-help">
        <svg class="icon"><!-- Help icon --></svg>
        Commands
      </button>
      <button class="chat-footer-btn" id="chat-settings">
        <svg class="icon"><!-- Settings icon --></svg>
        Settings
      </button>
    </div>
  </div>
</div>
```

**Responsive Behavior:**
- Desktop (>768px): Float bottom-right, max-width 400px
- Tablet (480-768px): Float bottom-right, max-width 350px
- Mobile (<480px): Full-screen overlay when expanded

---

### **Phase 2: Local Browser AI (WebLLM)**
**Timeline:** Week 2 (20-25 hours)
**Privacy:** 100% Private
**Dependencies:** Phase 1 complete

#### Deliverables
1. WebLLM integration (Tier 2)
2. Model download UI with progress
3. Intelligent response generation
4. Context management for conversations
5. Settings panel for AI preferences

#### Technology Stack
- **Library:** `@mlc-ai/web-llm` (v0.2.x)
- **Runtime:** WebGPU (with WebGL fallback)
- **Models:** Phi-3-mini (3.8B), Llama-3.2 (1B/3B), Gemma-2B

#### File Structure
```
chat/
└── ai-providers/
    ├── web-llm-provider.js      # Tier 2: WebLLM implementation
    ├── model-manager.js         # Handle model downloads
    └── conversation-context.js  # Manage chat context
```

#### Model Selection

| Model | Size | Speed | Quality | Recommended For |
|-------|------|-------|---------|-----------------|
| **Phi-3-mini** | 2.3GB | Medium | High | Default choice |
| **Llama-3.2-1B** | 1.1GB | Fast | Good | Low-end devices |
| **Gemma-2B** | 1.8GB | Fast | Good | Quick responses |
| **Qwen-1.5B** | 1.2GB | Fast | Medium | Structured tasks |

#### Implementation

```javascript
// web-llm-provider.js
import { CreateMLCEngine } from "@mlc-ai/web-llm";

class WebLLMProvider {
  constructor() {
    this.engine = null;
    this.modelId = null;
    this.isLoading = false;
    this.isReady = false;
  }

  async initialize(modelId = "Phi-3-mini-4k-instruct", progressCallback) {
    if (this.isReady && this.modelId === modelId) {
      return; // Already initialized
    }

    this.isLoading = true;
    this.modelId = modelId;

    try {
      // Initialize with progress tracking
      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          progressCallback?.({
            progress: progress.progress,
            text: progress.text,
            timeElapsed: progress.timeElapsed
          });
        }
      });

      this.isReady = true;
      this.isLoading = false;

      return { success: true };
    } catch (error) {
      this.isLoading = false;
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  async chat(messages, context) {
    if (!this.isReady) {
      throw new Error("Model not initialized");
    }

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(context);

    // Prepare messages
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Generate response
    const response = await this.engine.chat.completions.create({
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 256,
      stream: false
    });

    return response.choices[0].message.content;
  }

  buildSystemPrompt(context) {
    return `You are a helpful assistant for a Pomodoro timer application.

Current State:
- Active tasks: ${context.tasks.length}
- Tasks today: ${context.completedToday} completed
- Timer: ${context.isRunning ? 'Running' : 'Stopped'}
- Time left: ${context.timeRemaining || 'N/A'}

Tasks List:
${context.tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n')}

You can help users:
1. Manage tasks (add, complete, list, delete)
2. Control pomodoro timer (start, stop, check status)
3. View statistics and insights
4. Get productivity suggestions

Respond concisely and naturally. When asked to perform an action, respond with a clear confirmation and use this JSON format on a new line:
ACTION: {"type": "add_task", "params": {"text": "task name"}}

Available action types: add_task, complete_task, delete_task, start_timer, stop_timer, get_stats`;
  }

  async dispose() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.isReady = false;
    }
  }
}
```

#### Model Download UI

```javascript
// model-manager.js - UI for model download
class ModelManager {
  async promptModelDownload(modelId, estimatedSize) {
    return new Promise((resolve) => {
      // Show modal with download info
      const modal = this.createDownloadModal({
        modelName: this.getModelName(modelId),
        size: estimatedSize,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });

      document.body.appendChild(modal);
    });
  }

  createDownloadModal({ modelName, size, onConfirm, onCancel }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Download AI Model</h3>
        <p>To enable intelligent chat, download the ${modelName} model.</p>
        <div class="modal-info">
          <p><strong>Size:</strong> ${size}</p>
          <p><strong>Privacy:</strong> Runs locally, no data shared</p>
          <p><strong>One-time download:</strong> Model cached for future use</p>
        </div>
        <div class="progress-container" hidden>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p class="progress-text">Downloading...</p>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel-download">Cancel</button>
          <button class="btn-primary" id="confirm-download">Download</button>
        </div>
      </div>
    `;

    modal.querySelector('#confirm-download').onclick = onConfirm;
    modal.querySelector('#cancel-download').onclick = onCancel;

    return modal;
  }

  updateProgress(progress) {
    // Update progress bar during download
    const progressBar = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');

    if (progressBar) {
      progressBar.style.width = `${progress.progress * 100}%`;
      progressText.textContent = progress.text;
    }
  }
}
```

#### Settings Panel

```javascript
// Add to settings UI
<div class="settings-section">
  <h3>Chat Assistant</h3>

  <div class="setting-item">
    <label>AI Mode:</label>
    <select id="ai-mode">
      <option value="disabled">Disabled</option>
      <option value="commands">Commands Only (No AI)</option>
      <option value="local-ai" selected>Local AI (Private)</option>
      <option value="local-server">Local Server (Ollama/GPT4All)</option>
      <option value="cloud-ai">Cloud AI (API Key Required)</option>
    </select>
  </div>

  <div class="setting-item" id="model-selection" hidden>
    <label>Local Model:</label>
    <select id="local-model">
      <option value="Phi-3-mini-4k-instruct">Phi-3 Mini (2.3GB) - Recommended</option>
      <option value="Llama-3.2-1B-Instruct">Llama 3.2 1B (1.1GB) - Fast</option>
      <option value="gemma-2b-it">Gemma 2B (1.8GB) - Efficient</option>
    </select>
    <button id="download-model">Download Model</button>
    <button id="clear-model" hidden>Clear Downloaded Model</button>
  </div>

  <div class="setting-item">
    <label>Chat History:</label>
    <button id="clear-chat-history">Clear History</button>
  </div>

  <div class="setting-info">
    <p><strong>Privacy Note:</strong> Local AI runs entirely in your browser. No data is sent to external servers.</p>
  </div>
</div>
```

---

### **Phase 3: Local Server Support (Ollama/GPT4All)**
**Timeline:** Week 3 (15-20 hours)
**Privacy:** 100% Private
**Dependencies:** Phase 2 complete

#### Deliverables
1. Ollama API integration (Tier 3)
2. GPT4All support
3. Auto-detection of local servers
4. Configuration UI
5. Connection testing

#### File Structure
```
chat/
└── ai-providers/
    ├── ollama-provider.js       # Tier 3a: Ollama integration
    ├── gpt4all-provider.js      # Tier 3b: GPT4All integration
    └── server-detector.js       # Auto-detect local servers
```

#### Ollama Integration

```javascript
// ollama-provider.js
class OllamaProvider {
  constructor() {
    this.baseUrl = 'http://localhost:11434';
    this.model = 'llama3.2';
    this.isAvailable = false;
  }

  async detect() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        this.isAvailable = true;
        return {
          available: true,
          models: data.models.map(m => m.name)
        };
      }
    } catch (error) {
      this.isAvailable = false;
    }

    return { available: false };
  }

  async chat(messages, context) {
    const systemPrompt = this.buildSystemPrompt(context);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 256
        }
      })
    });

    const data = await response.json();
    return data.message.content;
  }

  buildSystemPrompt(context) {
    // Similar to WebLLM system prompt
    return `You are a helpful assistant for a Pomodoro timer...`;
  }
}
```

#### Server Detection & Setup Guide

```javascript
// server-detector.js
class ServerDetector {
  async detectServers() {
    const results = {
      ollama: await this.checkOllama(),
      gpt4all: await this.checkGPT4All(),
      lmstudio: await this.checkLMStudio()
    };

    return results;
  }

  async checkOllama() {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(2000)
      });
      return { available: response.ok, port: 11434 };
    } catch {
      return { available: false };
    }
  }

  async checkGPT4All() {
    // Check GPT4All default port
    try {
      const response = await fetch('http://localhost:4891/v1/models', {
        signal: AbortSignal.timeout(2000)
      });
      return { available: response.ok, port: 4891 };
    } catch {
      return { available: false };
    }
  }

  async checkLMStudio() {
    // Check LM Studio default port
    try {
      const response = await fetch('http://localhost:1234/v1/models', {
        signal: AbortSignal.timeout(2000)
      });
      return { available: response.ok, port: 1234 };
    } catch {
      return { available: false };
    }
  }
}
```

#### Setup Instructions UI

```html
<div class="server-setup-guide" id="ollama-guide">
  <h4>Setup Ollama (Recommended)</h4>
  <ol>
    <li>
      <strong>Install Ollama:</strong>
      <code>curl https://ollama.ai/install.sh | sh</code>
      <p>Or download from <a href="https://ollama.ai" target="_blank">ollama.ai</a></p>
    </li>
    <li>
      <strong>Download a model:</strong>
      <code>ollama pull llama3.2</code>
    </li>
    <li>
      <strong>Start the service:</strong>
      <code>ollama serve</code>
      <p>Service runs on <code>http://localhost:11434</code></p>
    </li>
    <li>
      <strong>Verify connection:</strong>
      <button id="test-ollama-connection">Test Connection</button>
      <span id="ollama-status"></span>
    </li>
  </ol>

  <div class="setup-tips">
    <h5>Recommended Models:</h5>
    <ul>
      <li><code>llama3.2</code> - Fast, 3B parameters (2GB)</li>
      <li><code>mistral</code> - Balanced, 7B parameters (4GB)</li>
      <li><code>phi3</code> - Efficient, 3.8B parameters (2.3GB)</li>
    </ul>
  </div>
</div>
```

---

### **Phase 4: Cloud AI Support (Optional)**
**Timeline:** Week 4 (10-15 hours)
**Privacy:** User provides API key (data shared with provider)
**Dependencies:** Phase 3 complete

#### Deliverables
1. Claude API integration (Tier 4a)
2. OpenAI GPT integration (Tier 4b)
3. Secure API key management
4. Cost tracking and limits
5. Privacy warnings

#### File Structure
```
chat/
└── ai-providers/
    ├── claude-provider.js       # Tier 4a: Claude API
    ├── openai-provider.js       # Tier 4b: OpenAI API
    └── api-key-manager.js       # Secure key storage
```

#### Claude API Integration

```javascript
// claude-provider.js
class ClaudeProvider {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.model = 'claude-sonnet-4-20250514';
    this.requestCount = 0;
    this.estimatedCost = 0;
  }

  setApiKey(apiKey) {
    // Encrypt and store in localStorage
    const encrypted = this.encrypt(apiKey);
    localStorage.setItem('claude_api_key_encrypted', encrypted);
    this.apiKey = apiKey;
  }

  async chat(messages, context) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 512,
          system: systemPrompt,
          messages: messages
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Track usage
      this.trackUsage(data.usage);

      return data.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  trackUsage(usage) {
    this.requestCount++;

    // Calculate cost (Claude Sonnet 4 pricing)
    const inputCost = (usage.input_tokens / 1000000) * 3;  // $3/M tokens
    const outputCost = (usage.output_tokens / 1000000) * 15; // $15/M tokens
    this.estimatedCost += inputCost + outputCost;

    // Save to localStorage
    localStorage.setItem('claude_usage_stats', JSON.stringify({
      requestCount: this.requestCount,
      estimatedCost: this.estimatedCost,
      lastUpdated: new Date().toISOString()
    }));
  }

  buildSystemPrompt(context) {
    return `You are an AI assistant for a Pomodoro timer application...`;
  }
}
```

#### API Key Management UI

```html
<div class="cloud-ai-settings" hidden>
  <div class="privacy-warning">
    <h4>⚠️ Privacy Notice</h4>
    <p>Cloud AI providers process your data on their servers. Review their privacy policies:</p>
    <ul>
      <li><a href="https://www.anthropic.com/privacy" target="_blank">Anthropic (Claude) Privacy Policy</a></li>
      <li><a href="https://openai.com/privacy" target="_blank">OpenAI Privacy Policy</a></li>
    </ul>
    <label>
      <input type="checkbox" id="accept-cloud-privacy" />
      I understand my task data will be sent to the selected provider
    </label>
  </div>

  <div class="api-key-section">
    <h4>API Key Configuration</h4>

    <div class="provider-selection">
      <label>Provider:</label>
      <select id="cloud-provider">
        <option value="claude">Claude (Anthropic)</option>
        <option value="openai">OpenAI GPT</option>
      </select>
    </div>

    <div class="api-key-input">
      <label>API Key:</label>
      <input
        type="password"
        id="api-key"
        placeholder="sk-ant-..."
        autocomplete="off"
      />
      <button id="toggle-key-visibility">Show</button>
    </div>

    <div class="api-key-actions">
      <button id="save-api-key" class="btn-primary">Save Key</button>
      <button id="test-api-key" class="btn-secondary">Test Connection</button>
      <button id="clear-api-key" class="btn-danger">Clear Key</button>
    </div>

    <div class="key-info">
      <p>Get your API key:</p>
      <ul>
        <li>Claude: <a href="https://console.anthropic.com/" target="_blank">console.anthropic.com</a></li>
        <li>OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a></li>
      </ul>
    </div>
  </div>

  <div class="usage-tracking">
    <h4>Usage & Cost Tracking</h4>
    <div class="usage-stats">
      <div class="stat">
        <span class="stat-label">Requests:</span>
        <span class="stat-value" id="request-count">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Estimated Cost:</span>
        <span class="stat-value" id="estimated-cost">$0.00</span>
      </div>
    </div>
    <button id="reset-usage-stats">Reset Stats</button>
  </div>

  <div class="cost-limits">
    <h4>Cost Limits (Optional)</h4>
    <label>
      <input type="checkbox" id="enable-cost-limit" />
      Stop using cloud AI if cost exceeds:
    </label>
    <input type="number" id="cost-limit" value="5.00" step="0.50" min="0" />
    <span>USD per month</span>
  </div>
</div>
```

---

### **Phase 5: Testing & Polish**
**Timeline:** Week 5 (10-15 hours)
**Focus:** Quality assurance, performance, UX

#### Testing Checklist

**Functional Testing:**
- [ ] All command patterns work correctly
- [ ] Task CRUD operations via chat
- [ ] Timer control via chat
- [ ] Statistics queries accurate
- [ ] Multi-turn conversations work
- [ ] Context maintained across messages
- [ ] Error handling graceful
- [ ] Fallback to command parser works

**AI Provider Testing:**
- [ ] Tier 1 (Parser): All patterns match
- [ ] Tier 2 (WebLLM): Model downloads correctly
- [ ] Tier 2: Responses accurate and relevant
- [ ] Tier 3 (Ollama): Connection stable
- [ ] Tier 3: Multiple models supported
- [ ] Tier 4 (Cloud): API calls succeed
- [ ] Tier 4: Cost tracking accurate
- [ ] Switching between tiers works seamlessly

**UI/UX Testing:**
- [ ] Chat button visible and accessible
- [ ] Panel opens/closes smoothly
- [ ] Messages render correctly
- [ ] Input field responsive
- [ ] Mobile layout works
- [ ] Keyboard shortcuts work
- [ ] Suggestions helpful
- [ ] Loading states clear
- [ ] Error messages informative

**Performance Testing:**
- [ ] Chat widget loads quickly (<100ms)
- [ ] Command parsing fast (<50ms)
- [ ] WebLLM responses reasonable (<5s)
- [ ] No memory leaks
- [ ] Works with 1000+ messages
- [ ] Model caching effective
- [ ] No UI blocking

**Privacy & Security:**
- [ ] No data sent without user consent
- [ ] API keys encrypted
- [ ] localStorage secure
- [ ] No console logging of sensitive data
- [ ] Privacy warnings shown
- [ ] User can delete all chat data
- [ ] Export functionality respects privacy

**Browser Compatibility:**
- [ ] Chrome/Edge (WebGPU)
- [ ] Firefox (WebGL fallback)
- [ ] Safari (WebGPU on iOS 17+)
- [ ] Mobile browsers
- [ ] PWA installation works
- [ ] Offline mode functional

---

## 🎨 User Experience Flow

### First-Time User Experience

```
1. User opens Pomodoro app
   ↓
2. Sees new chat button (bottom-right, subtle animation)
   ↓
3. Clicks chat button
   ↓
4. Chat panel opens with welcome message:
   "Hi! I can help you manage tasks and pomodoros.
    Try: 'add task review PR' or 'start pomodoro'"
   ↓
5. User types: "add task write documentation"
   ↓
6. Bot responds instantly (Tier 1 parser):
   "✓ Added task: write documentation"
   ↓
7. Task appears in main UI simultaneously
   ↓
8. User impressed, continues using chat
```

### Upgrading to Local AI

```
1. User goes to Settings → Chat Assistant
   ↓
2. Selects "Local AI (Private)"
   ↓
3. Modal appears:
   "Download AI Model?
    - Phi-3 Mini (2.3GB)
    - Runs locally, no data shared
    - One-time download"
   [Cancel] [Download]
   ↓
4. User clicks Download
   ↓
5. Progress bar shows download (2-5 minutes)
   ↓
6. Model cached in browser
   ↓
7. Chat now has intelligent responses:

   User: "I need to focus today"
   AI: "Based on your history, you're most productive
        in the morning. You have 3 tasks. I recommend
        starting with 'Write documentation' - you
        typically finish writing tasks in 2 pomodoros.
        Shall I start a timer?"

   User: "yes"
   AI: "✓ Starting 25-minute session for 'Write documentation'"
```

### Using Local Server (Power Users)

```
1. User installs Ollama on their computer
   ↓
2. Runs: ollama pull llama3.2
   ↓
3. Starts: ollama serve
   ↓
4. Opens Pomodoro app
   ↓
5. App auto-detects Ollama:
   "🎉 Local AI server detected!
    Would you like to use it for better responses?
    [No Thanks] [Use Local Server]"
   ↓
6. User clicks "Use Local Server"
   ↓
7. Chat now uses more powerful model
   ↓
8. Better understanding, longer context, faster responses
```

---

## 📊 Comparison Matrix

| Feature | Tier 1: Parser | Tier 2: WebLLM | Tier 3: Server | Tier 4: Cloud |
|---------|----------------|----------------|----------------|---------------|
| **Privacy** | 100% | 100% | 100% | Shared |
| **Setup** | None | 1-time download | Install app | API key |
| **Cost** | Free | Free | Free | ~$5/month |
| **Internet** | No | Download only | No | Yes |
| **Speed** | Instant | 2-5s | 1-3s | 1-2s |
| **Intelligence** | Basic | Good | Very Good | Excellent |
| **Context Length** | N/A | 4K tokens | 8K-128K | 200K+ |
| **Device Support** | All | Modern browsers | Desktop | All |
| **Offline** | Yes | Yes | Yes | No |

---

## 🔐 Privacy & Security Considerations

### Data Flow Analysis

**Tier 1 (Command Parser):**
- ✅ No external connections
- ✅ No AI processing
- ✅ Pattern matching only
- ✅ Perfect privacy

**Tier 2 (WebLLM):**
- ✅ Model runs in browser
- ✅ No server communication
- ✅ Data stays local
- ⚠️ Initial model download (cached)
- ✅ Excellent privacy

**Tier 3 (Local Server):**
- ✅ Runs on user's computer
- ✅ localhost connections only
- ✅ No external data sharing
- ✅ User controls the server
- ✅ Perfect privacy

**Tier 4 (Cloud API):**
- ⚠️ Data sent to cloud provider
- ⚠️ Task content shared
- ⚠️ Subject to provider's privacy policy
- ✅ User opts-in explicitly
- ✅ API key encrypted locally
- ⚠️ Moderate privacy

### Security Measures

1. **API Key Encryption:**
   ```javascript
   // Use Web Crypto API for encryption
   async function encryptApiKey(apiKey) {
     const encoder = new TextEncoder();
     const data = encoder.encode(apiKey);

     // Generate key from user password or device-specific data
     const keyMaterial = await window.crypto.subtle.importKey(
       "raw",
       await getDeviceFingerprint(),
       "PBKDF2",
       false,
       ["deriveBits", "deriveKey"]
     );

     const key = await window.crypto.subtle.deriveKey(
       {
         name: "PBKDF2",
         salt: new Uint8Array(16),
         iterations: 100000,
         hash: "SHA-256"
       },
       keyMaterial,
       { name: "AES-GCM", length: 256 },
       false,
       ["encrypt", "decrypt"]
     );

     const iv = window.crypto.getRandomValues(new Uint8Array(12));
     const encrypted = await window.crypto.subtle.encrypt(
       { name: "AES-GCM", iv },
       key,
       data
     );

     return { encrypted, iv };
   }
   ```

2. **Chat History Privacy:**
   - Optional: Auto-delete chat history after N days
   - User can clear history anytime
   - History not synced to cloud by default
   - Encrypted in localStorage

3. **Privacy Warnings:**
   - Clear indication of which tier is active
   - Warning before enabling cloud AI
   - Link to provider privacy policies
   - Opt-in consent required

4. **Data Minimization:**
   - Only send necessary context to AI
   - Don't include sensitive metadata
   - Truncate long task lists
   - Anonymize device IDs in cloud mode

---

## 🚀 Deployment Strategy

### Phase Rollout

**Alpha (Internal Testing):**
- Week 1-2: Tier 1 (Parser) complete
- Limited testers
- Gather feedback on UI/UX
- Iterate on command patterns

**Beta (Public Testing):**
- Week 3-4: Tier 2 (WebLLM) added
- Wider tester group
- Test performance across devices
- Monitor model download issues
- Collect usage analytics (privacy-respecting)

**v1.0 Release:**
- Week 5: All tiers complete
- Documentation ready
- Tutorial/onboarding flow
- Public announcement
- Submit to Product Hunt

**v1.1+ (Future):**
- Add more command shortcuts
- Improve AI prompts based on usage
- Add voice input (optional)
- Multi-language support
- Custom AI personalities

---

## 📚 Documentation Requirements

### User Documentation

1. **Getting Started Guide:**
   - How to open chat
   - Basic commands list
   - Examples of common tasks
   - Tips for best results

2. **AI Modes Guide:**
   - Explanation of each tier
   - How to switch modes
   - Setup instructions for local server
   - Cloud AI setup and privacy

3. **Privacy Guide:**
   - Data handling explanation
   - What data stays local vs. cloud
   - How to review/delete chat history
   - Security best practices

4. **Troubleshooting:**
   - Model download issues
   - Local server connection problems
   - API key errors
   - Performance optimization tips

### Developer Documentation

1. **Architecture Overview:**
   - System design
   - Component relationships
   - Data flow diagrams
   - API contracts

2. **Extension Guide:**
   - Adding new AI providers
   - Creating custom commands
   - Modifying prompts
   - Integration points

3. **Testing Guide:**
   - Unit test examples
   - Integration test scenarios
   - Performance benchmarks
   - Browser compatibility matrix

---

## 🎯 Success Metrics

### User Engagement
- % of users who try chat feature
- Average messages per session
- Daily active chat users
- Command vs. traditional UI usage ratio

### Performance
- Average response time per tier
- Model download completion rate
- Error rate per provider
- Chat widget load time

### Adoption
- Distribution of users across tiers
- Tier 1 → Tier 2 upgrade rate
- Cloud AI opt-in rate
- Feature retention (30-day)

### Privacy
- % users choosing privacy-first tiers
- Cloud AI usage patterns
- API key rotation rate
- Data export requests

---

## 🔮 Future Enhancements

### Phase 6+ (Post-Launch)

**Voice Interface:**
- Web Speech API integration
- Voice commands for hands-free operation
- Text-to-speech for AI responses
- Multilingual support

**Smart Suggestions:**
- Task prioritization AI
- Optimal break time recommendations
- Focus time predictions
- Productivity pattern analysis

**Integrations:**
- Calendar sync (Google/Outlook)
- Todoist/Notion import
- GitHub issue integration
- Slack notifications

**Advanced AI Features:**
- Multi-turn task breakdowns
- Project planning assistance
- Time estimation improvements
- Personalized productivity coaching

**Accessibility:**
- Screen reader optimization
- High contrast mode
- Keyboard-only navigation
- Customizable font sizes

**Social Features (Privacy-Preserving):**
- Optional anonymous productivity stats sharing
- Compare with community averages
- Achievement badges
- Public accountability (opt-in)

---

## 🛠️ Technical Dependencies

### npm Packages

```json
{
  "dependencies": {
    "@mlc-ai/web-llm": "^0.2.46",
    "@xenova/transformers": "^2.17.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0",
    "vitest": "^1.2.0"
  }
}
```

### Browser Requirements

**Minimum:**
- Chrome 113+ / Edge 113+
- Firefox 115+ (limited WebGPU)
- Safari 17+ (iOS/macOS)

**Recommended:**
- Chrome 120+ / Edge 120+
- 8GB RAM (for local AI)
- GPU with 4GB VRAM (optional, for faster AI)

### Build System

```bash
# Development
npm install
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

---

## 📝 Implementation Checklist

### Phase 1: Foundation ✓ Ready to Start
- [ ] Create chat widget UI component
- [ ] Implement command parser
- [ ] Add pattern matching engine
- [ ] Integrate with PomodoroTimer class
- [ ] Add keyboard shortcuts
- [ ] Implement message rendering
- [ ] Add suggestion chips
- [ ] Create mobile responsive layout
- [ ] Add animations and transitions
- [ ] Write unit tests for parser
- [ ] Update main index.html
- [ ] Update styles.css

### Phase 2: WebLLM
- [ ] Install @mlc-ai/web-llm dependency
- [ ] Create WebLLM provider class
- [ ] Implement model download UI
- [ ] Add progress tracking
- [ ] Create model manager
- [ ] Implement conversation context
- [ ] Add settings panel for AI mode
- [ ] Test on multiple browsers
- [ ] Optimize model caching
- [ ] Add error handling
- [ ] Create WebLLM tests
- [ ] Update documentation

### Phase 3: Local Server
- [ ] Create Ollama provider class
- [ ] Implement server auto-detection
- [ ] Add GPT4All support
- [ ] Create setup guide UI
- [ ] Implement connection testing
- [ ] Add model selection
- [ ] Handle connection failures gracefully
- [ ] Create server provider tests
- [ ] Update documentation

### Phase 4: Cloud AI
- [ ] Create Claude provider class
- [ ] Implement OpenAI provider
- [ ] Add API key management
- [ ] Implement key encryption
- [ ] Create usage tracking
- [ ] Add cost estimation
- [ ] Implement cost limits
- [ ] Add privacy warnings
- [ ] Create provider tests
- [ ] Update privacy policy

### Phase 5: Polish
- [ ] Comprehensive testing all tiers
- [ ] Cross-browser testing
- [ ] Mobile testing (iOS/Android)
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Security review
- [ ] Create user tutorial
- [ ] Write complete documentation
- [ ] Create demo video
- [ ] Prepare release notes

---

## 🎓 Resources & References

### WebLLM Documentation
- GitHub: https://github.com/mlc-ai/web-llm
- Demos: https://webllm.mlc.ai/
- Model list: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts

### Local AI Servers
- Ollama: https://ollama.ai/
- GPT4All: https://gpt4all.io/
- LM Studio: https://lmstudio.ai/

### API Documentation
- Claude API: https://docs.anthropic.com/
- OpenAI API: https://platform.openai.com/docs/

### Web Technologies
- WebGPU: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

---

## 🤝 Contributing

This is a privacy-first open-source project. Contributions welcome!

### Guidelines
1. Maintain privacy-first principles
2. No telemetry without explicit consent
3. Keep dependencies minimal
4. Write tests for new features
5. Update documentation
6. Follow existing code style

### Areas Needing Help
- [ ] Additional language support
- [ ] More AI provider integrations
- [ ] Performance optimizations
- [ ] Accessibility improvements
- [ ] Documentation translations
- [ ] Testing on diverse devices

---

## 📄 License

MIT License - Privacy-focused, open-source, community-driven.

---

## 📞 Support & Feedback

- GitHub Issues: Report bugs and request features
- Discussions: Share ideas and ask questions
- Privacy concerns: privacy@pomodoro-app.dev (hypothetical)
- Security issues: security@pomodoro-app.dev (hypothetical)

---

**Document Status:** Draft v1.0
**Next Review:** After Phase 1 completion
**Maintainer:** Development Team
**Last Updated:** 2025-10-21
