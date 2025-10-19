import { Context } from 'hono';

export const handleError = (c: Context, message: string, status: number) => {
  console.error(message);
  return c.json({ error: message }, status);
};
