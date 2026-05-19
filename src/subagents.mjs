export const SUBAGENTS = [
  { id: 'planner', label: 'Planner', role: 'harness_planner' },
  { id: 'generator', label: 'Generator', role: 'harness_generator' },
  { id: 'reviewer', label: 'Reviewer', role: 'harness_plan_reviewer' },
  { id: 'evaluator', label: 'Evaluator', role: 'harness_evaluator' }
];

export function findSubagent(id) {
  return SUBAGENTS.find((subagent) => subagent.id === id) ?? null;
}
