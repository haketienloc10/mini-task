import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('sidebar exposes Projects as the primary kanban entry and Tasks as an alias', async () => {
  const html = await readFile('public/index.html', 'utf8');
  const appJs = await readFile('public/app.js', 'utf8');
  const css = await readFile('public/styles.css', 'utf8');
  const navLabels = [...html.matchAll(/<span class="nav-label">([^<]+)<\/span>/g)].map((match) => match[1]);

  assert.deepEqual(navLabels.slice(0, 4), ['Dashboard', 'Dự án', 'Công việc', 'Agents AI']);
  assert.match(html, /data-nav-tab="kanban" data-nav-item="projects"[^>]*title="Dự án"/);
  assert.match(html, /data-nav-tab="kanban" data-nav-item="tasks"[^>]*title="Công việc"/);
  assert.doesNotMatch(html, /data-nav-tab="projects"/);
  assert.match(html, /Xem Kanban/);
  assert.match(html, /data-nav-tab="kanban" data-nav-item="projects"[^>]*>Xem Kanban<\/button>/);

  assert.match(appJs, /activeNavItem: 'dashboard'/);
  assert.match(appJs, /function navItemForButton/);
  assert.match(appJs, /state\.activeTab === 'kanban' \? state\.activeNavItem : state\.activeTab/);
  assert.match(appJs, /!\['agents', 'settings'\]\.includes\(state\.activeTab\)/);
  assert.match(appJs, /function boardTasks/);
  assert.match(appJs, /activeNavItem === 'tasks'\s*\? state\.tasks/s);
  assert.match(css, /\.tasks-mode \.project-panel/);
  assert.match(css, /\.projects-mode \.task-board/);
});
