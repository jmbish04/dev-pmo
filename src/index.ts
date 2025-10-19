import { Hono, Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { handleError } from './utils';
import {
  projectSchema,
  createProjectSchema,
  taskSchema,
  createTaskSchema,
  knowledgeBaseSchema,
  createKnowledgeBaseSchema,
} from './schemas';
import { Env } from './types';
import { ProjectActor } from './actors';
import { Orchestrator } from './orchestrator';

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
    const actorId = c.env.PROJECT_ACTOR.idFromString(id);
    const stub = c.env.PROJECT_ACTOR.get(actorId);
    const response = await stub.fetch(new Request(`https://.../project`));
    if (response.ok) {
      const project = await response.json();
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

    const id = c.env.PROJECT_ACTOR.idFromString(project.id);
    const stub = c.env.PROJECT_ACTOR.get(id);
    await stub.fetch(new Request(`https://.../project`, { method: 'POST', body: JSON.stringify(project) }));

    // Plan the project with the orchestrator
    const orchestrator = new Orchestrator(c.env);
    const tasks = await orchestrator.planProject(project);

    // Add the tasks to the project actor
    await stub.fetch(new Request(`https://.../tasks/batch`, { method: 'POST', body: JSON.stringify({ tasks }) }));

    console.log(`Created project with id: ${project.id} and ${tasks.length} tasks`);
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

    const actorId = c.env.PROJECT_ACTOR.idFromString(id);
    const stub = c.env.PROJECT_ACTOR.get(actorId);
    await stub.fetch(new Request(`https://.../project`, { method: 'POST', body: JSON.stringify(project) }));

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

    const actorId = c.env.PROJECT_ACTOR.idFromString(id);
    const stub = c.env.PROJECT_ACTOR.get(actorId);
    await stub.fetch(new Request(`https://.../project`, { method: 'DELETE' }));

    console.log(`Deleted project with id: ${id}`);
    return c.json({ message: 'Project deleted' });
  } catch (e: any) {
    return handleError(c, 'Failed to delete project', 500);
  }
});

// Task Routes (Project-Scoped)
const taskRoutes = new Hono()
  .post('/', async (c: Context<{ Bindings: Env; Variables: { projectId: string } }>) => {
    const { projectId } = c.req.param();
    const taskData = await c.req.json();
    const validation = createTaskSchema.safeParse(taskData);
    if (!validation.success) {
      return c.json({ error: 'Invalid task data' }, 400);
    }
    const actor = c.env.PROJECT_ACTOR.get(c.env.PROJECT_ACTOR.idFromString(projectId));
    const response = await actor.fetch(new Request('https://.../tasks', { method: 'POST', body: JSON.stringify(validation.data) }));
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  })
  .post('/batch', async (c: Context<{ Bindings: Env; Variables: { projectId: string } }>) => {
    const { projectId } = c.req.param();
    const { tasks } = await c.req.json();
    const validation = z.array(createTaskSchema).safeParse(tasks);
    if (!validation.success) {
      return c.json({ error: 'Invalid task data' }, 400);
    }
    const actor = c.env.PROJECT_ACTOR.get(c.env.PROJECT_ACTOR.idFromString(projectId));
    const response = await actor.fetch(new Request('https://.../tasks/batch', { method: 'POST', body: JSON.stringify({ tasks: validation.data }) }));
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  })
  .get('/:taskId', async (c: Context<{ Bindings: Env; Variables: { projectId: string; taskId: string } }>) => {
    const { projectId, taskId } = c.req.param();
    const actor = c.env.PROJECT_ACTOR.get(c.env.PROJECT_ACTOR.idFromString(projectId));
    const response = await actor.fetch(new Request(`https://.../tasks/${taskId}`));
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  })
  .put('/:taskId', async (c: Context<{ Bindings: Env; Variables: { projectId: string; taskId: string } }>) => {
    const { projectId, taskId } = c.req.param();
    const taskData = await c.req.json();
    const validation = taskSchema.safeParse(taskData);
    if (!validation.success) {
      return c.json({ error: 'Invalid task data' }, 400);
    }
    const actor = c.env.PROJECT_ACTOR.get(c.env.PROJECT_ACTOR.idFromString(projectId));
    const response = await actor.fetch(new Request(`https://.../tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(validation.data) }));
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  })
  .delete('/:taskId', async (c: Context<{ Bindings: Env; Variables: { projectId: string; taskId: string } }>) => {
    const { projectId, taskId } = c.req.param();
    const actor = c.env.PROJECT_ACTOR.get(c.env.PROJECT_ACTOR.idFromString(projectId));
    await actor.fetch(new Request(`https://.../tasks/${taskId}`, { method: 'DELETE' }));
    return c.json({ message: 'Task deleted' });
  })
  .post('/:taskId/status', async (c: Context<{ Bindings: Env; Variables: { projectId: string; taskId: string } }>) => {
    const { projectId, taskId } = c.req.param();
    const { status } = await c.req.json();
    const validation = taskSchema.shape.status.safeParse(status);
    if (!validation.success) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    const actor = c.env.PROJECT_ACTOR.get(c.env.PROJECT_ACTOR.idFromString(projectId));
    const response = await actor.fetch(new Request(`https://.../tasks/${taskId}/status`, { method: 'POST', body: JSON.stringify({ status: validation.data }) }));
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  });

app.route('/api/projects/:projectId/tasks', taskRoutes);

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

// Agent Communication Hub
app.post('/api/task/:taskId/status', zValidator('json', z.object({ status: taskSchema.shape.status })), async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const { status } = c.req.valid('json');
    console.log(`Updating status for task ${taskId} to ${status}`);

    const task: any = await c.env.dev_pmo.prepare('SELECT * FROM Tasks WHERE id = ?').bind(taskId).first();
    if (!task) {
      return handleError(c, 'Task not found', 404);
    }

    const id = c.env.PROJECT_ACTOR.idFromString(task.project_id);
    const stub = c.env.PROJECT_ACTOR.get(id);

    const response = await stub.fetch(new Request(`https://.../tasks/status`, {
      method: 'POST',
      body: JSON.stringify({ taskId, status }),
    }));

    if (response.ok) {
      const updatedTask = await response.json();
      return c.json(updatedTask);
    } else {
      return handleError(c, 'Failed to update task status', 500);
    }
  } catch (e: any) {
    console.error('Error updating task status:', e);
    return c.json({ error: 'Failed to update task status' }, 500);
  }
});

app.post('/api/task/:taskId/question', zValidator('json', z.object({ question: z.string() })), async (c) => {
  const { taskId } = c.req.param();
  const { question } = c.req.valid('json');
  console.log(`Question received for task ${taskId}: ${question}`);
  // In a real implementation, this would trigger a process to answer the question.
  return c.json({ message: 'Question received and logged.' });
});

app.get('/api/task/:taskId/details', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    console.log(`Fetching details for task ${taskId}`);
    const task = await c.env.dev_pmo.prepare('SELECT * FROM Tasks WHERE id = ?').bind(taskId).first();
    if (task) {
      return c.json(task);
    }
    return handleError(c, 'Task not found', 404);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch task', 500);
  }
});

export { ProjectActor } from './actors';

export default app;
