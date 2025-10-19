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
  PROJECT_ACTOR: DurableObjectNamespace;
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

import { Orchestrator } from './orchestrator';

// ... (rest of the file)

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
    for (const task of tasks) {
      await stub.fetch(new Request(`https://.../tasks`, { method: 'POST', body: JSON.stringify(task) }));
    }

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

// CRUD for Tasks
app.get('/api/projects/:projectId/tasks', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    console.log(`Fetching tasks for project with id: ${projectId}`);

    const id = c.env.PROJECT_ACTOR.idFromString(projectId);
    const stub = c.env.PROJECT_ACTOR.get(id);
    const response = await stub.fetch(new Request(`https://.../tasks`));

    if (response.ok) {
      const tasks = await response.json();
      return c.json(tasks);
    }

    return handleError(c, 'Failed to fetch tasks', 500);
  } catch (e: any) {
    return handleError(c, 'Failed to fetch tasks', 500);
  }
});

app.get('/api/tasks/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Fetching task with id: ${id}`);

    // First, get the project_id from the task
    const task: any = await c.env.dev_pmo.prepare('SELECT project_id FROM Tasks WHERE id = ?').bind(id).first();
    if (!task) {
      return handleError(c, 'Task not found', 404);
    }

    // Then, get the task details from the actor
    const actorId = c.env.PROJECT_ACTOR.idFromString(task.project_id);
    const stub = c.env.PROJECT_ACTOR.get(actorId);
    const response = await stub.fetch(new Request(`https://.../tasks/${id}`));

    if (response.ok) {
      const taskDetails = await response.json();
      return c.json(taskDetails);
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

    const id = c.env.PROJECT_ACTOR.idFromString(task.project_id);
    const stub = c.env.PROJECT_ACTOR.get(id);
    await stub.fetch(new Request(`https://.../tasks`, { method: 'POST', body: JSON.stringify(task) }));

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

    // First, get the project_id from the task
    const taskData: any = await c.env.dev_pmo.prepare('SELECT project_id FROM Tasks WHERE id = ?').bind(id).first();
    if (!taskData) {
      return handleError(c, 'Task not found', 404);
    }

    // Then, update the task in the actor
    const actorId = c.env.PROJECT_ACTOR.idFromString(taskData.project_id);
    const stub = c.env.PROJECT_ACTOR.get(actorId);
    const response = await stub.fetch(new Request(`https://.../tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }));

    if (response.ok) {
      const updatedTask = await response.json();
      return c.json(updatedTask);
    }

    return handleError(c, 'Failed to update task', 500);
  } catch (e: any) {
    console.error('Error updating task:', e);
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

app.delete('/api/tasks/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`Deleting task with id: ${id}`);

    // First, get the project_id from the task
    const task: any = await c.env.dev_pmo.prepare('SELECT project_id FROM Tasks WHERE id = ?').bind(id).first();
    if (!task) {
      return handleError(c, 'Task not found', 404);
    }

    // Then, delete the task in the actor
    const actorId = c.env.PROJECT_ACTOR.idFromString(task.project_id);
    const stub = c.env.PROJECT_ACTOR.get(actorId);
    await stub.fetch(new Request(`https://.../tasks/${id}`, { method: 'DELETE' }));

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
