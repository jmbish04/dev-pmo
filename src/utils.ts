import { Context } from 'hono';
import { StatusCode } from 'hono/utils/http-status';

export const handleError = (c: Context, message: string, status: StatusCode) => {
  console.error(message);
  return c.json({ error: message }, status);
};
