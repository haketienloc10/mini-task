import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_SUBAGENT = { id: 'default', label: 'Default', role: null };
const AGENT_FILE_RE = /\.(ya?ml|json)$/i;
const SKIPPED_DIRS = new Set(['.git', '.tmp', 'tmp', 'vendor_imports', 'memories', 'log', 'shell_snapshots']);

export function listSubagents(options = {}) {
  const agents = new Map([[DEFAULT_SUBAGENT.id, DEFAULT_SUBAGENT]]);

  for (const root of agentRoots(options)) {
    for (const filePath of findAgentFiles(root)) {
      const agent = readAgentFile(filePath, root);
      if (!agent || agents.has(agent.id)) continue;
      agents.set(agent.id, agent);
    }
  }

  return [...agents.values()].sort((a, b) => {
    if (a.id === 'default') return -1;
    if (b.id === 'default') return 1;
    return a.label.localeCompare(b.label);
  });
}

export function findSubagent(id, options = {}) {
  if (!id) return null;
  return listSubagents(options).find((subagent) => subagent.id === id) ?? null;
}

function agentRoots(options) {
  const homeCodexDir = options.homeCodexDir ?? path.join(os.homedir(), '.codex');
  const projectCodexDir = options.projectPath ? path.join(options.projectPath, '.codex') : path.resolve('.codex');
  return [homeCodexDir, projectCodexDir]
    .filter(Boolean)
    .map((root) => path.resolve(root));
}

function findAgentFiles(root) {
  if (!existsSync(root)) return [];

  const files = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        pending.push(entryPath);
        continue;
      }
      if (entry.isFile() && AGENT_FILE_RE.test(entry.name) && path.basename(path.dirname(entryPath)) === 'agents') {
        files.push(entryPath);
      }
    }
  }
  return files.sort();
}

function readAgentFile(filePath, root) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const metadata = filePath.endsWith('.json')
    ? parseJsonMetadata(content)
    : parseYamlMetadata(content);
  const displayName = metadata['interface.display_name'] ?? metadata.display_name;
  const shortDescription = metadata['interface.short_description'] ?? metadata.short_description;
  const defaultPrompt = metadata['interface.default_prompt'] ?? metadata.default_prompt;
  const label = displayName || labelFromPath(filePath);
  const id = slugify(agentPathId(root, filePath)) || slugify(label);
  if (!id || id === DEFAULT_SUBAGENT.id) return null;

  return {
    id,
    label,
    role: defaultPrompt || shortDescription || label,
    source: path.relative(root, filePath)
  };
}

function parseJsonMetadata(content) {
  try {
    const data = JSON.parse(content);
    return flattenMetadata(data);
  } catch {
    return {};
  }
}

function flattenMetadata(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      Object.assign(result, flattenMetadata(nestedValue, nextPrefix));
    } else if (typeof nestedValue === 'string') {
      result[nextPrefix] = nestedValue;
    }
  }
  return result;
}

function parseYamlMetadata(content) {
  const result = {};
  const stack = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    if (!withoutComment.trim() || withoutComment.trimStart().startsWith('#')) continue;

    const match = withoutComment.match(/^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2];
    const rawValue = match[3] ?? '';
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();

    const pathKeys = [...stack.map((item) => item.key), key];
    const value = cleanScalar(rawValue);
    if (value) {
      result[pathKeys.join('.')] = value;
    } else {
      stack.push({ indent, key });
    }
  }

  return result;
}

function cleanScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function labelFromPath(filePath) {
  const parent = path.dirname(path.dirname(filePath));
  return titleCase(path.basename(parent));
}

function agentPathId(root, filePath) {
  const parts = path.relative(root, path.dirname(filePath)).split(path.sep).filter(Boolean);
  if (parts[parts.length - 1] === 'agents') parts.pop();
  return parts.join('-');
}

function slugify(value) {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.')
    .join('-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
