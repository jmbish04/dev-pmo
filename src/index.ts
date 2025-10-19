import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { handleError } from './utils';
import {
  projectSchema,
  createProjectSchema,
  taskSchema,
  createTaskSchema,
  knowledgeBaseSchema,
  createKnowledgeBaseSchema,
} from './schemas';

// Define the environment bindings
export type Env = {
  dev_pmo: D1Database;
};

// Initialize Hono
const app = new Hono<{ Bindings: Env }>();

// Simple "hello" route
app.get('/', (c) => {
  return c.text('Hello from Hono!');
});

// CRUD for Projects
app.get('/api/projects', async (c) => {
  try {
    console.log('Fetching all projects');
    const { results } = await c.env.dev_pmo.prepare('SELECT * FROM Projects').all();
    console.log(`Found ${results.length} projects`);
    return c.json(results);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch projects', 500);
  }
});

app.get('/api/projects/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Fetching project with id: ${id}`);
    const project = await c.env.dev_pmo.prepare('SELECT * FROM Projects WHERE id = ?').bind(id).first();
    if (project) {
      console.log(`Found project with id: ${id}`);
      return c.json(project);
    }
    return handleError(c, 'Project not found', 404);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch project', 500);
  }
});

app.post('/api/projects', zValidator('json', createProjectSchema), async (c) => {
  try {
    const projectData = c.req.valid('json');
    const project = { ...projectData, id: crypto.randomUUID() };
    console.log(`Creating project with id: ${project.id}`);
    await c.env.dev_pmo
      .prepare('INSERT INTO Projects (id, name, status, config) VALUES (?, ?, ?, ?)')
      .bind(project.id, project.name, project.status, JSON.stringify(project.config))
      .run();
    console.log(`Created project with id: ${project.id}`);
    return c.json(project, 201);
  } catch (e: any) {
    return handleError(c, 'Failed to create project', 500);
  }
});

app.put('/api/projects/:id', zValidator('json', projectSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const project = c.req.valid('json');
    console.log(`Updating project with id: ${id}`);
    const { meta } = await c.env.dev_pmo
      .prepare('UPDATE Projects SET name = ?, status = ?, config = ? WHERE id = ?')
      .bind(project.name, project.status, JSON.stringify(project.config), id)
      .run();
    if (meta.changes === 0) {
      return handleError(c, 'Project not found', 404);
    }
    console.log(`Updated project with id: ${id}`);
    return c.json(project);
  } catch (e: any) {
    return handleError(c, 'Failed to update project', 500);
  }
});

app.delete('/api/projects/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Deleting project with id: ${id}`);
    const { meta } = await c.env.dev_pmo.prepare('DELETE FROM Projects WHERE id = ?').bind(id).run();
    if (meta.changes === 0) {
      return handleError(c, 'Project not found', 404);
    }
    console.log(`Deleted project with id: ${id}`);
    return c.json({ message: 'Project deleted' });
  } catch (e: any) {
    return handleError(c, 'Failed to delete project', 500);
  }
});

// CRUD for Tasks
app.get('/api/projects/:projectId/tasks', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    console.log(`Fetching tasks for project with id: ${projectId}`);
    const { results } = await c.env.dev_pmo
      .prepare('SELECT * FROM Tasks WHERE project_id = ?')
      .bind(projectId)
      .all();
    console.log(`Found ${results.length} tasks for project with id: ${projectId}`);
    return c.json(results);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch tasks', 500);
  }
});

app.get('/api/tasks/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Fetching task with id: ${id}`);
    const task = await c.env.dev_pmo.prepare('SELECT * FROM Tasks WHERE id = ?').bind(id).first();
    if (task) {
      console.log(`Found task with id: ${id}`);
      return c.json(task);
    }
    return handleError(c, 'Task not found', 404);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch task', 500);
  }
});

app.post('/api/tasks', zValidator('json', createTaskSchema), async (c) => {
  try {
    const taskData = c.req.valid('json');
    const task = { ...taskData, id: crypto.randomUUID() };
    console.log(`Creating task with id: ${task.id}`);
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
    console.log(`Created task with id: ${task.id}`);
    return c.json(task, 201);
  } catch (e: any) {
    console.error('Error creating task:', e);
    return c.json({ error: 'Failed to create task' }, 500);
  }
});

app.put('/api/tasks/:id', zValidator('json', taskSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const task = c.req.valid('json');
    console.log(`Updating task with id: ${id}`);
    const { meta } = await c.env.dev_pmo
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
    if (meta.changes === 0) {
      return handleError(c, 'Task not found', 404);
    }
    console.log(`Updated task with id: ${id}`);
    return c.json(task);
  } catch (e: any) {
    console.error('Error updating task:', e);
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

app.delete('/api/tasks/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Deleting task with id: ${id}`);
    const { meta } = await c.env.dev_pmo.prepare('DELETE FROM Tasks WHERE id = ?').bind(id).run();
    if (meta.changes === 0) {
      return handleError(c, 'Task not found', 404);
    }
    console.log(`Deleted task with id: ${id}`);
    return c.json({ message: 'Task deleted' });
  } catch (e: any) {
    console.error('Error deleting task:', e);
    return c.json({ error: 'Failed to delete task' }, 500);
  }
});

// CRUD for KnowledgeBase
app.get('/api/knowledge', async (c) => {
  try {
    console.log('Fetching all knowledge base entries');
    const { results } = await c.env.dev_pmo.prepare('SELECT * FROM KnowledgeBase').all();
    console.log(`Found ${results.length} knowledge base entries`);
    return c.json(results);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch knowledge base entries', 500);
  }
});

app.get('/api/knowledge/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Fetching knowledge base entry with id: ${id}`);
    const entry = await c.env.dev_pmo
      .prepare('SELECT * FROM KnowledgeBase WHERE id = ?')
      .bind(id)
      .first();
    if (entry) {
      console.log(`Found knowledge base entry with id: ${id}`);
      return c.json(entry);
    }
    return handleError(c, 'Knowledge base entry not found', 404);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch knowledge base entry', 500);
  }
});

app.post('/api/knowledge', zValidator('json', createKnowledgeBaseSchema), async (c) => {
  try {
    const entryData = c.req.valid('json');
    const entry = { ...entryData, id: crypto.randomUUID() };
    console.log(`Creating knowledge base entry with id: ${entry.id}`);
    await c.env.dev_pmo
      .prepare('INSERT INTO KnowledgeBase (id, technology, pattern, content) VALUES (?, ?, ?, ?)')
      .bind(entry.id, entry.technology, entry.pattern, entry.content)
      .run();
    console.log(`Created knowledge base entry with id: ${entry.id}`);
    return c.json(entry, 201);
  } catch (e: any) {
    console.error('Error creating knowledge base entry:', e);
    return c.json({ error: 'Failed to create knowledge base entry' }, 500);
  }
});

app.put('/api/knowledge/:id', zValidator('json', knowledgeBaseSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const entry = c.req.valid('json');
    console.log(`Updating knowledge base entry with id: ${id}`);
    const { meta } = await c.env.dev_pmo
      .prepare('UPDATE KnowledgeBase SET technology = ?, pattern = ?, content = ? WHERE id = ?')
      .bind(entry.technology, entry.pattern, entry.content, id)
      .run();
    if (meta.changes === 0) {
      return handleError(c, 'Knowledge base entry not found', 404);
    }
    console.log(`Updated knowledge base entry with id: ${id}`);
    return c.json(entry);
  } catch (e: any) {
    console.error('Error updating knowledge base entry:', e);
    return c.json({ error: 'Failed to update knowledge base entry' }, 500);
  }
});

app.delete('/api/knowledge/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Deleting knowledge base entry with id: ${id}`);
    const { meta } = await c.env.dev_pmo.prepare('DELETE FROM KnowledgeBase WHERE id = ?').bind(id).run();
    if (meta.changes === 0) {
      return handleError(c, 'Knowledge base entry not found', 404);
    }
    console.log(`Deleted knowledge base entry with id: ${id}`);
    return c.json({ message: 'Knowledge base entry deleted' });
  } catch (e: any) {
    console.error('Error deleting knowledge base entry:', e);
    return c.json({ error: 'Failed to delete knowledge base entry' }, 500);
  }
});

export default app;
