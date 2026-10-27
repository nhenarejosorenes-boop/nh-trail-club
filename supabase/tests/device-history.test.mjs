import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDeviceImports } from '../../lib/device-history.ts';

function client(rows, error = null) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'order']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = async (...args) => { calls.push(['range', ...args]); return { data: rows, error }; };
  return { calls, from(name) { calls.push(['from', name]); return query; } };
}
test('import history restricts ownership and provenance and paginates without losing the lookahead row', async () => {
  const db = client(Array.from({ length: 21 }, (_, id) => ({ id })));
  const result = await loadDeviceImports(db, 'runner-a', 20);
  assert.equal(result.entries.length, 20);
  assert.equal(result.entries.at(-1).id, 19);
  assert.equal(result.hasMore, true);
  assert.ok(db.calls.some(c => c[0] === 'eq' && c[1] === 'athlete_id' && c[2] === 'runner-a'));
  assert.ok(db.calls.some(c => c[0] === 'eq' && c[1] === 'source' && c[2] === 'file'));
  assert.deepEqual(db.calls.filter(c => c[0] === 'order'), [['order','created_at',{ascending:false}],['order','id',{ascending:false}]]);
  assert.deepEqual(db.calls.at(-1), ['range', 20, 40]);
});
test('empty and exactly full final pages have no next page', async () => {
  for (const count of [0, 20]) {
    const result = await loadDeviceImports(client(Array.from({ length: count }, (_, id) => ({ id }))), 'runner-a');
    assert.equal(result.entries.length, count);
    assert.equal(result.hasMore, false);
  }
});
test('a database error propagates rather than being presented as an empty history', async () => {
  await assert.rejects(loadDeviceImports(client(null, new Error('unavailable')), 'runner-a'), /unavailable/);
});
test('missing ownership or invalid offsets never issue a query', async () => {
  const db = client([]);
  for (const [uid, offset] of [['', 0], ['runner-a', -1], ['runner-a', 1.5]]) await assert.rejects(loadDeviceImports(db, uid, offset));
  assert.equal(db.calls.length, 0);
});
