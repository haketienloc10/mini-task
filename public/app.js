const BOARD_STATUSES = ['Assigned', 'Running', 'Done', 'Failed'];

const state = {
  projects: [],
  tasks: [],
  subagents: [],
  selectedProjectId: null,
  selectedTaskId: null
};

const refs = {
  metricProjects: document.querySelector('#metricProjects'),
  metricActiveTasks: document.querySelector('#metricActiveTasks'),
  metricRunningAgents: document.querySelector('#metricRunningAgents'),
  metricDoneTasks: document.querySelector('#metricDoneTasks'),
  projectList: document.querySelector('#projectList'),
  activeProjectName: document.querySelector('#activeProjectName'),
  activeProjectMeta: document.querySelector('#activeProjectMeta'),
  projectOverview: document.querySelector('#projectOverview'),
  agentList: document.querySelector('#agentList'),
  chatArea: document.querySelector('#chatArea'),
  chatInputArea: document.querySelector('#chatInputArea'),
  chatInput: document.querySelector('#chatInput'),
  sendChatBtn: document.querySelector('#sendChatBtn'),
  refreshButton: document.querySelector('#refreshButton'),
  detailTitle: document.querySelector('#detailTitle'),
  themeToggle: document.querySelector('#themeToggle'),
  themeText: document.querySelector('.theme-text'),
  metaThemeColor: document.querySelector('#meta-theme-color'),
  projectModal: document.querySelector('#projectModal'),
  newProjectBtn: document.querySelector('#newProjectBtn'),
  closeProjectModal: document.querySelector('#closeProjectModal'),
  projectForm: document.querySelector('#projectForm'),
  projectFormMessage: document.querySelector('#projectFormMessage'),
  taskModal: document.querySelector('#taskModal'),
  newTaskBtn: document.querySelector('#newTaskBtn'),
  closeTaskModal: document.querySelector('#closeTaskModal'),
  taskForm: document.querySelector('#taskForm'),
  formMessage: document.querySelector('#formMessage'),
  taskProjectSelect: document.querySelector('#taskProjectSelect'),
  taskSubagentSelect: document.querySelector('#taskSubagentSelect')
};

await init();

async function init() {
  bindEvents();
  syncThemeToggle();
  await loadData();
}

function bindEvents() {
  refs.refreshButton.addEventListener('click', loadData);
  refs.themeToggle.addEventListener('click', toggleTheme);

  refs.newProjectBtn.addEventListener('click', () => openModal(refs.projectModal, refs.projectFormMessage));
  refs.closeProjectModal.addEventListener('click', () => closeModal(refs.projectModal));

  refs.newTaskBtn.addEventListener('click', async () => {
    refs.taskProjectSelect.innerHTML = state.projects
      .map((project) => `<option value="${project.id}" ${project.id === state.selectedProjectId ? 'selected' : ''}>${escapeHtml(project.name)}</option>`)
      .join('');
    await loadSubagents(refs.taskProjectSelect.value);
    renderSubagentOptions();
    openModal(refs.taskModal, refs.formMessage);
  });
  refs.closeTaskModal.addEventListener('click', () => closeModal(refs.taskModal));

  window.addEventListener('click', (event) => {
    if (event.target === refs.projectModal) closeModal(refs.projectModal);
    if (event.target === refs.taskModal) closeModal(refs.taskModal);
  });

  refs.projectForm.addEventListener('submit', createProject);
  refs.taskForm.addEventListener('submit', createTask);
  refs.taskProjectSelect.addEventListener('change', async () => {
    await loadSubagents(refs.taskProjectSelect.value);
    renderSubagentOptions();
  });
  refs.sendChatBtn.addEventListener('click', sendChatMessage);
  refs.chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
}

async function createProject(event) {
  event.preventDefault();
  refs.projectFormMessage.textContent = 'Creating project...';

  try {
    const project = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(refs.projectForm)))
    });
    refs.projectForm.reset();
    closeModal(refs.projectModal);
    state.selectedProjectId = project.id;
    state.selectedTaskId = null;
    await loadData();
  } catch (error) {
    refs.projectFormMessage.textContent = error.message;
  }
}

async function createTask(event) {
  event.preventDefault();
  refs.formMessage.textContent = 'Creating task...';

  try {
    const task = await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(refs.taskForm)))
    });
    refs.taskForm.reset();
    closeModal(refs.taskModal);
    state.selectedProjectId = task.projectId;
    state.selectedTaskId = task.id;
    await loadData();
  } catch (error) {
    refs.formMessage.textContent = error.message;
  }
}

async function loadData() {
  state.projects = await api('/api/projects');
  state.tasks = await api('/api/tasks');

  if (state.projects.length && !state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0].id;
  }
  if (!state.projects.length) {
    state.selectedProjectId = null;
  }

  const projectTasks = selectedProjectTasks();
  if (projectTasks.length && !projectTasks.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = projectTasks[0].id;
  }
  if (!projectTasks.length) {
    state.selectedTaskId = null;
  }

  await loadSubagents(state.selectedProjectId);
  render();
}

async function loadSubagents(projectId) {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  state.subagents = await api(`/api/subagents${suffix}`);
}

function renderSubagentOptions() {
  refs.taskSubagentSelect.innerHTML = state.subagents
    .map((subagent) => `<option value="${subagent.id}">${escapeHtml(subagent.label)}</option>`)
    .join('');
}

function render() {
  refs.newTaskBtn.disabled = !state.projects.length;
  renderMetrics();
  renderProjects();
  renderProjectOverview();
  renderTaskBoard();
  renderAgents();
  renderChat();
}

function renderMetrics() {
  const activeTasks = state.tasks.filter((task) => task.status === 'Assigned' || task.status === 'Running').length;
  refs.metricProjects.textContent = state.projects.length;
  refs.metricActiveTasks.textContent = activeTasks;
  refs.metricRunningAgents.textContent = state.tasks.filter((task) => task.status === 'Running').length;
  refs.metricDoneTasks.textContent = state.tasks.filter((task) => task.status === 'Done').length;
}

function renderProjects() {
  if (!state.projects.length) {
    refs.projectList.innerHTML = '<p class="empty">No projects yet.</p>';
    return;
  }

  refs.projectList.innerHTML = state.projects.map((project) => {
    const tasks = tasksForProject(project.id);
    const running = tasks.filter((task) => task.status === 'Running').length;
    const done = tasks.filter((task) => task.status === 'Done').length;
    return `
      <button class="project-item ${project.id === state.selectedProjectId ? 'active' : ''}" data-project-id="${project.id}" type="button">
        <span class="project-name">${escapeHtml(project.name)}</span>
        <span class="project-description">${escapeHtml(project.description || 'No description')}</span>
        <span class="project-path">${escapeHtml(project.workspacePath || 'No workspace')}</span>
        <span class="project-stats">
          <span>${tasks.length} tasks</span>
          <span>${running} running</span>
          <span>${done} done</span>
        </span>
      </button>
    `;
  }).join('');

  refs.projectList.querySelectorAll('[data-project-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedProjectId = button.dataset.projectId;
      const tasks = selectedProjectTasks();
      state.selectedTaskId = tasks[0]?.id ?? null;
      loadSubagents(state.selectedProjectId).then(render);
    });
  });
}

function renderProjectOverview() {
  const project = selectedProject();
  const tasks = selectedProjectTasks();

  if (!project) {
    refs.activeProjectName.textContent = 'No project selected';
    refs.activeProjectMeta.textContent = '';
    refs.projectOverview.innerHTML = '<p class="empty compact">Create a project to start managing agent work.</p>';
    return;
  }

  refs.activeProjectName.textContent = project.name;
  refs.activeProjectMeta.textContent = project.workspacePath || 'No workspace path';

  const lastUpdated = tasks[0]?.updatedAt ? formatDate(tasks[0].updatedAt) : 'No activity';
  refs.projectOverview.innerHTML = `
    <article>
      <span>Total tasks</span>
      <strong>${tasks.length}</strong>
    </article>
    <article>
      <span>Queue</span>
      <strong>${tasks.filter((task) => task.status === 'Assigned').length}</strong>
    </article>
    <article>
      <span>In progress</span>
      <strong>${tasks.filter((task) => task.status === 'Running').length}</strong>
    </article>
    <article>
      <span>Last activity</span>
      <strong class="date-value">${escapeHtml(lastUpdated)}</strong>
    </article>
  `;
}

function renderTaskBoard() {
  const tasks = selectedProjectTasks();
  const tasksByStatus = Object.fromEntries(BOARD_STATUSES.map((status) => [status, []]));

  for (const task of tasks) {
    const status = BOARD_STATUSES.includes(task.status) ? task.status : 'Assigned';
    tasksByStatus[status].push(task);
  }

  for (const status of BOARD_STATUSES) {
    document.querySelector(`#count${status}`).textContent = tasksByStatus[status].length;
    document.querySelector(`#tasks${status}`).innerHTML = tasksByStatus[status].length
      ? tasksByStatus[status].map(renderTaskCard).join('')
      : '<p class="empty compact">No tasks</p>';
  }

  document.querySelectorAll('[data-task-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTaskId = button.dataset.taskId;
      renderTaskBoard();
      renderAgents();
      renderChat();
    });
  });
}

function renderTaskCard(task) {
  return `
    <button class="task-card ${task.id === state.selectedTaskId ? 'active' : ''}" data-task-id="${task.id}" type="button">
      <span class="task-card-top">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="status ${task.status}">${escapeHtml(task.status)}</span>
      </span>
      <span class="task-description">${escapeHtml(task.description)}</span>
      <span class="task-meta-row">
        <span>${escapeHtml(agentLabel(task.subagent))}</span>
        <span>${escapeHtml(formatDate(task.updatedAt))}</span>
      </span>
    </button>
  `;
}

function renderAgents() {
  const projectTasks = selectedProjectTasks();

  refs.agentList.innerHTML = state.subagents.map((agent) => {
    const assigned = projectTasks.filter((task) => task.subagent === agent.id && task.status === 'Assigned').length;
    const running = projectTasks.filter((task) => task.subagent === agent.id && task.status === 'Running').length;
    const done = projectTasks.filter((task) => task.subagent === agent.id && task.status === 'Done').length;
    const isSelected = selectedTask()?.subagent === agent.id;
    return `
      <article class="agent-item ${isSelected ? 'active' : ''}">
        <div>
          <strong>${escapeHtml(agent.label)}</strong>
          <span>${escapeHtml(agent.role || 'general codex mode')}</span>
        </div>
        <dl>
          <div><dt>Queue</dt><dd>${assigned}</dd></div>
          <div><dt>Run</dt><dd>${running}</dd></div>
          <div><dt>Done</dt><dd>${done}</dd></div>
        </dl>
      </article>
    `;
  }).join('');
}

function renderChat() {
  const task = selectedTask();

  if (!task) {
    refs.detailTitle.textContent = 'Task Chat';
    refs.chatArea.classList.add('empty');
    refs.chatArea.innerHTML = 'Select a task to start chatting.';
    refs.chatInputArea.hidden = true;
    return;
  }

  refs.detailTitle.textContent = task.title;
  refs.chatArea.classList.remove('empty');
  refs.chatInputArea.hidden = false;

  const isRunning = task.status === 'Running';
  refs.chatInput.disabled = isRunning;
  refs.sendChatBtn.disabled = isRunning;
  refs.chatInput.placeholder = isRunning
    ? 'Agent is running...'
    : 'Type a follow-up prompt, or leave empty to run the task.';
  refs.sendChatBtn.textContent = isRunning ? 'Running' : 'Send';

  const messages = task.messages || [];
  if (!messages.length) {
    refs.chatArea.innerHTML = `
      <section class="task-brief">
        <div class="brief-line"><span>Status</span><strong class="status ${task.status}">${escapeHtml(task.status)}</strong></div>
        <div class="brief-line"><span>Agent</span><strong>${escapeHtml(agentLabel(task.subagent))}</strong></div>
        <div class="brief-line"><span>Workspace</span><code>${escapeHtml(workspaceForTask(task))}</code></div>
        <p>${escapeHtml(task.description)}</p>
        ${task.notes ? `<p class="notes">${escapeHtml(task.notes)}</p>` : ''}
      </section>
    `;
    return;
  }

  refs.chatArea.innerHTML = messages.map((message) => `
    <div class="chat-message ${message.sender}">
      <span class="sender-label">${message.sender === 'user' ? 'User' : 'Agent'}</span>
      ${message.sender === 'user'
        ? `<p>${escapeHtml(message.content)}</p>`
        : `<pre><code>${escapeHtml(message.content)}</code></pre>`}
      <span class="msg-time">${formatDate(message.createdAt)}</span>
    </div>
  `).join('');
  refs.chatArea.scrollTop = refs.chatArea.scrollHeight;
}

async function sendChatMessage() {
  const task = selectedTask();
  if (!task || task.status === 'Running') return;

  const promptText = refs.chatInput.value.trim();
  refs.chatInput.disabled = true;
  refs.sendChatBtn.disabled = true;
  refs.sendChatBtn.textContent = 'Running';

  try {
    await api(`/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify(promptText ? { prompt: promptText } : {})
    });
    refs.chatInput.value = '';
    await loadData();
  } catch (error) {
    alert(`Failed to run task: ${error.message}`);
    await loadData();
  }
}

function selectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) ?? null;
}

function selectedTask() {
  return state.tasks.find((task) => task.id === state.selectedTaskId) ?? null;
}

function selectedProjectTasks() {
  return tasksForProject(state.selectedProjectId);
}

function tasksForProject(projectId) {
  return state.tasks.filter((task) => task.projectId === projectId);
}

function openModal(modal, message) {
  message.textContent = '';
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function toggleTheme() {
  const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  syncThemeToggle();
}

function syncThemeToggle() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  refs.themeText.textContent = theme === 'dark' ? 'Dark' : 'Light';
  refs.metaThemeColor?.setAttribute('content', theme === 'dark' ? '#101317' : '#f5f7fa');
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

function workspaceForTask(task) {
  return selectedProject()?.workspacePath
    ?? state.projects.find((project) => project.id === task.projectId)?.workspacePath
    ?? task.workspacePath
    ?? '';
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
