import { z } from 'zod';
import { projectSchema, taskSchema } from './schemas';
import { Env } from './types';

// Define the Orchestrator class
export class Orchestrator {
  env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // Consult with the user and plan the project
  async planProject(project: z.infer<typeof projectSchema>): Promise<z.infer<typeof taskSchema>[]> {
    // In a real implementation, this would involve a conversation with an LLM
    // to break down the project into tasks. For now, we'll just create some
    // dummy tasks.
    console.log(`Planning project: ${project.name}`);

    const tasks = [
      {
        id: crypto.randomUUID(),
        project_id: project.id,
        phase: 'Development',
        instructions: 'Set up the basic project structure.',
        status: 'TODO',
      },
      {
        id: crypto.randomUUID(),
        project_id: project.id,
        phase: 'Development',
        instructions: 'Build the core API endpoints.',
        status: 'TODO',
      },
      {
        id: crypto.randomUUID(),
        project_id: project.id,
        phase: 'Testing',
        instructions: 'Write unit tests for the API.',
        status: 'TODO',
      },
    ];

    console.log(`Created ${tasks.length} tasks for project: ${project.name}`);

    return tasks.map(task => taskSchema.parse(task));
  }
}
