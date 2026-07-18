import type { Elysia } from 'elysia';
import { z } from 'zod';

const register = (app: Elysia) =>
  app.post(
    '/',
    ({ body }) => {
      return {
        success: true,
        message: `Registered as ${body.username}`,
      };
    },
    {
      body: z.object({
        username: z.string().min(3),
        password: z.string().min(8),
      }),
    }
  );

export default register;
