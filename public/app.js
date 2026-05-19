const state = {
  tasks: [],
  subagents: [],
  selectedTaskId: null
};

const taskForm = document.querySelector('#taskForm');
const taskList = document.querySelector('#taskList');
const taskDetail = document.querySelector('#taskDetail');
const taskCount = document.querySelector('#taskCount');
const formMessage = document.querySelector('#formMessage');
const runButton = document.querySelector('#runButton');
const refreshButton = document.querySelector('#refreshButton');
const subagentSelect = taskForm.elements.subagent;

await init();

async function init() {
  state.subagents = await api('/api/subagents');
  subagentSelect.innerHTML = state.subagents
    .map((subagent) => `<option value="${subagent.id}">${subagent.label}</option>`)
    .join('');
  bindEvents();
  await loadTasks();
}

function bindEvents() {
  refreshButton.addEventListener('click', loadTasks);
  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = 'Creating...';
    const formData = new FormData(taskForm);
    try {
      const task = await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(formData))
      });
      state.selectedTaskId = task.id;
      taskForm.reset();
      formMessage.textContent = 'Task created.';
      await loadTasks();
    } catch (error) {
      formMessage.textContent = error.message;
    }
  });

  runButton.addEventListener('click', async () => {
    if (!state.selectedTaskId) return;
    runButton.disabled = true;
    runButton.textContent = 'Running...';
    try {
      await api(`/api/tasks/${state.selectedTaskId}/run`, { method: 'POST' });
      await loadTasks();
    } catch (error) {
      alert(error.message);
    } finally {
      runButton.textContent = 'Run';
      renderDetail();
    }
  });
}

async function loadTasks() {
  state.tasks = await api('/api/tasks');
  if (!state.selectedTaskId && state.tasks.length > 0) {
    state.selectedTaskId = state.tasks[0].id;
  }
  renderTasks();
  renderDetail();
}

function renderTasks() {
  taskCount.textContent = String(state.tasks.length);
  taskList.innerHTML = state.tasks.length
    ? state.tasks.map((task) => `
      <button class="task-item ${task.id === state.selectedTaskId ? 'active' : ''}" data-task-id="${task.id}" type="button">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="status ${task.status}">${task.status}</span>
        <span class="task-meta">${agentLabel(task.subagent)} · ${escapeHtml(task.workspacePath)}</span>
        <span class="task-meta">Updated ${formatDate(task.updatedAt)}</span>
      </button>
    `).join('')
    : '<p class="empty">No tasks yet.</p>';

  taskList.querySelectorAll('[data-task-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTaskId = button.dataset.taskId;
      renderTasks();
      renderDetail();
    });
  });
}

function renderDetail() {
  const task = state.tasks.find((item) => item.id === state.selectedTaskId);
  if (!task) {
    runButton.disabled = true;
    taskDetail.innerHTML = '<div class="empty">Select a task.</div>';
    return;
  }

  runButton.disabled = task.status === 'Running';
  taskDetail.innerHTML = `
    <div class="detail-content">
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        <span class="status ${task.status}">${task.status}</span>
      </div>
      <div class="detail-grid">
        <span>Subagent: ${agentLabel(task.subagent)}</span>
        <span>Workspace: ${escapeHtml(task.workspacePath)}</span>
        <span>Created: ${formatDate(task.createdAt)}</span>
        <span>Updated: ${formatDate(task.updatedAt)}</span>
        <span>Started: ${formatDate(task.startedAt)}</span>
        <span>Finished: ${formatDate(task.finishedAt)}</span>
        <span>Session: ${escapeHtml(task.sessionRef ?? 'N/A')}</span>
        <span>Process: ${escapeHtml(task.processRef ?? 'N/A')}</span>
      </div>
      <section>
        <h3>Description</h3>
        <p>${escapeHtml(task.description)}</p>
      </section>
      <section>
        <h3>Output</h3>
        <pre>${escapeHtml(task.output || 'No output yet.')}</pre>
      </section>
      <section>
        <h3>Log</h3>
        <pre>${escapeHtml(task.log || 'No log yet.')}</pre>
      </section>
      ${task.error ? `<section><h3>Error</h3><pre>${escapeHtml(task.error)}</pre></section>` : ''}
    </div>
  `;
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
