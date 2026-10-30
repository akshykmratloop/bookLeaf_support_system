import { describe, expect, it } from 'vitest';
import {
  CategoryKeySchema,
  CreateCategorySchema,
  ReorderSchema,
  UpdateCategorySchema,
} from './categories.js';
import { CreateArticleSchema, UpdateArticleSchema } from './knowledge.js';

const valid = {
  key: 'BILLING',
  label: 'Billing',
  description: 'Invoices, refunds and card problems.',
  defaultPriority: 'MEDIUM',
};

describe('CategoryKeySchema', () => {
  it.each(['GE', 'BILLING_QUESTIONS', 'A1_B2', `A${'B'.repeat(39)}`])('accepts %s', (key) => {
    expect(CategoryKeySchema.safeParse(key).success).toBe(true);
  });
  it.each(['A', `A${'B'.repeat(40)}`, 'billing', '1BILLING', 'BILL-ING', "X'; DROP"])(
    'rejects %s',
    (key) => expect(CategoryKeySchema.safeParse(key).success).toBe(false),
  );
});

describe('CreateCategorySchema', () => {
  it('defaults slaHours to null and isActive to true', () => {
    expect(CreateCategorySchema.parse(valid)).toMatchObject({ slaHours: null, isActive: true });
  });
  it('strips HTML from the label and description', () => {
    const out = CreateCategorySchema.parse({ ...valid, label: '<b>Billing</b>' });
    expect(out.label).toBe('Billing');
  });
  it.each([
    ['label', ''],
    ['label', 'x'.repeat(61)],
    ['description', ''],
    ['description', 'x'.repeat(501)],
    ['slaHours', 0],
    ['slaHours', 721],
    ['defaultPriority', 'URGENT'],
  ])('rejects %s = %j', (field, value) => {
    expect(CreateCategorySchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
  it('accepts the SLA bounds 1 and 720', () => {
    for (const slaHours of [1, 720])
      expect(CreateCategorySchema.safeParse({ ...valid, slaHours }).success).toBe(true);
  });
});

describe('update and reorder schemas', () => {
  it('needs at least one field and never takes a key', () => {
    expect(UpdateCategorySchema.safeParse({}).success).toBe(false);
    expect(UpdateCategorySchema.parse({ key: 'NEW', label: 'X' })).toEqual({ label: 'X' });
  });
  it('refuses a repeated id in a new order', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(ReorderSchema.safeParse({ ids: [id, id] }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});

describe('article schemas', () => {
  it('defaults to no categories and active', () => {
    expect(CreateArticleSchema.parse({ title: 'Refunds', body: 'Within 14 days.' })).toMatchObject({
      categoryKeys: [],
      isActive: true,
    });
  });
  it('rejects an empty or oversized body, a bad key and a repeated key', () => {
    const base = { title: 'T', body: 'B' };
    expect(CreateArticleSchema.safeParse({ ...base, body: '' }).success).toBe(false);
    expect(CreateArticleSchema.safeParse({ ...base, body: 'x'.repeat(8001) }).success).toBe(false);
    expect(CreateArticleSchema.safeParse({ ...base, categoryKeys: ['bad'] }).success).toBe(false);
    expect(CreateArticleSchema.safeParse({ ...base, categoryKeys: ['AB', 'AB'] }).success).toBe(
      false,
    );
    expect(UpdateArticleSchema.safeParse({}).success).toBe(false);
  });
});
