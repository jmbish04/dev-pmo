// tests/smoke.test.ts
import app from '../src/index';
import { Env } from '../src/types';

describe('Helios API Smoke Tests', () => {
  let worker: any;

  beforeAll(async () => {
    worker = await app.fetch;
  });

  it('should create a project', async () => {
    const project = {
      name: 'Test Project',
      status: 'PENDING',
      config: {},
    };
    const response = await worker(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(project),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response.status).toBe(201);
    const newProject = await response.json();
    expect(newProject.name).toBe('Test Project');
  });

  it('should create a task for a project', async () => {
    // First, create a project
    const project = { name: 'Task Project', status: 'PENDING', config: {} };
    let response = await worker(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(project),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { id: projectId } = await response.json();

    // Then, create a task
    const task = {
      project_id: projectId,
      phase: 'Development',
      instructions: 'Write some code',
      status: 'TODO',
    };
    response = await worker(
      new Request(`http://localhost/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response.status).toBe(201);
  });
});
