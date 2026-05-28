const BOARD_STATUSES = ['Assigned', 'Running', 'Done', 'Failed'];

const state = {
  projects: [],
  tasks: [],
  subagents: [],
  selectedProjectId: null,
  selectedTaskId: null,
  activeTab: 'dashboard',
  activeNavItem: 'dashboard',
  sidebarCollapsed: false,
  searchQuery: '',
  activeDetailTab: 'chat',
  terminalViewMode: 'pretty',
  showNeedsInputOnly: false,
  taskEventSource: null,
  terminalEventSource: null,
  terminalStreamTaskId: null,
  taskReconnectTimer: null,
  terminalReconnectTimer: null
};

let isLoadingData = false;

const refs = {
  appSidebar: document.querySelector('#appSidebar'),
  sidebarToggle: document.querySelector('#sidebarToggle'),
  pageTitle: document.querySelector('#pageTitle'),
  pageSubtitle: document.querySelector('#pageSubtitle'),
  dashboardView: document.querySelector('#dashboardView'),
  mainView: document.querySelector('#mainView'),
  placeholderView: document.querySelector('#placeholderView'),
  placeholderTitle: document.querySelector('#placeholderTitle'),
  placeholderText: document.querySelector('#placeholderText'),
  taskDetailView: document.querySelector('#taskDetailView'),
  globalSearch: document.querySelector('#globalSearch'),
  metricProjects: document.querySelector('#metricProjects'),
  metricActiveTasks: document.querySelector('#metricActiveTasks'),
  metricRunningAgents: document.querySelector('#metricRunningAgents'),
  metricDoneTasks: document.querySelector('#metricDoneTasks'),
  metricProjectHint: document.querySelector('#metricProjectHint'),
  metricNeedsInputHint: document.querySelector('#metricNeedsInputHint'),
  metricAgentHint: document.querySelector('#metricAgentHint'),
  metricDoneHint: document.querySelector('#metricDoneHint'),
  focusedTasks: document.querySelector('#focusedTasks'),
  activityTimeline: document.querySelector('#activityTimeline'),
  projectHealthCount: document.querySelector('#projectHealthCount'),
  projectHealth: document.querySelector('#projectHealth'),
  recentActivity: document.querySelector('#recentActivity'),
  projectList: document.querySelector('#projectList'),
  activeProjectName: document.querySelector('#activeProjectName'),
  activeProjectMeta: document.querySelector('#activeProjectMeta'),
  projectOverview: document.querySelector('#projectOverview'),
  taskPreview: document.querySelector('#taskPreview'),
  previewTitle: document.querySelector('#previewTitle'),
  previewDeleteTaskBtn: document.querySelector('#previewDeleteTaskBtn'),
  taskOverview: document.querySelector('#taskOverview'),
  agentList: document.querySelector('#agentList'),
  chatArea: document.querySelector('#chatArea'),
  chatInputArea: document.querySelector('#chatInputArea'),
  chatInput: document.querySelector('#chatInput'),
  sendChatBtn: document.querySelector('#sendChatBtn'),
  backToBoardBtn: document.querySelector('#backToBoardBtn'),
  detailDeleteTaskBtn: document.querySelector('#detailDeleteTaskBtn'),
  refreshButton: document.querySelector('#refreshButton'),
  detailTitle: document.querySelector('#detailTitle'),
  themeToggle: document.querySelector('#themeToggle'),
  themeText: document.querySelector('.theme-text'),
  metaThemeColor: document.querySelector('#meta-theme-color'),
  projectModal: document.querySelector('#projectModal'),
  newProjectBtn: document.querySelector('#newProjectBtn'),
  needsInputFilterBtn: document.querySelector('#needsInputFilterBtn'),
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
  refs.sidebarToggle.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    renderShell();
  });
  refs.globalSearch.addEventListener('input', () => {
    state.searchQuery = refs.globalSearch.value.trim().toLowerCase();
    renderTaskBoard();
    renderDashboard();
  });
  document.querySelectorAll('[data-nav-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.navTab;
      state.activeNavItem = navItemForButton(button);
      ensureSelectedTask();
      if (isTaskDetailRoute()) window.location.hash = '';
      render();
    });
  });
  refs.needsInputFilterBtn.addEventListener('click', () => {
    state.showNeedsInputOnly = !state.showNeedsInputOnly;
    renderTaskBoard();
  });
  refs.backToBoardBtn.addEventListener('click', () => {
    state.activeTab = 'kanban';
    ensureKanbanNavItem();
    window.location.hash = '';
  });
  refs.detailDeleteTaskBtn.addEventListener('click', deleteSelectedTask);
  refs.previewDeleteTaskBtn.addEventListener('click', deleteSelectedTask);
  window.addEventListener('hashchange', () => {
    syncRouteSelection();
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      closeTaskStream();
      closeTerminalStream();
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
  refs.taskOverview.addEventListener('click', handleTaskActionClick);
  refs.focusedTasks.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dashboard-task-id]');
    if (!button) return;
    state.selectedTaskId = button.dataset.dashboardTaskId;
    window.location.hash = `#/tasks/${button.dataset.dashboardTaskId}`;
  });
  refs.projectHealth.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dashboard-project-id]');
    if (!button) return;
    state.selectedProjectId = button.dataset.dashboardProjectId;
    state.activeTab = 'kanban';
    state.activeNavItem = 'projects';
    const tasks = selectedProjectTasks();
    state.selectedTaskId = tasks[0]?.id ?? null;
    loadSubagents(state.selectedProjectId).then(render);
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
  renderShell();
  renderRoute();
  renderTaskData();
  syncTerminalStream();
}

function renderTaskData() {
  renderMetrics();
  renderDashboard();
  renderProjects();
  renderProjectOverview();
  renderTaskBoard();
  renderTaskPreview();
  renderAgents();
  renderChat();
}

function navItemForButton(button) {
  return button.dataset.navItem ?? (button.dataset.navTab === 'kanban' ? 'projects' : button.dataset.navTab);
}

function ensureKanbanNavItem() {
  if (!['projects', 'tasks'].includes(state.activeNavItem)) {
    state.activeNavItem = 'projects';
  }
}

function renderShell() {
  refs.appSidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  refs.sidebarToggle.querySelector('.collapse-icon').textContent = state.sidebarCollapsed ? '›' : '‹';
  refs.sidebarToggle.title = state.sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar';
  refs.sidebarToggle.setAttribute('aria-label', refs.sidebarToggle.title);

  document.querySelectorAll('.nav-item[data-nav-tab]').forEach((button) => {
    button.classList.toggle('active', navItemForButton(button) === state.activeNavItem);
  });

  const titles = {
    dashboard: ['Dashboard Quản Lý', 'Theo dõi dự án, công việc và agent từ dữ liệu thật của workspace.'],
    projects: ['Dự án', 'Quản lý danh sách dự án, sức khỏe project và board công việc liên quan.'],
    tasks: ['Công việc', 'Quản lý lifecycle hiện tại: Assigned, Running, Done, Failed.'],
    agents: ['Agents AI', 'Placeholder cho quản trị agent và năng lực AI.'],
    settings: ['Cài đặt', 'Placeholder cho cấu hình workspace.']
  };
  const titleKey = state.activeTab === 'kanban' ? state.activeNavItem : state.activeTab;
  const [title, subtitle] = titles[titleKey] ?? titles.dashboard;
  refs.pageTitle.textContent = title;
  refs.pageSubtitle.textContent = subtitle;
}

function syncTaskStream() {
  if (document.hidden || state.taskEventSource) return;

  clearTaskReconnect();
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
      scheduleTaskReconnect();
    }
  });
}

function closeTaskStream() {
  clearTaskReconnect();
  state.taskEventSource?.close();
  state.taskEventSource = null;
}

function scheduleTaskReconnect() {
  if (document.hidden || state.taskReconnectTimer || state.taskEventSource) return;
  state.taskReconnectTimer = setTimeout(() => {
    state.taskReconnectTimer = null;
    syncTaskStream();
    loadData().catch((error) => console.error(error));
  }, 1000);
}

function clearTaskReconnect() {
  if (!state.taskReconnectTimer) return;
  clearTimeout(state.taskReconnectTimer);
  state.taskReconnectTimer = null;
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
  refs.mainView.classList.toggle('projects-mode', state.activeTab === 'kanban' && state.activeNavItem === 'projects');
  refs.mainView.classList.toggle('tasks-mode', state.activeTab === 'kanban' && state.activeNavItem === 'tasks');
  refs.dashboardView.hidden = isDetail || state.activeTab !== 'dashboard';
  refs.mainView.hidden = isDetail || state.activeTab !== 'kanban';
  refs.placeholderView.hidden = isDetail || !['agents', 'settings'].includes(state.activeTab);
  refs.taskDetailView.hidden = !isDetail;
  if (isDetail) {
    refs.pageTitle.textContent = 'Task Detail';
    refs.pageSubtitle.textContent = selectedTask()?.title ?? 'Task Detail';
    return;
  }
  if (!refs.placeholderView.hidden) {
    const copy = {
      projects: ['Dự án', 'Quản trị dự án nâng cao sẽ dùng API riêng khi có backend tương ứng.'],
      agents: ['Agents AI', 'Quản trị agent và năng lực AI sẽ được nối với API thật ở bước sau.'],
      settings: ['Cài đặt', 'Cấu hình workspace chưa có backend, nên section này chỉ giữ vị trí UI.']
    };
    const [title, text] = copy[state.activeTab] ?? copy.projects;
    refs.placeholderTitle.textContent = title;
    refs.placeholderText.textContent = text;
  }
}

function renderMetrics() {
  const activeTasks = state.tasks.filter((task) => task.status === 'Assigned' || task.status === 'Running').length;
  const doneTasks = state.tasks.filter((task) => task.status === 'Done').length;
  const progress = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) : 0;
  refs.metricProjects.textContent = state.projects.length;
  refs.metricActiveTasks.textContent = activeTasks;
  refs.metricRunningAgents.textContent = state.subagents.length;
  refs.metricDoneTasks.textContent = `${progress}%`;
  refs.metricProjectHint.textContent = `${state.projects.length} active`;
  refs.metricNeedsInputHint.textContent = `${state.tasks.filter((task) => task.needsInput?.active).length} needs input`;
  refs.metricAgentHint.textContent = `${state.tasks.filter((task) => task.status === 'Running').length} running`;
  refs.metricDoneHint.textContent = `${doneTasks} done`;
}

function renderDashboard() {
  renderFocusedTasks();
  renderActivityTimeline();
  renderProjectHealth();
  renderRecentActivity();
}

function renderFocusedTasks() {
  const tasks = state.tasks
    .filter(matchesSearch)
    .toSorted((a, b) => {
      const inputDelta = Number(Boolean(b.needsInput?.active)) - Number(Boolean(a.needsInput?.active));
      if (inputDelta) return inputDelta;
      const runningDelta = Number(b.status === 'Running') - Number(a.status === 'Running');
      if (runningDelta) return runningDelta;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .slice(0, 5);

  refs.focusedTasks.innerHTML = tasks.length ? tasks.map((task) => `
    <button class="focused-task" data-dashboard-task-id="${task.id}" type="button">
      <span class="status-dot ${task.status}"></span>
      <span>
        <strong>${escapeHtml(task.title)}</strong>
        <small>${escapeHtml(projectName(task.projectId))} · ${escapeHtml(agentLabel(task.subagent))}</small>
      </span>
      <span class="status ${task.status}">${escapeHtml(task.status)}</span>
    </button>
  `).join('') : '<p class="empty compact">No tasks matched.</p>';
}

function renderActivityTimeline() {
  const days = lastSevenDays();
  const maxValue = Math.max(1, ...days.map((day) => day.done + day.added));
  refs.activityTimeline.innerHTML = days.map((day) => {
    const doneHeight = Math.max(8, Math.round((day.done / maxValue) * 130));
    const addedHeight = Math.max(8, Math.round((day.added / maxValue) * 130));
    return `
      <div class="activity-day">
        <div class="bar-stack" title="${day.done} done, ${day.added} new">
          <span class="bar done" style="height:${doneHeight}px"></span>
          <span class="bar added" style="height:${addedHeight}px"></span>
        </div>
        <strong>${escapeHtml(day.label)}</strong>
      </div>
    `;
  }).join('');
}

function renderProjectHealth() {
  refs.projectHealthCount.textContent = `${state.projects.length} active`;
  refs.projectHealth.innerHTML = state.projects.length ? state.projects.map((project) => {
    const tasks = tasksForProject(project.id);
    const done = tasks.filter((task) => task.status === 'Done').length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return `
      <button class="health-item" data-dashboard-project-id="${project.id}" type="button">
        <span><strong>${escapeHtml(project.name)}</strong><small>${tasks.length} tasks</small></span>
        <span class="health-value">${progress}%</span>
        <span class="health-track"><span style="width:${progress}%"></span></span>
      </button>
    `;
  }).join('') : '<p class="empty compact">No projects yet.</p>';
}

function renderRecentActivity() {
  const tasks = state.tasks
    .filter(matchesSearch)
    .toSorted((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);
  refs.recentActivity.innerHTML = tasks.length ? tasks.map((task) => `
    <article class="recent-item">
      <span class="activity-icon ${task.status}">${task.needsInput?.active ? '!' : statusInitial(task.status)}</span>
      <span>
        <strong>${escapeHtml(task.title)}</strong>
        <small>${escapeHtml(task.status)} · ${escapeHtml(formatDate(task.updatedAt))}</small>
      </span>
    </article>
  `).join('') : '<p class="empty compact">No recent activity.</p>';
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
      <article class="project-item ${project.id === state.selectedProjectId ? 'active' : ''}">
        <button class="project-select" data-project-id="${project.id}" type="button">
          <span class="project-name">${escapeHtml(project.name)}</span>
          <span class="project-description">${escapeHtml(project.description || 'No description')}</span>
          <span class="project-path">${escapeHtml(project.workspacePath || 'No workspace')}</span>
          <span class="project-stats">
            <span>${tasks.length} tasks</span>
            <span>${running} running</span>
            <span>${done} done</span>
          </span>
        </button>
        <button class="icon-danger-button project-delete-button" data-delete-project-id="${project.id}" type="button" aria-label="Delete project ${escapeHtml(project.name)}" title="Delete project">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v5"></path>
            <path d="M14 11v5"></path>
          </svg>
        </button>
      </article>
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
  refs.projectList.querySelectorAll('[data-delete-project-id]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteProject(button.dataset.deleteProjectId);
    });
  });
}

function renderProjectOverview() {
  if (state.activeTab === 'kanban' && state.activeNavItem === 'tasks') {
    const activeTasks = state.tasks.filter((task) => task.status === 'Assigned' || task.status === 'Running').length;
    refs.activeProjectName.textContent = 'Tất cả công việc';
    refs.activeProjectMeta.textContent = `${state.tasks.length} tasks · ${activeTasks} active`;
    refs.projectOverview.innerHTML = '';
    return;
  }

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
      <span>Needs input</span>
      <strong>${tasks.filter((task) => task.needsInput?.active).length}</strong>
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
  refs.needsInputFilterBtn.classList.toggle('active', state.showNeedsInputOnly);
  refs.needsInputFilterBtn.setAttribute('aria-pressed', String(state.showNeedsInputOnly));

  const tasks = boardTasks()
    .filter((task) => !state.showNeedsInputOnly || task.needsInput?.active)
    .filter(matchesSearch)
    .toSorted((a, b) => {
      const inputDelta = Number(Boolean(b.needsInput?.active)) - Number(Boolean(a.needsInput?.active));
      if (inputDelta) return inputDelta;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
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
      state.activeTab = 'kanban';
      ensureKanbanNavItem();
      renderTaskBoard();
      renderTaskPreview();
      renderAgents();
      renderChat();
    });
  });
}

function renderTaskCard(task) {
  const badges = taskBadges(task);
  return `
    <button class="task-card ${task.id === state.selectedTaskId ? 'active' : ''}" data-task-id="${task.id}" type="button">
      <span class="task-card-top">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="status ${task.status}">${escapeHtml(task.status)}</span>
      </span>
      ${badges.length ? `<span class="task-badges">${badges.map(renderBadge).join('')}</span>` : ''}
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
    refs.previewDeleteTaskBtn.hidden = true;
    refs.taskPreview.classList.add('empty');
    refs.taskPreview.innerHTML = 'Select a task to view details.';
    return;
  }

  refs.previewTitle.textContent = task.title;
  refs.previewDeleteTaskBtn.hidden = false;
  refs.taskPreview.classList.remove('empty');
  refs.taskPreview.innerHTML = `
    <section class="task-brief">
      <div class="brief-line"><span>Status</span><strong class="status ${task.status}">${escapeHtml(task.status)}</strong></div>
      <div class="brief-line"><span>Workflow</span><strong>${escapeHtml(workflowLabel(task.workflowState))}</strong></div>
      <div class="task-badges">${taskBadges(task).map(renderBadge).join('')}</div>
      <div class="brief-line"><span>Agent</span><strong>${escapeHtml(agentLabel(task.subagent))}</strong></div>
      <div class="brief-line"><span>Updated</span><strong>${escapeHtml(formatDate(task.updatedAt))}</strong></div>
      <p>${escapeHtml(task.description)}</p>
      ${task.notes ? `<p class="notes">${escapeHtml(task.notes)}</p>` : ''}
      <div class="task-actions">
        <button id="openTaskDetailBtn" class="primary-button" type="button">Open Detail</button>
      </div>
    </section>
  `;
  document.querySelector('#openTaskDetailBtn').addEventListener('click', () => {
    state.activeDetailTab = 'chat';
    window.location.hash = `#/tasks/${task.id}`;
  });
}

async function deleteProject(projectId) {
  const project = state.projects.find((candidate) => candidate.id === projectId);
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
    refs.detailDeleteTaskBtn.hidden = true;
    return;
  }

  refs.detailTitle.textContent = task.title;
  refs.detailDeleteTaskBtn.hidden = false;
  renderTaskOverview(task);
  renderDetailTabs();
  refs.chatArea.classList.remove('empty');
  refs.chatInputArea.hidden = state.activeDetailTab !== 'chat';

  if (state.activeDetailTab === 'overview') {
    refs.chatArea.innerHTML = renderOverviewDetail(task);
    return;
  }

  if (state.activeDetailTab === 'terminal') {
    const shouldStick = shouldStickToBottom(refs.chatArea);
    const previousScrollTop = refs.chatArea.scrollTop;
    refs.chatArea.innerHTML = renderTerminalDetail(task);
    restoreScrollPosition(refs.chatArea, shouldStick, previousScrollTop);
    return;
  }

  if (state.activeDetailTab === 'activity') {
    refs.chatArea.innerHTML = renderActivityDetail(task);
    return;
  }

  const isRunning = task.status === 'Running';
  const hasRunnableAction = Boolean(primaryRunMode(task) || task.actions?.canFollowUp);
  refs.chatInput.disabled = isRunning;
  refs.sendChatBtn.disabled = isRunning || !hasRunnableAction;
  refs.chatInput.placeholder = isRunning
    ? 'Agent is running...'
    : chatPlaceholder(task);
  refs.sendChatBtn.textContent = isRunning ? 'Running' : primaryRunLabel(task);

  const messages = task.messages || [];
  if (!messages.length) {
    refs.chatArea.innerHTML = `
      <section class="task-brief">
        <div class="brief-line"><span>Status</span><strong class="status ${task.status}">${escapeHtml(task.status)}</strong></div>
        <div class="brief-line"><span>Workflow</span><strong>${escapeHtml(workflowLabel(task.workflowState))}</strong></div>
        <div class="brief-line"><span>Agent</span><strong>${escapeHtml(agentLabel(task.subagent))}</strong></div>
        <div class="brief-line"><span>Workspace</span><code>${escapeHtml(workspaceForTask(task))}</code></div>
        <p>${escapeHtml(task.description)}</p>
        ${task.notes ? `<p class="notes">${escapeHtml(task.notes)}</p>` : ''}
        <p class="empty compact">No chat messages yet.</p>
      </section>
    `;
    return;
  }

  const shouldStick = shouldStickToBottom(refs.chatArea);
  const previousScrollTop = refs.chatArea.scrollTop;
  refs.chatArea.innerHTML = messages.map((message) => `
    <div class="chat-message ${message.sender}">
      <span class="sender-label">${message.sender === 'user' ? 'User' : 'Agent'}</span>
      ${message.sender === 'user'
        ? `<p>${escapeHtml(message.content)}</p>`
        : `<pre><code>${escapeHtml(message.content)}</code></pre>`}
      <span class="msg-time">${formatDate(message.createdAt)}</span>
    </div>
  `).join('');
  restoreScrollPosition(refs.chatArea, shouldStick, previousScrollTop);
}

function renderTaskOverview(task) {
  const usage = tokenUsageForTask(task);
  const evidence = task.evidenceSummary ?? {};

  refs.taskOverview.innerHTML = `
    ${task.needsInput?.active ? `
      <article class="cockpit-banner">
        <span>Needs Input</span>
        <strong>${escapeHtml(task.needsInput.message || 'Waiting for user input')}</strong>
      </article>
    ` : ''}
    <article>
      <span>Workflow</span>
      <strong>${escapeHtml(workflowLabel(task.workflowState))}</strong>
    </article>
    <article>
      <span>Runner</span>
      <strong>${escapeHtml(runnerLabel(task.runnerState))}</strong>
    </article>
    <article>
      <span>Evidence</span>
      <strong>${escapeHtml(evidenceLabel(evidence.state))}</strong>
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
    <article class="cockpit-actions">
      <span>Next Action</span>
      <div>${renderTaskActions(task)}</div>
    </article>
  `;
}

function renderDetailTabs() {
  document.querySelectorAll('[data-detail-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.detailTab === state.activeDetailTab);
  });
}

function renderOverviewDetail(task) {
  const evidence = task.evidenceSummary ?? {};
  return `
    <section class="detail-section">
      <h3>Cockpit</h3>
      <div class="evidence-grid">
        <div><span>Workflow</span><strong>${escapeHtml(workflowLabel(task.workflowState))}</strong></div>
        <div><span>Runner</span><strong>${escapeHtml(runnerLabel(task.runnerState))}</strong></div>
        <div><span>Evidence</span><strong>${escapeHtml(evidenceLabel(evidence.state))}</strong></div>
        <div><span>Artifact</span><strong>${escapeHtml(evidence.artifactPath || 'No evidence artifact recorded.')}</strong></div>
      </div>
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
    return '<section class="terminal-panel empty">No terminal output for this run.</section>';
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
  if (item.type === 'mcp_tool_call') {
    return [action, formatMcpToolCall(item), formatRanCommand(item) || formatToolArguments(item)].filter(Boolean).join('\n');
  }
  if (item.type === 'tool_call') {
    return [action, formatToolCall(item), formatRanCommand(item) || formatToolArguments(item)].filter(Boolean).join('\n');
  }
  if (item.type === 'tool_call_output') {
    return [action, item.output].filter(Boolean).join('\n');
  }
  const command = formatRanCommand(item);
  if (command) return [action, item.type, command].filter(Boolean).join('\n');
  return `${action} ${item.type || 'item'}`;
}

function itemKind(item) {
  if (item?.type === 'agent_message') return 'agent';
  if (item?.type === 'tool_call' || item?.type === 'mcp_tool_call' || item?.type === 'tool_call_output') return 'tool';
  return 'item';
}

function formatMcpToolCall(item) {
  const server = item.server || item.server_name || item.mcp_server;
  const tool = item.tool || item.tool_name || item.name;
  return ['MCP', [server, tool].filter(Boolean).join('.')].filter(Boolean).join(' ');
}

function formatToolCall(item) {
  return item.name || item.tool || item.tool_name || item.function?.name || item.type;
}

function formatRanCommand(item) {
  const args = parseItemArguments(item.arguments ?? item.args ?? item.input ?? item.parameters);
  const command = item.command ?? item.cmd ?? args?.command ?? args?.cmd;
  if (command) return `Ran ${formatCommand(command)}`;
  const argv = item.argv ?? args?.argv ?? args?.args;
  if (Array.isArray(argv) && argv.length) return `Ran ${argv.filter(Boolean).join(' ')}`;
  return '';
}

function formatToolArguments(item) {
  const args = item.arguments ?? item.args ?? item.input ?? item.parameters;
  if (!args) return '';
  return typeof args === 'string' ? args : JSON.stringify(args);
}

function formatCommand(command) {
  if (Array.isArray(command)) return command.filter(Boolean).join(' ');
  return String(command);
}

function parseItemArguments(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
  if (document.hidden || !isTaskDetailRoute() || !task) {
    closeTerminalStream();
    return;
  }
  if (state.terminalStreamTaskId === task.id && state.terminalEventSource) return;

  clearTerminalReconnect();
  closeTerminalStream();
  state.terminalStreamTaskId = task.id;
  state.terminalEventSource = new EventSource(`/api/tasks/${encodeURIComponent(task.id)}/terminal-events`);
  state.terminalEventSource.addEventListener('terminal', (event) => {
    mergeTerminalEvent(task.id, JSON.parse(event.data));
  });
  state.terminalEventSource.addEventListener('error', () => {
    if (state.terminalEventSource?.readyState === EventSource.CLOSED) {
      closeTerminalStream();
      scheduleTerminalReconnect();
    }
  });
}

function closeTerminalStream() {
  clearTerminalReconnect();
  state.terminalEventSource?.close();
  state.terminalEventSource = null;
  state.terminalStreamTaskId = null;
}

function scheduleTerminalReconnect() {
  if (document.hidden || state.terminalReconnectTimer || state.terminalEventSource) return;
  if (!isTaskDetailRoute() || !selectedTask()) return;
  state.terminalReconnectTimer = setTimeout(() => {
    state.terminalReconnectTimer = null;
    syncTerminalStream();
  }, 1000);
}

function clearTerminalReconnect() {
  if (!state.terminalReconnectTimer) return;
  clearTimeout(state.terminalReconnectTimer);
  state.terminalReconnectTimer = null;
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
  const mode = promptText && task.actions?.canFollowUp ? 'followup' : primaryRunMode(task);
  if (!mode) return;
  refs.chatInput.disabled = true;
  refs.sendChatBtn.disabled = true;
  refs.sendChatBtn.textContent = 'Running';

  try {
    await api(`/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify(promptText ? { mode, prompt: promptText } : { mode })
    });
    refs.chatInput.value = '';
    await loadData();
  } catch (error) {
    alert(`Failed to run task: ${error.message}`);
    await loadData();
  }
}

async function handleTaskActionClick(event) {
  const button = event.target.closest('[data-task-action]');
  if (!button) return;
  const task = selectedTask();
  if (!task) return;
  const action = button.dataset.taskAction;
  if (action === 'focus-followup') {
    state.activeDetailTab = 'chat';
    renderChat();
    refs.chatInput.focus();
    return;
  }
  if (action === 'mark-needs-input') {
    await patchNeedsInput(task, true);
    return;
  }
  if (action === 'clear-needs-input') {
    await patchNeedsInput(task, false);
    return;
  }
  await runTaskMode(task, action);
}

async function runTaskMode(task, mode) {
  try {
    await api(`/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
    await loadData();
  } catch (error) {
    alert(`Failed to run task: ${error.message}`);
    await loadData();
  }
}

async function patchNeedsInput(task, active) {
  const message = active ? prompt('Needs input message', task.needsInput?.message || '') : '';
  if (active && message === null) return;
  try {
    await api(`/api/tasks/${task.id}/needs-input`, {
      method: 'PATCH',
      body: JSON.stringify(active
        ? { active: true, reason: 'manual', message }
        : { active: false })
    });
    await loadData();
  } catch (error) {
    alert(`Failed to update Needs Input: ${error.message}`);
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

function boardTasks() {
  return state.activeTab === 'kanban' && state.activeNavItem === 'tasks'
    ? state.tasks
    : selectedProjectTasks();
}

function tasksForProject(projectId) {
  return state.tasks.filter((task) => task.projectId === projectId);
}

function matchesSearch(task) {
  if (!state.searchQuery) return true;
  const haystack = [
    task.title,
    task.description,
    task.notes,
    task.status,
    agentLabel(task.subagent),
    projectName(task.projectId)
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(state.searchQuery);
}

function projectName(projectId) {
  return state.projects.find((project) => project.id === projectId)?.name ?? 'Unknown project';
}

function lastSevenDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const dayTasks = state.tasks.filter((task) => String(task.createdAt || '').slice(0, 10) === key);
    const doneTasks = state.tasks.filter((task) => {
      const finishedKey = String(task.finishedAt || task.updatedAt || '').slice(0, 10);
      return task.status === 'Done' && finishedKey === key;
    });
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      added: dayTasks.length,
      done: doneTasks.length
    };
  });
}

function statusInitial(status) {
  return {
    Assigned: 'A',
    Running: 'R',
    Done: '✓',
    Failed: '!'
  }[status] ?? 'i';
}

function ensureSelectedTask() {
  const tasks = boardTasks();
  if (!isTaskDetailRoute() && tasks.length && !tasks.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = tasks[0].id;
  }
  if (!tasks.length) {
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
  const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  syncThemeToggle();
}

function syncThemeToggle() {
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  refs.themeText.textContent = theme === 'dark' ? 'Dark' : 'Light';
  refs.metaThemeColor?.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
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

function taskBadges(task) {
  const badges = [];
  if (task.needsInput?.active) badges.push({ label: 'Needs input', kind: 'warning' });
  if (task.actions?.canRetry) badges.push({ label: 'Retryable', kind: 'danger' });
  if (task.evidenceSummary?.state === 'evidence_missing') badges.push({ label: 'Missing evidence', kind: 'danger' });
  if (task.evidenceSummary?.state === 'evidence_present' || task.evidenceSummary?.state === 'verified') {
    badges.push({ label: task.evidenceSummary.state === 'verified' ? 'Verified' : 'Evidence present', kind: 'success' });
  }
  return badges;
}

function renderBadge(badge) {
  return `<span class="badge ${badge.kind}">${escapeHtml(badge.label)}</span>`;
}

function renderTaskActions(task) {
  const actions = task.actions || {};
  const buttons = [];
  if (actions.canStart) buttons.push(actionButton('start', 'Start'));
  if (actions.canResume) buttons.push(actionButton('resume', 'Resume session'));
  if (actions.canRetry) buttons.push(actionButton('retry', 'Retry run'));
  if (actions.canFollowUp) buttons.push(actionButton('focus-followup', 'Send follow-up'));
  if (actions.canClearNeedsInput) {
    buttons.push(actionButton('clear-needs-input', 'Clear Needs Input', 'secondary'));
  } else if (actions.canMarkNeedsInput) {
    buttons.push(actionButton('mark-needs-input', 'Mark Needs Input', 'secondary'));
  }
  return buttons.length ? buttons.join('') : '<strong>No action available</strong>';
}

function actionButton(action, label, variant = 'primary') {
  return `<button class="${variant === 'primary' ? 'primary-button' : 'secondary-button'}" data-task-action="${action}" type="button">${escapeHtml(label)}</button>`;
}

function primaryRunMode(task) {
  const actions = task.actions || {};
  if (actions.canStart) return 'start';
  if (actions.canResume) return 'resume';
  if (actions.canRetry) return 'retry';
  return '';
}

function primaryRunLabel(task) {
  const mode = primaryRunMode(task);
  if (mode === 'start') return 'Start';
  if (mode === 'resume') return 'Resume';
  if (mode === 'retry') return 'Retry';
  return 'Send';
}

function chatPlaceholder(task) {
  if (task.actions?.canFollowUp) return 'Type a follow-up prompt.';
  if (task.actions?.canStart) return 'Leave empty to start, or type an initial prompt.';
  if (task.actions?.canRetry) return 'Leave empty to retry, or type a replacement prompt.';
  return 'No run action is available.';
}

function workflowLabel(value) {
  return {
    queued: 'Queued',
    running: 'Running',
    needs_input: 'Needs Input',
    failed: 'Failed',
    done: 'Done'
  }[value] ?? 'Queued';
}

function runnerLabel(value) {
  return {
    idle: 'Idle',
    running: 'Running',
    exited: 'Exited',
    error: 'Error'
  }[value] ?? 'Idle';
}

function evidenceLabel(value) {
  return {
    unknown: 'Unknown',
    evidence_missing: 'Missing evidence',
    evidence_present: 'Evidence present',
    verified: 'Verified'
  }[value] ?? 'Unknown';
}

function formatTokenCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : 'N/A';
}

function shouldStickToBottom(element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 48;
}

function restoreScrollPosition(element, shouldStick, previousScrollTop) {
  element.scrollTop = shouldStick ? element.scrollHeight : previousScrollTop;
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
