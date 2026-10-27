import test from 'node:test';
import assert from 'node:assert/strict';
import { AthleteAccessError, loadAthleteCard, loadAthleteMonth, loadAthleteRoster, athletePlanHref } from '../../lib/athlete-detail.ts';
const athlete = '11111111-1111-4111-8111-111111111111';
const cardId = '22222222-2222-4222-8222-222222222222';
function fake(tables = {}, user = { id: 'coach' }) {
  const calls = [];
  return { calls, auth: { getUser: async () => ({ data: { user }, error: null }) }, from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const response = () => {
      const source = tables[table];
      if (source instanceof Error) return { data: null, error: source };
      const rows = (source ?? []).filter(row => call.filters.every(([op, k, v]) => op === 'eq' ? row[k] === v : op === 'in' ? v.includes(row[k]) : op === 'gte' ? row[k] >= v : row[k] < v));
      return { data: rows, error: null };
    };
    const q = { select() { return q; }, eq(...a) { call.filters.push(['eq', ...a]); return q; }, in(...a) { call.filters.push(['in', ...a]); return q; }, gte(...a) { call.filters.push(['gte', ...a]); return q; }, lt(...a) { call.filters.push(['lt', ...a]); return q; }, order(...a) { call.orders.push(a); return q; },
      range(from, to) { call.range = [from, to]; const r = response(); return Promise.resolve({ ...r, data: r.data?.slice(from, to + 1) ?? null }); },
      single() { const r = response(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); },
      maybeSingle() { return q.single(); }
    }; return q;
  } };
}
test('card loads only after verified admin role and uses the requested card id', async () => {
  const card = { id: cardId, user_id: athlete, nombre: 'Fixture' };
  const db = fake({ profiles: [{ id: 'coach', role: 'admin' }], deportistas: [card] });
  assert.deepEqual(await loadAthleteCard(db, cardId), card);
  assert.deepEqual(db.calls.map(c => c.table), ['profiles', 'deportistas']);
  assert.deepEqual(db.calls[1].filters, [['eq', 'id', cardId]]);
});
test('anonymous and non-admin callers never query athlete contact data', async () => {
  const anon = fake({}, null);
  await assert.rejects(loadAthleteCard(anon, cardId), e => e instanceof AthleteAccessError && e.reason === 'login');
  assert.equal(anon.calls.length, 0);
  const ordinary = fake({ profiles: [{ id: 'coach', role: 'athlete' }] });
  await assert.rejects(loadAthleteCard(ordinary, cardId), e => e.reason === 'forbidden');
  assert.deepEqual(ordinary.calls.map(c => c.table), ['profiles']);
});
test('missing and unlinked cards are distinct from failures; no account is inferred from email', async () => {
  const db = fake({ profiles: [{ id: 'coach', role: 'admin' }], deportistas: [{ id: cardId, user_id: null, email: 'fixture@example.test' }] });
  assert.equal((await loadAthleteCard(db, cardId)).user_id, null);
  assert.equal(await loadAthleteCard(fake({ profiles: [{ id: 'coach', role: 'admin' }] }), cardId), null);
  await assert.rejects(loadAthleteCard(fake({ profiles: new Error('offline') }), cardId), /offline/);
  await assert.rejects(loadAthleteCard(fake(), '../other'));
});
test('monthly detail reads only the selected athlete and feedback for sessions in that month', async () => {
  const db = fake({
    weekly_training_plan: [{ id: 's1', athlete_id: athlete, session_date: '2026-10-27' }, { id: 's2', athlete_id: 'other', session_date: '2026-10-27' }, { id: 's3', athlete_id: athlete, session_date: '2026-11-01' }],
    trail_activity_log: [{ id: 'r1', athlete_id: athlete, activity_date: '2026-10-01' }, { id: 'r2', athlete_id: 'other', activity_date: '2026-10-01' }],
    runner_goals: [{ id: 'g1', athlete_id: athlete, status: 'active' }, { id: 'g2', athlete_id: 'other' }],
    training_session_results: [{ session_id: 's1', athlete_id: athlete }, { session_id: 's2', athlete_id: athlete }, { session_id: 's1', athlete_id: 'other' }],
  });
  const data = await loadAthleteMonth(db, athlete, '2026-10');
  assert.deepEqual(data.sessions.map(s => s.id), ['s1']); assert.deepEqual(data.entries.map(e => e.id), ['r1']);
  assert.deepEqual(data.goals.map(g => g.id), ['g1']); assert.equal(data.feedback.length, 1);
  for (const c of db.calls) assert.deepEqual(c.filters[0], ['eq', 'athlete_id', athlete]);
  assert.deepEqual(db.calls.find(c => c.table === 'training_session_results').filters[1], ['in', 'session_id', ['s1']]);
});
test('monthly plans and logs paginate fully and feedback batches stay at 100 ids', async () => {
  const sessions = Array.from({ length: 1101 }, (_, i) => ({ id: 's' + i, athlete_id: athlete, session_date: '2026-12-01' }));
  const db = fake({ weekly_training_plan: sessions, trail_activity_log: Array.from({ length: 1001 }, (_, i) => ({ id: 'r' + i, athlete_id: athlete, activity_date: '2026-12-31' })), training_session_results: sessions.map(s => ({ session_id: s.id, athlete_id: athlete })) });
  const data = await loadAthleteMonth(db, athlete, '2026-12');
  assert.equal(data.sessions.length, 1101); assert.equal(data.entries.length, 1001); assert.equal(data.feedback.length, 1101);
  assert.equal(db.calls.filter(c => c.table === 'training_session_results').length, 12);
  for (const c of db.calls.filter(c => c.table === 'training_session_results')) assert.ok(c.filters[1][2].length <= 100);
});
test('empty months do not query feedback; query failure never becomes an empty successful overview', async () => {
  const db = fake(); const data = await loadAthleteMonth(db, athlete, '2026-10');
  assert.deepEqual(data, { sessions: [], entries: [], goals: [], feedback: [] });
  assert.equal(db.calls.some(c => c.table === 'training_session_results'), false);
  for (const table of ['weekly_training_plan', 'trail_activity_log', 'runner_goals']) await assert.rejects(loadAthleteMonth(fake({ [table]: new Error('offline') }), athlete, '2026-10'), /offline/);
});
test('roster pagination keeps all cards, stable ordering and unlinked account state', async () => {
  const db = fake({ deportistas: Array.from({ length: 1101 }, (_, i) => ({ id: 'd' + i, user_id: null })) });
  const data = await loadAthleteRoster(db); assert.equal(data.length, 1101); assert.equal(data.at(-1).user_id, null);
  assert.deepEqual(db.calls.map(c => c.range), [[0, 499], [500, 999], [1000, 1499]]);
  for (const c of db.calls) assert.deepEqual(c.orders, [['created_at', { ascending: false }], ['id']]);
});
test('invalid context never queries and plan links preserve runner and date', async () => {
  const db = fake();
  for (const args of [['', '2026-10'], [athlete, '2026-13'], [athlete, '1999-12']]) await assert.rejects(loadAthleteMonth(db, ...args));
  assert.equal(db.calls.length, 0);
  const url = new URL(athletePlanHref(athlete, '2026-10-27'), 'https://example.test');
  assert.equal(url.searchParams.get('athlete'), athlete); assert.equal(url.searchParams.get('date'), '2026-10-27');
});
