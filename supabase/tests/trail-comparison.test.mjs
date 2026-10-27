import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStructure } from '../../lib/training-builder.ts';
import { compareTrailSession, loadLinkedTrail } from '../../lib/trail-comparison.ts';
const structure = emptyStructure();
structure.targets = { distance: '10', elevation: '0', minutes: '60', effort: '4' };
const session = { id: 's1', athlete_id: 'a', category: 'trail', session_date: '2026-10-31', completed: false, structure };
const run = (patch = {}) => ({ id: 'r1', athlete_id: 'a', linked_session_id: 's1', activity_date: '2026-11-01', distance_km: '5.5', elevation_m: 50, duration_minutes: 30, effort: 2, ...patch });
test('multiple runs aggregate across week/month boundaries and RPE is duration weighted', () => {
  const c = compareTrailSession(session, [run(), run({ id: 'r2', distance_km: 6, duration_minutes: 60, effort: 5 })]);
  assert.deepEqual(c.actual, { distance: 11.5, elevation: 100, minutes: 90, effort: 4 });
  assert.equal(c.planned.elevation, 0);
  assert.equal(c.planned.distance, 10);
  assert.equal(session.completed, false);
});
test('unlinked, other sessions and other athletes do not contribute; duplicate row ids count once', () => {
  const r = run();
  const c = compareTrailSession(session, [r, r, run({ id: 'r2', athlete_id: 'b' }), run({ id: 'r3', linked_session_id: 's2' }), run({ id: 'r4', linked_session_id: null })]);
  assert.equal(c.runs.length, 1);
  assert.equal(c.actual.distance, 5.5);
});
test('missing RPE leaves the session effort unknown instead of reporting a partial average', () => {
  const c = compareTrailSession(session, [run(), run({ id: 'r2', effort: null })]);
  assert.equal(c.actual.effort, null);
  assert.equal(c.actual.minutes, 60);
  assert.equal(c.missingEffort, 1);
});
test('no linked activity is absent data, while a recorded zero remains zero', () => {
  assert.equal(compareTrailSession(session, []).actual, null);
  assert.equal(compareTrailSession(session, [run({ distance_km: 0, elevation_m: 0 })]).actual.distance, 0);
});
test('legacy, unknown, blank and invalid targets are not invented from text or exercise durations', () => {
  for (const value of [null, { version: 99 }, emptyStructure()]) assert.deepEqual(compareTrailSession({ ...session, structure: value }, []).planned, { distance: null, elevation: null, minutes: null, effort: null });
  const invalid = emptyStructure(); invalid.targets = { distance: '-1', elevation: 'Infinity', minutes: '0', effort: '20' };
  assert.deepEqual(compareTrailSession({ ...session, structure: invalid }, []).planned, { distance: null, elevation: null, minutes: null, effort: null });
  assert.equal(compareTrailSession({ ...session, category: 'fuerza' }, [run()]).actual, null);
});
function fakeClient(rows, failAt = -1) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select() { return q; }, eq(...a) { call.filters.push(['eq', ...a]); return q; }, in(...a) { call.filters.push(['in', ...a]); return q; }, order() { return q; }, range(from, to) { call.range = [from, to]; return Promise.resolve(calls.length === failAt ? { data: null, error: new Error('offline') } : { data: rows.slice(from, to + 1), error: null }); } }; return q;
  } };
}
test('loader paginates linked activities with ownership on every page and no date restriction', async () => {
  const db = fakeClient(Array.from({ length: 501 }, (_, id) => run({ id: String(id) })));
  const rows = await loadLinkedTrail(db, 'a', ['s1', 's1']);
  assert.equal(rows.length, 501);
  assert.deepEqual(db.calls.map(c => c.range), [[0, 499], [500, 999]]);
  for (const call of db.calls) assert.deepEqual(call.filters, [['eq', 'athlete_id', 'a'], ['in', 'linked_session_id', ['s1']]]);
});
test('no ids issues no query; missing owner rejects; later-page failures reject incomplete totals', async () => {
  const db = fakeClient([]);
  assert.deepEqual(await loadLinkedTrail(db, 'a', []), []);
  await assert.rejects(loadLinkedTrail(db, '', ['s1']));
  assert.equal(db.calls.length, 0);
  await assert.rejects(loadLinkedTrail(fakeClient(Array.from({ length: 500 }, () => run()), 2), 'a', ['s1']), /offline/);
});
