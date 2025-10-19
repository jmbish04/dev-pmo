import { z } from 'zod';
import { projectSchema, taskSchema, createTaskSchema } from './schemas';
import { Env } from './types';

// Define the ProjectActor class
export class ProjectActor {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Project routes
    if (path === '/project') {
      if (method === 'GET') {
        const project = await this.getProject();
        return new Response(JSON.stringify(project), { headers: { 'Content-Type': 'application/json' } });
      } else if (method === 'POST') {
        const project = (await request.json()) as z.infer<typeof projectSchema>;
        await this.setProject(project);
        return new Response('OK', { status: 201 });
      } else if (method === 'DELETE') {
        await this.deleteProject();
        return new Response('OK');
      }
    }

    // Task routes
    if (path === '/tasks/batch') {
      if (method === 'POST') {
        const { tasks } = (await request.json()) as { tasks: z.infer<typeof createTaskSchema>[] };
        const createdTasks = await this.addTasks(tasks);
        return new Response(JSON.stringify(createdTasks), { headers: { 'Content-Type': 'application/json' }, status: 201 });
      }
    } else if (path === '/tasks') {
      if (method === 'POST') {
        const task = (await request.json()) as z.infer<typeof createTaskSchema>;
        const createdTask = await this.addTask(task);
        return new Response(JSON.stringify(createdTask), { headers: { 'Content-Type': 'application/json' }, status: 201 });
      }
    }

    const taskMatch = path.match(/^\/tasks\/(.+)\/status$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      if (method === 'POST') {
        const { status } = (await request.json()) as { status: z.infer<typeof taskSchema>['status'] };
        const updatedTask = await this.updateTaskStatus(taskId, status);
        if (updatedTask) {
          return new Response(JSON.stringify(updatedTask), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response('Task not found', { status: 404 });
        }
      }
    }

    const taskIdMatch = path.match(/^\/tasks\/(.+)$/);
    if (taskIdMatch) {
      const taskId = taskIdMatch[1];
      if (method === 'GET') {
        const task = await this.getTask(taskId);
        if (task) {
          return new Response(JSON.stringify(task), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response('Task not found', { status: 404 });
        }
      } else if (method === 'PUT') {
        const task = await request.json();
        const updatedTask = await this.updateTask({ ...(task as object), id: taskId });
        if (updatedTask) {
          return new Response(JSON.stringify(updatedTask), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response('Task not found', { status: 404 });
        }
      } else if (method === 'DELETE') {
        await this.deleteTask(taskId);
        return new Response('OK');
      }
    }

    return new Response('Not found', { status: 404 });
  }

  // ... (rest of the file)

  // Get a single task by id
  async getTask(taskId: string) {
    const tasks = await this.getTasks() as any[];
    return tasks.find((t: any) => t.id === taskId);
  }

  // Update a single task
  async updateTask(updatedTask: Partial<z.infer<typeof taskSchema>>) {
    const tasks = await this.getTasks() as any[];
    const taskIndex = tasks.findIndex((t: any) => t.id === updatedTask.id);
    if (taskIndex !== -1) {
      const existingTask = tasks[taskIndex];
      const newTask = {
        id: existingTask.id,
        project_id: existingTask.project_id,
        phase: updatedTask.phase || existingTask.phase,
        instructions: updatedTask.instructions || existingTask.instructions,
        status: updatedTask.status || existingTask.status,
        agent: updatedTask.agent || existingTask.agent,
        logs: updatedTask.logs || existingTask.logs,
      };
      tasks[taskIndex] = newTask;
      await this.state.storage.put('tasks', tasks);
      await this.env.dev_pmo
        .prepare(
          'REPLACE INTO Tasks (id, project_id, phase, instructions, status, agent, logs) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          newTask.id,
          newTask.project_id,
          newTask.phase,
          newTask.instructions,
          newTask.status,
          newTask.agent,
          newTask.logs
        )
        .run();
      return newTask;
    }
    return null;
  }

  // Delete a single task
  async deleteTask(taskId: string) {
    const tasks = await this.getTasks() as any[];
    const newTasks = tasks.filter((t: any) => t.id !== taskId);
    await this.state.storage.put('tasks', newTasks);
    await this.env.dev_pmo.prepare('DELETE FROM Tasks WHERE id = ?').bind(taskId).run();
  }

  // Get the project's current state
  async getProject() {
    const project = await this.state.storage.get('project');
    return project;
  }

  // Set the project's state
  async setProject(project: z.infer<typeof projectSchema>) {
    await this.state.storage.put('project', project);
    await this.env.dev_pmo
      .prepare('REPLACE INTO Projects (id, name, status, config) VALUES (?, ?, ?, ?)')
      .bind(project.id, project.name, project.status, JSON.stringify(project.config))
      .run();
  }

  // Delete the project
  async deleteProject() {
    const project: any = await this.getProject();
    if (project) {
      await this.env.dev_pmo.prepare('DELETE FROM Projects WHERE id = ?').bind(project.id).run();
      await this.state.storage.deleteAll();
    }
  }

  // Get all tasks for the project
  async getTasks() {
    const tasks = await this.state.storage.get('tasks');
    return tasks || [];
  }

  // Add a new task to the project
  async addTask(task: z.infer<typeof createTaskSchema>) {
    const tasks = await this.getTasks() as any[];
    const newTask = { ...task, id: crypto.randomUUID() };
    tasks.push(newTask);
    await this.state.storage.put('tasks', tasks);
    await this.env.dev_pmo
      .prepare(
        'REPLACE INTO Tasks (id, project_id, phase, instructions, status, agent, logs) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        newTask.id,
        newTask.project_id,
        newTask.phase,
        newTask.instructions,
        newTask.status,
        newTask.agent,
        newTask.logs
      )
      .run();
    return newTask;
  }

  // Add multiple tasks to the project
  async addTasks(newTasks: z.infer<typeof createTaskSchema>[]) {
    const tasks = await this.getTasks() as any[];
    const createdTasks = newTasks.map(task => ({ ...task, id: crypto.randomUUID() }));
    tasks.push(...createdTasks);
    await this.state.storage.put('tasks', tasks);

    const stmt = this.env.dev_pmo.prepare(
      'REPLACE INTO Tasks (id, project_id, phase, instructions, status, agent, logs) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const batch = createdTasks.map(task =>
      stmt.bind(task.id, task.project_id, task.phase, task.instructions, task.status, task.agent, task.logs)
    );
    await this.env.dev_pmo.batch(batch);

    return createdTasks;
  }

  // Update a task's status
  async updateTaskStatus(taskId: string, status: z.infer<typeof taskSchema>['status']) {
    const tasks = await this.getTasks() as any[];
    const taskIndex = tasks.findIndex((t: any) => t.id === taskId);
    if (taskIndex !== -1) {
      tasks[taskIndex].status = status;
      await this.state.storage.put('tasks', tasks);

      // Also update in D1
      await this.env.dev_pmo
        .prepare('UPDATE Tasks SET status = ? WHERE id = ?')
        .bind(status, taskId)
        .run();

      return tasks[taskIndex];
    }
    return null;
  }
}
