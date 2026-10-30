import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  ArticleListSchema,
  ArticleSchema,
  CategoryListSchema,
  CategoryOptionListSchema,
  CategorySchema,
  CreateArticleSchema,
  CreateCategorySchema,
  IdParamSchema,
  ProblemSchema,
  ReorderSchema,
  UpdateArticleSchema,
  UpdateCategorySchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { CategoryService } from './service.js';

interface Opts {
  categories: CategoryService;
}

const ADMIN = { roles: ['ADMIN'] as const };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 409: ProblemSchema, 422: ProblemSchema };
const tags = ['workspace'];

function registerCategoryReads(app: RouteApp, { categories }: Opts) {
  const c = categories.categories;
  app.get(
    '/categories',
    {
      schema: {
        tags,
        summary: 'The active categories of your workspace (issue types, queue filters)',
        response: { 200: CategoryOptionListSchema, 401: ProblemSchema },
      },
    },
    async (req) => categories.options(sessionOf(req)),
  );
  app.get(
    '/workspace/categories',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Every ticket category, in order',
        response: { 200: CategoryListSchema, ...errors },
      },
    },
    async (req) => c.list(sessionOf(req)),
  );
  app.post(
    '/workspace/categories',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Add a ticket category (its key is fixed once created)',
        body: CreateCategorySchema,
        response: { 201: CategorySchema, ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await c.create(sessionOf(req), req.body)),
  );
}

function registerCategoryWrites(app: RouteApp, { categories }: Opts) {
  const c = categories.categories;
  app.patch(
    '/workspace/categories/:id',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Change or deactivate a ticket category',
        params: IdParamSchema,
        body: UpdateCategorySchema,
        response: { 200: CategorySchema, 404: ProblemSchema, ...errors },
      },
    },
    async (req) => c.update(sessionOf(req), req.params.id, req.body),
  );
  app.put(
    '/workspace/categories/order',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Set the order of every ticket category',
        body: ReorderSchema,
        response: { 200: CategoryListSchema, ...errors },
      },
    },
    async (req) => c.reorder(sessionOf(req), req.body.ids),
  );
}

function registerArticleReads(app: RouteApp, { categories }: Opts) {
  const a = categories.articles;
  app.get(
    '/workspace/knowledge',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Every knowledge-base article, in order',
        response: { 200: ArticleListSchema, ...errors },
      },
    },
    async (req) => a.list(sessionOf(req)),
  );
  app.post(
    '/workspace/knowledge',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Add a knowledge-base article linked to categories',
        body: CreateArticleSchema,
        response: { 201: ArticleSchema, ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await a.create(sessionOf(req), req.body)),
  );
}

function registerArticleWrites(app: RouteApp, { categories }: Opts) {
  const a = categories.articles;
  app.patch(
    '/workspace/knowledge/:id',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Change, relink or deactivate a knowledge-base article',
        params: IdParamSchema,
        body: UpdateArticleSchema,
        response: { 200: ArticleSchema, 404: ProblemSchema, ...errors },
      },
    },
    async (req) => a.update(sessionOf(req), req.params.id, req.body),
  );
  app.put(
    '/workspace/knowledge/order',
    {
      config: ADMIN,
      schema: {
        tags,
        summary: 'Set the order of every knowledge-base article',
        body: ReorderSchema,
        response: { 200: ArticleListSchema, ...errors },
      },
    },
    async (req) => a.reorder(sessionOf(req), req.body.ids),
  );
}

export const categoryRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerCategoryReads(app, opts);
  registerCategoryWrites(app, opts);
  registerArticleReads(app, opts);
  registerArticleWrites(app, opts);
};
