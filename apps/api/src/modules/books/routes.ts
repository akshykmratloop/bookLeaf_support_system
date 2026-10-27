import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { BookListSchema, BookSchema, IdParamSchema, ProblemSchema } from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { BooksService } from './service.js';

export const booksRoutes: FastifyPluginAsyncZod<{ books: BooksService }> = async (
  app,
  { books },
) => {
  app.get(
    '/books',
    {
      schema: {
        tags: ['books'],
        summary: 'Books: an author gets their own, an admin gets all',
        response: { 200: BookListSchema, 401: ProblemSchema },
      },
    },
    async (req) => books.list(sessionOf(req)),
  );

  app.get(
    '/books/:id',
    {
      schema: {
        tags: ['books'],
        summary: 'One book (404 if it is not yours)',
        params: IdParamSchema,
        response: { 200: BookSchema, 404: ProblemSchema },
      },
    },
    async (req) => books.get(sessionOf(req), req.params.id),
  );
};
