import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailSessionChoices, trailLinkContext, validTrailDate, trailSessionHref } from '../../lib/trail-session-link.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('session URL context validates identifiers and real calendar dates and clamps future dates to today', () => {
  assert.deepEqual(trailLinkContext(new URLSearchParams({ session: id, date: '2026-10-25' }), '2026-10-27'), { session: id, date: '2026-10-25' });
  for (const date of ['2026-02-30', '2026-10-28', '1999-01-01', 'garbage']) assert.equal(trailLinkContext(new URLSearchParams({ date }), '2026-10-27').date, '2026-10-27');
  for (const session of ['x', '../admin', id + ',id.eq.other']) assert.equal(trailLinkContext(new URLSearchParams({ session }), '2026-10-27').session, '');
  assert.equal(validTrailDate('2024-02-29'), true);
  assert.equal(validTrailDate('2026-02-29'), false);
  const url = new URL(trailSessionHref('/importar-actividad', { id, session_date: '2026-10-25' }), 'https://example.test');
  assert.equal(url.searchParams.get('session'), id);
  assert.equal(url.searchParams.get('date'), '2026-10-25');
});
function fake(rows, retained = null, error = null) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select() { return q; }, order() { return q; }, eq(...args) { call.filters.push(['eq', ...args]); return q; }, gte(...args) { call.filters.push(['gte', ...args]); return q; }, lte(...args) { call.filters.push(['lte', ...args]); return q; },
      range(from, to) { call.range = [from, to]; return Promise.resolve({ data: rows.slice(from, to + 1), error }); }, maybeSingle() { return Promise.resolve({ data: retained, error }); } }; return q;
  } };
}
test('selector retains the current session outside the date window and scopes both queries to owner and trail', async () => {
  const db = fake([{ id: 'near', session_date: '2026-10-27', title: 'Hoy' }], { id, session_date: '2026-09-01', title: 'Antes' });
  const result = await loadTrailSessionChoices(db, 'runner', '2026-10-27', id);
  assert.deepEqual(result.map(p => p.id), [id, 'near']);
  for (const call of db.calls) assert.deepEqual(call.filters.slice(0, 2), [['eq', 'athlete_id', 'runner'], ['eq', 'category', 'trail']]);
  assert.deepEqual(db.calls[0].filters.slice(2), [['gte', 'session_date', '2026-10-20'], ['lte', 'session_date', '2026-11-03']]);
  assert.deepEqual(db.calls[1].filters.at(-1), ['eq', 'id', id]);
});
test('a missing or inaccessible retained session is never fabricated and a nearby one is not fetched twice', async () => {
  assert.deepEqual(await loadTrailSessionChoices(fake([]), 'runner', '2026-10-27', id), []);
  const db = fake([{ id, session_date: '2026-10-27', title: 'Hoy' }]);
  assert.equal((await loadTrailSessionChoices(db, 'runner', '2026-10-27', id)).length, 1);
  assert.equal(db.calls.length, 1);
});
test('all selector pages keep ownership and failures reject instead of clearing an existing link', async () => {
  const db = fake(Array.from({ length: 501 }, (_, i) => ({ id: String(i), session_date: '2026-10-27' })));
  assert.equal((await loadTrailSessionChoices(db, 'runner', '2026-10-27')).length, 501);
  assert.deepEqual(db.calls.map(c => c.range), [[0, 499], [500, 999]]);
  for (const c of db.calls) assert.deepEqual(c.filters[0], ['eq', 'athlete_id', 'runner']);
  await assert.rejects(loadTrailSessionChoices(fake([], null, new Error('offline')), 'runner', '2026-10-27'), /offline/);
});
test('invalid owner, date or identifier never queries the database', async () => {
  const db = fake([]);
  for (const args of [['', '2026-10-27', ''], ['runner', '2026-02-30', ''], ['runner', '2026-10-27', 'invalid']]) await assert.rejects(loadTrailSessionChoices(db, ...args));
  assert.equal(db.calls.length, 0);
});
