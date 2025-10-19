import { z } from 'zod';
import { projectSchema, taskSchema } from './schemas';

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
    switch (url.pathname) {
      case '/project':
        if (request.method === 'GET') {
          const project = await this.getProject();
          return new Response(JSON.stringify(project), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else if (request.method === 'POST') {
          const project = await request.json();
          await this.setProject(project);
          return new Response('OK');
        } else if (request.method === 'DELETE') {
          await this.deleteProject();
          return new Response('OK');
        }
        break;
      case '/tasks':
        if (request.method === 'GET') {
          const tasks = await this.getTasks();
          return new Response(JSON.stringify(tasks), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else if (request.method === 'POST') {
          const task = await request.json();
          await this.addTask(task);
          return new Response('OK');
        }
        break;
      default:
        if (url.pathname.startsWith('/tasks/')) {
          const taskId = url.pathname.split('/')[2];
          if (request.method === 'GET') {
            const task = await this.getTask(taskId);
            if (task) {
              return new Response(JSON.stringify(task), {
                headers: { 'Content-Type': 'application/json' },
              });
            } else {
              return new Response('Task not found', { status: 404 });
            }
          } else if (request.method === 'PUT') {
            const task = await request.json();
            const updatedTask = await this.updateTask(task);
            if (updatedTask) {
              return new Response(JSON.stringify(updatedTask), {
                headers: { 'Content-Type': 'application/json' },
              });
            } else {
              return new Response('Task not found', { status: 404 });
            }
          } else if (request.method === 'DELETE') {
            await this.deleteTask(taskId);
            return new Response('OK');
          }
        } else if (url.pathname === '/tasks/status') {
          if (request.method === 'POST') {
            const { taskId, status } = await request.json();
            const updatedTask = await this.updateTaskStatus(taskId, status);
            if (updatedTask) {
              return new Response(JSON.stringify(updatedTask), {
                headers: { 'Content-Type': 'application/json' },
              });
            } else {
              return new Response('Task not found', { status: 404 });
            }
          }
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
  async updateTask(updatedTask: z.infer<typeof taskSchema>) {
    const tasks = await this.getTasks() as any[];
    const taskIndex = tasks.findIndex((t: any) => t.id === updatedTask.id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = updatedTask;
      await this.state.storage.put('tasks', tasks);
      await this.env.dev_pmo
        .prepare(
          'REPLACE INTO Tasks (id, project_id, phase, instructions, status, agent, logs) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          updatedTask.id,
          updatedTask.project_id,
          updatedTask.phase,
          updatedTask.instructions,
          updatedTask.status,
          updatedTask.agent,
          updatedTask.logs
        )
        .run();
      return updatedTask;
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
    const project = await this.getProject();
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
  async addTask(task: z.infer<typeof taskSchema>) {
    const tasks = await this.getTasks() as any[];
    tasks.push(task);
    await this.state.storage.put('tasks', tasks);
    await this.env.dev_pmo
      .prepare(
        'REPLACE INTO Tasks (id, project_id, phase, instructions, status, agent, logs) VALUES (?, ?, ?, ?, ?, ?, ?)'
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

// Define the environment bindings for the actor
export type Env = {
  dev_pmo: D1Database;
};
