const state = {
  projects: [],
  tasks: [],
  subagents: [],
  selectedProjectId: null,
  selectedTaskId: null
};

// Main DOM elements
const projectList = document.querySelector('#projectList');
const taskList = document.querySelector('#taskList');
const chatArea = document.querySelector('#chatArea');
const chatInputArea = document.querySelector('#chatInputArea');
const chatInput = document.querySelector('#chatInput');
const sendChatBtn = document.querySelector('#sendChatBtn');
const refreshButton = document.querySelector('#refreshButton');
const detailTitle = document.querySelector('#detailTitle');

// Modal DOM elements
const projectModal = document.querySelector('#projectModal');
const newProjectBtn = document.querySelector('#newProjectBtn');
const closeProjectModal = document.querySelector('#closeProjectModal');
const projectForm = document.querySelector('#projectForm');
const projectFormMessage = document.querySelector('#projectFormMessage');

const taskModal = document.querySelector('#taskModal');
const newTaskBtn = document.querySelector('#newTaskBtn');
const closeTaskModal = document.querySelector('#closeTaskModal');
const taskForm = document.querySelector('#taskForm');
const formMessage = document.querySelector('#formMessage');
const taskProjectSelect = document.querySelector('#taskProjectSelect');
const taskSubagentSelect = document.querySelector('#taskSubagentSelect');

// Init application
await init();

async function init() {
  // Fetch initial metadata
  state.subagents = await api('/api/subagents');
  taskSubagentSelect.innerHTML = state.subagents
    .map((subagent) => `<option value="${subagent.id}">${subagent.label}</option>`)
    .join('');

  bindEvents();
  await loadData();
}

function bindEvents() {
  refreshButton.addEventListener('click', loadData);

  // Modal Open/Close triggers
  newProjectBtn.addEventListener('click', () => {
    projectModal.style.display = 'flex';
    projectFormMessage.textContent = '';
  });
  closeProjectModal.addEventListener('click', () => {
    projectModal.style.display = 'none';
  });

  newTaskBtn.addEventListener('click', () => {
    // Populate projects select with current projects
    taskProjectSelect.innerHTML = state.projects
      .map(p => `<option value="${p.id}" ${p.id === state.selectedProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
      .join('');
    taskModal.style.display = 'flex';
    formMessage.textContent = '';
  });
  closeTaskModal.addEventListener('click', () => {
    taskModal.style.display = 'none';
  });

  // Close modals clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === projectModal) projectModal.style.display = 'none';
    if (event.target === taskModal) taskModal.style.display = 'none';
  });

  // Project Form Submit
  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    projectFormMessage.textContent = 'Creating project...';
    const formData = new FormData(projectForm);
    try {
      const project = await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(formData))
      });
      projectForm.reset();
      projectModal.style.display = 'none';
      state.selectedProjectId = project.id;
      await loadData();
    } catch (error) {
      projectFormMessage.textContent = error.message;
    }
  });

  // Task Form Submit
  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = 'Creating task...';
    const formData = new FormData(taskForm);
    try {
      const task = await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(formData))
      });
      taskForm.reset();
      taskModal.style.display = 'none';
      state.selectedTaskId = task.id;
      await loadData();
    } catch (error) {
      formMessage.textContent = error.message;
    }
  });

  // Chat Send Trigger
  sendChatBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
}

async function loadData() {
  try {
    state.projects = await api('/api/projects');
    state.tasks = await api('/api/tasks');

    // Default project selection logic
    if (state.projects.length > 0) {
      if (!state.selectedProjectId || !state.projects.some(p => p.id === state.selectedProjectId)) {
        state.selectedProjectId = state.projects[0].id;
      }
    } else {
      state.selectedProjectId = null;
    }

    // Default task selection logic (within active project)
    const filteredTasks = state.tasks.filter(t => t.projectId === state.selectedProjectId);
    if (filteredTasks.length > 0) {
      if (!state.selectedTaskId || !filteredTasks.some(t => t.id === state.selectedTaskId)) {
        state.selectedTaskId = filteredTasks[0].id;
      }
    } else {
      state.selectedTaskId = null;
    }

    renderProjects();
    renderTasks();
    renderChat();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

function renderProjects() {
  projectList.innerHTML = state.projects.length
    ? state.projects.map((p) => `
      <button class="project-item ${p.id === state.selectedProjectId ? 'active' : ''}" data-project-id="${p.id}" type="button">
        <strong>${escapeHtml(p.name)}</strong>
        <p>${escapeHtml(p.description || 'No description')}</p>
      </button>
    `).join('')
    : '<p class="empty">No projects yet.</p>';

  projectList.querySelectorAll('[data-project-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedProjectId = button.dataset.projectId;
      
      // Auto select first task of the selected project
      const filteredTasks = state.tasks.filter(t => t.projectId === state.selectedProjectId);
      state.selectedTaskId = filteredTasks.length > 0 ? filteredTasks[0].id : null;

      renderProjects();
      renderTasks();
      renderChat();
    });
  });
}

function renderTasks() {
  const filteredTasks = state.tasks.filter(t => t.projectId === state.selectedProjectId);

  taskList.innerHTML = filteredTasks.length
    ? filteredTasks.map((task) => `
      <button class="task-item ${task.id === state.selectedTaskId ? 'active' : ''}" data-task-id="${task.id}" type="button">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="status ${task.status}">${task.status}</span>
        <span class="task-meta">${agentLabel(task.subagent)} · ${escapeHtml(task.workspacePath)}</span>
        <span class="task-meta">Updated ${formatDate(task.updatedAt)}</span>
      </button>
    `).join('')
    : '<p class="empty">No tasks in this project.</p>';

  taskList.querySelectorAll('[data-task-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTaskId = button.dataset.taskId;
      renderTasks();
      renderChat();
    });
  });
}

function renderChat() {
  const task = state.tasks.find((item) => item.id === state.selectedTaskId);
  
  if (!task) {
    detailTitle.textContent = 'Task Chat';
    chatArea.classList.add('empty');
    chatArea.innerHTML = 'Select a task to start chatting.';
    chatInputArea.style.display = 'none';
    return;
  }

  detailTitle.textContent = `Chat: ${escapeHtml(task.title)}`;
  chatArea.classList.remove('empty');
  chatInputArea.style.display = 'flex';

  const isRunning = task.status === 'Running';
  chatInput.disabled = isRunning;
  sendChatBtn.disabled = isRunning;
  
  if (isRunning) {
    chatInput.placeholder = 'Subagent is running... Please wait.';
    sendChatBtn.textContent = 'Running...';
  } else {
    chatInput.placeholder = 'Type a message to prompt the subagent... (or leave empty to run)';
    sendChatBtn.textContent = 'Send';
  }

  // Render chat history
  const messages = task.messages || [];
  if (messages.length === 0) {
    chatArea.innerHTML = `
      <div class="empty-chat-hint" style="padding: 20px; color: hsl(var(--text-secondary)); text-align: left;">
        <p style="margin-bottom: 8px;"><strong>Nhiệm vụ:</strong> ${escapeHtml(task.title)}</p>
        <p style="margin-bottom: 8px;"><strong>Subagent:</strong> ${agentLabel(task.subagent)}</p>
        <p style="margin-bottom: 8px;"><strong>Workspace:</strong> <code>${escapeHtml(task.workspacePath)}</code></p>
        <p style="margin-bottom: 12px; border-left: 3px solid var(--glass-border); padding-left: 10px; font-style: italic;">
          "${escapeHtml(task.description)}"
        </p>
        <p style="font-size: 13px; color: hsl(var(--text-muted)); text-align: center; margin-top: 24px;">
          Nhiệm vụ này chưa được bắt đầu. Nhập tin nhắn điều chỉnh hoặc nhấn gửi trực tiếp để chạy subagent lần đầu với mô tả trên.
        </p>
      </div>
    `;
  } else {
    chatArea.innerHTML = messages.map((msg) => `
      <div class="chat-message ${msg.sender}">
        <span class="sender-label">${msg.sender === 'user' ? 'User' : 'Subagent'}</span>
        ${msg.sender === 'user' 
          ? `<p style="white-space: pre-wrap; text-align: left;">${escapeHtml(msg.content)}</p>` 
          : `<pre><code>${escapeHtml(msg.content)}</code></pre>`
        }
        <span class="msg-time">${formatDate(msg.createdAt)}</span>
      </div>
    `).join('');
  }

  // Auto-scroll chat area to bottom
  chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendChatMessage() {
  const task = state.tasks.find((item) => item.id === state.selectedTaskId);
  if (!task || task.status === 'Running') return;

  const promptText = chatInput.value.trim();
  
  // Disable input immediately
  chatInput.disabled = true;
  sendChatBtn.disabled = true;
  sendChatBtn.textContent = 'Running...';
  chatInput.placeholder = 'Subagent is running... Please wait.';

  try {
    const payload = {};
    if (promptText) {
      payload.prompt = promptText;
    }
    chatInput.value = '';

    await api(`/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    // Reload data and select the same task
    await loadData();
  } catch (error) {
    alert('Failed to run task: ' + error.message);
    await loadData();
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function agentLabel(id) {
  return state.subagents.find((subagent) => subagent.id === id)?.label ?? id;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'N/A';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
