const BOARD_STATUSES = ['Assigned', 'Running', 'Done', 'Failed'];

const state = {
  projects: [],
  tasks: [],
  subagents: [],
  selectedProjectId: null,
  selectedTaskId: null,
  activeDetailTab: 'chat',
  terminalViewMode: 'pretty',
  taskEventSource: null,
  terminalEventSource: null,
  terminalStreamTaskId: null
};

let isLoadingData = false;

const refs = {
  mainView: document.querySelector('#mainView'),
  taskDetailView: document.querySelector('#taskDetailView'),
  metricProjects: document.querySelector('#metricProjects'),
  metricActiveTasks: document.querySelector('#metricActiveTasks'),
  metricRunningAgents: document.querySelector('#metricRunningAgents'),
  metricDoneTasks: document.querySelector('#metricDoneTasks'),
  projectList: document.querySelector('#projectList'),
  activeProjectName: document.querySelector('#activeProjectName'),
  activeProjectMeta: document.querySelector('#activeProjectMeta'),
  projectOverview: document.querySelector('#projectOverview'),
  taskPreview: document.querySelector('#taskPreview'),
  previewTitle: document.querySelector('#previewTitle'),
  taskOverview: document.querySelector('#taskOverview'),
  agentList: document.querySelector('#agentList'),
  chatArea: document.querySelector('#chatArea'),
  chatInputArea: document.querySelector('#chatInputArea'),
  chatInput: document.querySelector('#chatInput'),
  sendChatBtn: document.querySelector('#sendChatBtn'),
  backToBoardBtn: document.querySelector('#backToBoardBtn'),
  refreshButton: document.querySelector('#refreshButton'),
  detailTitle: document.querySelector('#detailTitle'),
  themeToggle: document.querySelector('#themeToggle'),
  themeText: document.querySelector('.theme-text'),
  metaThemeColor: document.querySelector('#meta-theme-color'),
  projectModal: document.querySelector('#projectModal'),
  newProjectBtn: document.querySelector('#newProjectBtn'),
  deleteProjectBtn: document.querySelector('#deleteProjectBtn'),
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
  syncTaskStream();
}

function bindEvents() {
  refs.refreshButton.addEventListener('click', loadData);
  refs.themeToggle.addEventListener('click', toggleTheme);
  refs.backToBoardBtn.addEventListener('click', () => {
    window.location.hash = '';
  });
  window.addEventListener('hashchange', () => {
    syncRouteSelection();
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      closeTaskStream();
      return;
    }
    syncTaskStream();
    loadData().catch((error) => console.error(error));
  });

  document.querySelectorAll('[data-detail-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeDetailTab = button.dataset.detailTab;
      renderChat();
    });
  });

  refs.newProjectBtn.addEventListener('click', () => openModal(refs.projectModal, refs.projectFormMessage));
  refs.deleteProjectBtn.addEventListener('click', deleteSelectedProject);
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
  refs.chatArea.addEventListener('click', (event) => {
    const button = event.target.closest('[data-terminal-view-mode]');
    if (!button) return;
    state.terminalViewMode = button.dataset.terminalViewMode;
    renderChat();
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
    window.location.hash = `#/tasks/${task.id}`;
    await loadData();
  } catch (error) {
    refs.formMessage.textContent = error.message;
  }
}

async function loadData() {
  if (isLoadingData) return;
  isLoadingData = true;

  try {
    state.projects = await api('/api/projects');
    state.tasks = await api('/api/tasks');
    syncRouteSelection();

    if (state.projects.length && !state.projects.some((project) => project.id === state.selectedProjectId)) {
      state.selectedProjectId = state.projects[0].id;
    }
    if (!state.projects.length) {
      state.selectedProjectId = null;
    }

    ensureSelectedTask();

    await loadSubagents(state.selectedProjectId);
    render();
  } finally {
    isLoadingData = false;
  }
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
  refs.deleteProjectBtn.disabled = !selectedProject();
  renderRoute();
  renderTaskData();
  syncTerminalStream();
}

function renderTaskData() {
  renderMetrics();
  renderProjects();
  renderProjectOverview();
  renderTaskBoard();
  renderTaskPreview();
  renderAgents();
  renderChat();
}

function syncTaskStream() {
  if (document.hidden || state.taskEventSource) return;

  state.taskEventSource = new EventSource('/api/tasks/events');
  state.taskEventSource.addEventListener('task-snapshot', (event) => {
    state.tasks = JSON.parse(event.data);
    syncRouteSelection();
    ensureSelectedTask();
    renderTaskData();
    syncTerminalStream();
  });
  state.taskEventSource.addEventListener('task-created', (event) => {
    mergeTask(JSON.parse(event.data));
  });
  state.taskEventSource.addEventListener('task-updated', (event) => {
    mergeTask(JSON.parse(event.data));
  });
  state.taskEventSource.addEventListener('task-deleted', (event) => {
    removeTask(JSON.parse(event.data).id);
  });
  state.taskEventSource.addEventListener('error', () => {
    if (state.taskEventSource?.readyState === EventSource.CLOSED) {
      closeTaskStream();
    }
  });
}

function closeTaskStream() {
  state.taskEventSource?.close();
  state.taskEventSource = null;
}

function mergeTask(task) {
  const index = state.tasks.findIndex((candidate) => candidate.id === task.id);
  if (index === -1) {
    state.tasks = [task, ...state.tasks];
  } else {
    state.tasks = [
      ...state.tasks.slice(0, index),
      task,
      ...state.tasks.slice(index + 1)
    ];
  }
  state.tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  syncRouteSelection();
  ensureSelectedTask();
  renderTaskData();
  syncTerminalStream();
}

function removeTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  if (state.selectedTaskId === taskId) {
    state.selectedTaskId = null;
    if (isTaskDetailRoute()) window.location.hash = '';
  }
  ensureSelectedTask();
  renderTaskData();
  syncTerminalStream();
}

function renderRoute() {
  const isDetail = isTaskDetailRoute() && selectedTask();
  refs.mainView.hidden = isDetail;
  refs.taskDetailView.hidden = !isDetail;
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
      window.location.hash = '';
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
      renderTaskPreview();
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

function renderTaskPreview() {
  const task = selectedTask();

  if (!task) {
    refs.previewTitle.textContent = 'No task selected';
    refs.taskPreview.classList.add('empty');
    refs.taskPreview.innerHTML = 'Select a task to view details.';
    return;
  }

  refs.previewTitle.textContent = task.title;
  refs.taskPreview.classList.remove('empty');
  refs.taskPreview.innerHTML = `
    <section class="task-brief">
      <div class="brief-line"><span>Status</span><strong class="status ${task.status}">${escapeHtml(task.status)}</strong></div>
      <div class="brief-line"><span>Agent</span><strong>${escapeHtml(agentLabel(task.subagent))}</strong></div>
      <div class="brief-line"><span>Updated</span><strong>${escapeHtml(formatDate(task.updatedAt))}</strong></div>
      <p>${escapeHtml(task.description)}</p>
      ${task.notes ? `<p class="notes">${escapeHtml(task.notes)}</p>` : ''}
      <div class="task-actions">
        <button id="deleteTaskBtn" class="danger-button" type="button">Delete</button>
        <button id="openTaskDetailBtn" class="primary-button" type="button">Open Detail</button>
      </div>
    </section>
  `;
  document.querySelector('#deleteTaskBtn').addEventListener('click', deleteSelectedTask);
  document.querySelector('#openTaskDetailBtn').addEventListener('click', () => {
    state.activeDetailTab = 'chat';
    window.location.hash = `#/tasks/${task.id}`;
  });
}

async function deleteSelectedProject() {
  const project = selectedProject();
  if (!project) return;
  if (!confirm(`Delete project "${project.name}" and all of its tasks?`)) return;

  try {
    await api(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' });
    state.selectedProjectId = null;
    state.selectedTaskId = null;
    window.location.hash = '';
    await loadData();
  } catch (error) {
    alert(`Failed to delete project: ${error.message}`);
    await loadData();
  }
}

async function deleteSelectedTask() {
  const task = selectedTask();
  if (!task) return;
  if (!confirm(`Delete task "${task.title}"?`)) return;

  try {
    await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
    removeTask(task.id);
  } catch (error) {
    alert(`Failed to delete task: ${error.message}`);
    await loadData();
  }
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
    refs.taskOverview.innerHTML = '';
    refs.chatArea.classList.add('empty');
    refs.chatArea.innerHTML = 'Select a task to start chatting.';
    refs.chatInputArea.hidden = true;
    return;
  }

  refs.detailTitle.textContent = task.title;
  renderTaskOverview(task);
  renderDetailTabs();
  refs.chatArea.classList.remove('empty');
  refs.chatInputArea.hidden = state.activeDetailTab !== 'chat';

  if (state.activeDetailTab === 'overview') {
    refs.chatArea.innerHTML = renderOverviewDetail(task);
    return;
  }

  if (state.activeDetailTab === 'terminal') {
    refs.chatArea.innerHTML = renderTerminalDetail(task);
    refs.chatArea.scrollTop = refs.chatArea.scrollHeight;
    return;
  }

  if (state.activeDetailTab === 'activity') {
    refs.chatArea.innerHTML = renderActivityDetail(task);
    return;
  }

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

function renderTaskOverview(task) {
  const usage = tokenUsageForTask(task);

  refs.taskOverview.innerHTML = `
    <article>
      <span>Status</span>
      <strong class="status ${task.status}">${escapeHtml(task.status)}</strong>
    </article>
    <article>
      <span>Agent</span>
      <strong>${escapeHtml(agentLabel(task.subagent))}</strong>
    </article>
    <article>
      <span>Session</span>
      <strong>${escapeHtml(task.sessionRef || 'Not started')}</strong>
    </article>
    <article>
      <span>Updated</span>
      <strong>${escapeHtml(formatDate(task.updatedAt))}</strong>
    </article>
    <article>
      <span>Total tokens</span>
      <strong>${escapeHtml(formatTokenCount(usage.totalTokens))}</strong>
    </article>
    <article>
      <span>Input tokens</span>
      <strong>${escapeHtml(formatTokenCount(usage.inputTokens))}</strong>
    </article>
    <article>
      <span>Output tokens</span>
      <strong>${escapeHtml(formatTokenCount(usage.outputTokens))}</strong>
    </article>
  `;
}

function renderDetailTabs() {
  document.querySelectorAll('[data-detail-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.detailTab === state.activeDetailTab);
  });
}

function renderOverviewDetail(task) {
  return `
    <section class="detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(task.description)}</p>
      ${task.notes ? `<h3>Notes</h3><p>${escapeHtml(task.notes)}</p>` : ''}
      <h3>Workspace</h3>
      <code>${escapeHtml(workspaceForTask(task))}</code>
      ${task.runArtifactPath ? `<h3>Run Artifact</h3><code>${escapeHtml(task.runArtifactPath)}</code>` : ''}
    </section>
  `;
}

function renderActivityDetail(task) {
  const events = [
    ['Created', task.createdAt],
    ['Started', task.startedAt],
    ['Finished', task.finishedAt],
    ['Last updated', task.updatedAt]
  ].filter(([, value]) => value);

  return `
    <section class="activity-list">
      ${events.map(([label, value]) => `
        <article>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(formatDate(value))}</span>
        </article>
      `).join('')}
      ${task.error ? `<article><strong>Error</strong><span>${escapeHtml(task.error)}</span></article>` : ''}
      ${task.processRef ? `<article><strong>Process</strong><span>${escapeHtml(task.processRef)}</span></article>` : ''}
    </section>
  `;
}

function renderTerminalDetail(task) {
  const events = task.terminalEvents || [];
  if (!events.length) {
    return '<section class="terminal-panel empty">No terminal events yet.</section>';
  }

  const runs = new Map();
  for (const event of events) {
    const runRef = event.runRef || 'unknown';
    if (!runs.has(runRef)) runs.set(runRef, []);
    runs.get(runRef).push(event);
  }

  return `
    <section class="terminal-panel">
      <div class="terminal-toolbar" role="group" aria-label="Terminal log view">
        <button class="${state.terminalViewMode === 'pretty' ? 'active' : ''}" data-terminal-view-mode="pretty" type="button">Pretty</button>
        <button class="${state.terminalViewMode === 'raw' ? 'active' : ''}" data-terminal-view-mode="raw" type="button">Raw</button>
      </div>
      ${[...runs.entries()].map(([runRef, runEvents]) => `
        <article class="terminal-run">
          <div class="terminal-run-header">
            <strong>Run ${escapeHtml(shortRef(runRef))}</strong>
            <span>${escapeHtml(formatDate(runEvents[0]?.createdAt))}</span>
          </div>
          <div class="terminal-log">
            ${state.terminalViewMode === 'raw'
              ? runEvents.map(renderRawTerminalEvent).join('')
              : renderPrettyTerminalEvents(runEvents)}
          </div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderRawTerminalEvent(event) {
  if (event.type === 'process.started') {
    return terminalLine('cmd', [
      `$ ${[event.command, ...(event.args || [])].filter(Boolean).join(' ')}`,
      `cwd: ${event.cwd || 'N/A'}`,
      `pid: ${event.processRef || 'N/A'}`
    ].join('\n'));
  }

  if (event.type === 'process.exited') {
    return terminalLine('exit', `Process exited with code ${event.exitCode}`);
  }

  if (event.type === 'process.timeout') {
    return terminalLine('error', `Process timed out after ${event.timeoutMs}ms`);
  }

  if (event.type === 'error') {
    return terminalLine('error', event.message || 'Process error');
  }

  if (event.type === 'output') {
    return terminalLine(event.stream === 'stderr' ? 'stderr' : 'stdout', event.data || '');
  }

  return terminalLine('event', JSON.stringify(event));
}

function renderPrettyTerminalEvents(events) {
  return events.flatMap((event) => {
    if (event.type === 'process.started') {
      return terminalLine('cmd', [
        `$ ${[event.command, ...(event.args || [])].filter(Boolean).join(' ')}`,
        `cwd: ${event.cwd || 'N/A'}`,
        `pid: ${event.processRef || 'N/A'}`
      ].join('\n'));
    }

    if (event.type === 'process.exited') {
      return terminalLine(event.exitCode === 0 ? 'exit' : 'error', `Process exited with code ${event.exitCode}`);
    }

    if (event.type === 'process.timeout') {
      return terminalLine('error', `Process timed out after ${formatDuration(event.timeoutMs)}`);
    }

    if (event.type === 'error') {
      return terminalLine('error', event.message || 'Process error');
    }

    if (event.type !== 'output') {
      return terminalLine('event', JSON.stringify(event));
    }

    if (event.stream === 'stderr') {
      return splitTerminalText(event.data).map((line) => terminalLine('stderr', line)).join('');
    }

    return renderPrettyStdout(event.data);
  }).join('');
}

function renderPrettyStdout(text) {
  return splitTerminalText(text).map((line) => {
    const parsed = parseJsonLine(line);
    if (!parsed) return terminalLine('stdout', line);
    return renderCodexJsonEvent(parsed, line);
  }).join('');
}

function renderCodexJsonEvent(event, fallback) {
  if (event.type === 'thread.started') {
    return terminalLine('thread', `Started session ${event.thread_id || 'N/A'}`);
  }

  if (event.type === 'turn.started') {
    return terminalLine('turn', 'Started');
  }

  if (event.type === 'turn.completed') {
    return terminalLine('usage', formatUsage(event.usage));
  }

  if (event.type === 'item.started') {
    return terminalLine('item', formatItem(event.item, 'Started'));
  }

  if (event.type === 'item.completed') {
    return terminalLine(itemKind(event.item), formatItem(event.item, 'Completed'));
  }

  return terminalLine('event', fallback);
}

function formatItem(item, action) {
  if (!item) return action;
  if (item.type === 'agent_message') {
    return [action, item.text].filter(Boolean).join('\n');
  }
  if (item.type === 'tool_call') {
    return [action, item.name, item.arguments].filter(Boolean).join('\n');
  }
  if (item.type === 'tool_call_output') {
    return [action, item.output].filter(Boolean).join('\n');
  }
  return `${action} ${item.type || 'item'}`;
}

function itemKind(item) {
  if (item?.type === 'agent_message') return 'agent';
  if (item?.type === 'tool_call' || item?.type === 'tool_call_output') return 'tool';
  return 'item';
}

function formatUsage(usage) {
  if (!usage) return 'Completed';
  const input = formatTokenCount(usage.input_tokens);
  const output = formatTokenCount(usage.output_tokens);
  const total = formatTokenCount(usage.total_tokens);
  return `${total} tokens · input ${input} · output ${output}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 1000)}s`;
}

function splitTerminalText(text) {
  return String(text || '').split(/\r?\n/).filter((line) => line.length);
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function terminalLine(kind, text) {
  return `
    <div class="terminal-line ${kind}">
      <span>${escapeHtml(kind)}</span>
      <code>${escapeHtml(text)}</code>
    </div>
  `;
}

function syncTerminalStream() {
  const task = selectedTask();
  if (!isTaskDetailRoute() || !task) {
    closeTerminalStream();
    return;
  }
  if (state.terminalStreamTaskId === task.id && state.terminalEventSource) return;

  closeTerminalStream();
  state.terminalStreamTaskId = task.id;
  state.terminalEventSource = new EventSource(`/api/tasks/${encodeURIComponent(task.id)}/terminal-events`);
  state.terminalEventSource.addEventListener('terminal', (event) => {
    mergeTerminalEvent(task.id, JSON.parse(event.data));
  });
}

function closeTerminalStream() {
  state.terminalEventSource?.close();
  state.terminalEventSource = null;
  state.terminalStreamTaskId = null;
}

function mergeTerminalEvent(taskId, event) {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  const events = task.terminalEvents || [];
  if (events.some((candidate) => candidate.id === event.id)) return;
  task.terminalEvents = [...events, event];
  if (state.activeDetailTab === 'terminal' && selectedTask()?.id === taskId) {
    renderChat();
  }
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

function ensureSelectedTask() {
  const projectTasks = selectedProjectTasks();
  if (!isTaskDetailRoute() && projectTasks.length && !projectTasks.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = projectTasks[0].id;
  }
  if (!projectTasks.length) {
    state.selectedTaskId = null;
  }
}

function syncRouteSelection() {
  const taskId = taskIdFromHash();
  if (!taskId) return;

  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;

  state.selectedTaskId = task.id;
  state.selectedProjectId = task.projectId;
}

function taskIdFromHash() {
  const match = window.location.hash.match(/^#\/tasks\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isTaskDetailRoute() {
  return Boolean(taskIdFromHash());
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

function tokenUsageForTask(task) {
  return task.tokenUsage ?? {
    totalTokens: null,
    inputTokens: null,
    outputTokens: null
  };
}

function formatTokenCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : 'N/A';
}

function shortRef(value) {
  return String(value || '').slice(0, 8);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
