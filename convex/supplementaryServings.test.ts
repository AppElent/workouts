/// <reference types="vite/client" />
import { allShippedFoods } from '@workouts/core/nutrition';
import { convexTest } from 'convex-test';
import { api } from './_generated/api';
import { expect, it } from 'vitest';
import schema from './schema';
const modules = import.meta.glob('./**/*.*s');
const food = allShippedFoods()[0];
const paginationOpts = { numItems: 100, cursor: null };
it('keeps added Servings on the owning account without changing the Shipped Food', async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: 'alice' });
  const bob = t.withIdentity({ subject: 'bob' });
  const added = await alice.mutation(api.supplementaryServings.create, { foodId: food.id, name: 'My bowl', amount: 187.5, unit: food.baseUnit });
  expect(added).toMatchObject({ foodId: food.id, name: 'My bowl', amount: 187.5 });
  expect((await alice.query(api.supplementaryServings.list, { foodId: food.id, paginationOpts })).page).toEqual([added]);
  expect((await bob.query(api.supplementaryServings.list, { foodId: food.id, paginationOpts })).page).toEqual([]);
  await expect(t.query(api.supplementaryServings.list, { foodId: food.id, paginationOpts })).rejects.toThrow('Unauthenticated');
});
it('validates food and amount, and allows only the owner to change or remove a Serving', async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: 'alice' });
  const bob = t.withIdentity({ subject: 'bob' });
  const input = { foodId: food.id, name: 'Bowl', amount: 200, unit: food.baseUnit };
  await expect(alice.mutation(api.supplementaryServings.create, { ...input, amount: 0 })).rejects.toThrow('Amount');
  await expect(alice.mutation(api.supplementaryServings.create, { ...input, unit: food.baseUnit === 'g' ? 'ml' : 'g' })).rejects.toThrow('unit');
  const saved = await alice.mutation(api.supplementaryServings.create, input);
  await expect(alice.mutation(api.supplementaryServings.create, { ...input, name: ' BOWL ' })).rejects.toThrow('already exists');
  await expect(bob.mutation(api.supplementaryServings.update, { id: saved.id, name: 'Stolen', amount: 250 })).rejects.toThrow('not found');
  await expect(bob.mutation(api.supplementaryServings.remove, { id: saved.id })).rejects.toThrow('not found');
  await alice.mutation(api.supplementaryServings.update, { id: saved.id, name: 'Large bowl', amount: 250 });
  expect((await alice.query(api.supplementaryServings.list, { foodId: food.id, paginationOpts })).page[0]).toMatchObject({ name: 'Large bowl', amount: 250 });
  await alice.mutation(api.supplementaryServings.remove, { id: saved.id });
  expect((await alice.query(api.supplementaryServings.list, { foodId: food.id, paginationOpts })).page).toEqual([]);
});
