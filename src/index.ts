import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

// Define the environment bindings
export type Env = {
  dev_pmo: D1Database;
};

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['PENDING', 'PLANNING', 'EXECUTING', 'COMPLETED']),
  config: z.record(z.string(), z.unknown()),
});

const taskSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  phase: z.string(),
  instructions: z.string(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE']),
  agent: z.string().optional(),
  logs: z.string().optional(),
});

const knowledgeBaseSchema = z.object({
  id: z.string(),
  technology: z.string(),
  pattern: z.string(),
  content: z.string(),
});

// Initialize Hono
const app = new Hono<{ Bindings: Env }>();

// Simple "hello" route
app.get('/', (c) => {
  return c.text('Hello from Hono!');
});

// CRUD for Projects
app.get('/api/projects', async (c) => {
  const { results } = await c.env.dev_pmo.prepare('SELECT * FROM Projects').all();
  return c.json(results);
});

app.get('/api/projects/:id', async (c) => {
  const id = c.req.param('id');
  const project = await c.env.dev_pmo.prepare('SELECT * FROM Projects WHERE id = ?').bind(id).first();
  if (project) {
    return c.json(project);
  }
  return c.json({ error: 'Project not found' }, 404);
});

app.post('/api/projects', zValidator('json', projectSchema), async (c) => {
  const project = c.req.valid('json');
  await c.env.dev_pmo
    .prepare('INSERT INTO Projects (id, name, status, config) VALUES (?, ?, ?, ?)')
    .bind(project.id, project.name, project.status, JSON.stringify(project.config))
    .run();
  return c.json(project, 201);
});

app.put('/api/projects/:id', zValidator('json', projectSchema), async (c) => {
  const id = c.req.param('id');
  const project = c.req.valid('json');
  await c.env.dev_pmo
    .prepare('UPDATE Projects SET name = ?, status = ?, config = ? WHERE id = ?')
    .bind(project.name, project.status, JSON.stringify(project.config), id)
    .run();
  return c.json(project);
});

app.delete('/api/projects/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.dev_pmo.prepare('DELETE FROM Projects WHERE id = ?').bind(id).run();
  return c.json({ message: 'Project deleted' });
});

// CRUD for Tasks
app.get('/api/projects/:projectId/tasks', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.dev_pmo
    .prepare('SELECT * FROM Tasks WHERE project_id = ?')
    .bind(projectId)
    .all();
  return c.json(results);
});

app.get('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const task = await c.env.dev_pmo.prepare('SELECT * FROM Tasks WHERE id = ?').bind(id).first();
  if (task) {
    return c.json(task);
  }
  return c.json({ error: 'Task not found' }, 404);
});

app.post('/api/tasks', zValidator('json', taskSchema), async (c) => {
  const task = c.req.valid('json');
  await c.env.dev_pmo
    .prepare(
      'INSERT INTO Tasks (id, project_id, phase, instructions, status, agent, logs) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      task.id,
      task.project_id,
      task.phase,
      task.instructions,
      task.status,
      task.agent,
      task.logs
    )
    .run();
  return c.json(task, 201);
});

app.put('/api/tasks/:id', zValidator('json', taskSchema), async (c) => {
  const id = c.req.param('id');
  const task = c.req.valid('json');
  await c.env.dev_pmo
    .prepare(
      'UPDATE Tasks SET project_id = ?, phase = ?, instructions = ?, status = ?, agent = ?, logs = ? WHERE id = ?'
    )
    .bind(
      task.project_id,
      task.phase,
      task.instructions,
      task.status,
      task.agent,
      task.logs,
      id
    )
    .run();
  return c.json(task);
});

app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.dev_pmo.prepare('DELETE FROM Tasks WHERE id = ?').bind(id).run();
  return c.json({ message: 'Task deleted' });
});

// CRUD for KnowledgeBase
app.get('/api/knowledge', async (c) => {
  const { results } = await c.env.dev_pmo.prepare('SELECT * FROM KnowledgeBase').all();
  return c.json(results);
});

app.get('/api/knowledge/:id', async (c) => {
  const id = c.req.param('id');
  const entry = await c.env.dev_pmo
    .prepare('SELECT * FROM KnowledgeBase WHERE id = ?')
    .bind(id)
    .first();
  if (entry) {
    return c.json(entry);
  }
  return c.json({ error: 'Knowledge base entry not found' }, 404);
});

app.post('/api/knowledge', zValidator('json', knowledgeBaseSchema), async (c) => {
  const entry = c.req.valid('json');
  await c.env.dev_pmo
    .prepare('INSERT INTO KnowledgeBase (id, technology, pattern, content) VALUES (?, ?, ?, ?)')
    .bind(entry.id, entry.technology, entry.pattern, entry.content)
    .run();
  return c.json(entry, 201);
});

app.put('/api/knowledge/:id', zValidator('json', knowledgeBaseSchema), async (c) => {
  const id = c.req.param('id');
  const entry = c.req.valid('json');
  await c.env.dev_pmo
    .prepare('UPDATE KnowledgeBase SET technology = ?, pattern = ?, content = ? WHERE id = ?')
    .bind(entry.technology, entry.pattern, entry.content, id)
    .run();
  return c.json(entry);
});

app.delete('/api/knowledge/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.dev_pmo.prepare('DELETE FROM KnowledgeBase WHERE id = ?').bind(id).run();
  return c.json({ message: 'Knowledge base entry deleted' });
});

export default app;
