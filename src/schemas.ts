import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['PENDING', 'PLANNING', 'EXECUTING', 'COMPLETED']),
  config: z.any(),
});
export const createProjectSchema = projectSchema.omit({ id: true });

export const taskSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  phase: z.string(),
  instructions: z.string(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE']),
  agent: z.string().optional(),
  logs: z.string().optional(),
});
export const createTaskSchema = taskSchema.omit({ id: true });

export const knowledgeBaseSchema = z.object({
  id: z.string(),
  technology: z.string(),
  pattern: z.string(),
  content: z.string(),
});
export const createKnowledgeBaseSchema = knowledgeBaseSchema.omit({ id: true });
