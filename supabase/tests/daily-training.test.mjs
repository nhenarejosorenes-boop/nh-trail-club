import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTraining, loadDailyTraining, madridWeekBounds, requestedEntry, sessionPlanHref, trailEntryHref } from '../../lib/daily-training.ts';
import { athleteToday } from '../../lib/training-progress.ts';
const today = '2026-10-27';
const session = (id, date, completed = false) => ({ id, session_date: date, category: 'trail', title: id, completed });
const entry = (id, date = today, effort = null, linked_session_id = null) => ({ id, activity_date: date, distance_km: '10', elevation_m: 300, duration_minutes: 60, effort, linked_session_id });
test('daily plan includes completed sessions today and picks the next pending future session by date then id', () => {
  const result = dailyTraining([session('past', '2026-10-26'), session('today', today, true), session('later', '2026-11-02'), session('done', '2026-10-28', true), session('b', '2026-10-29'), session('a', '2026-10-29'), session('outside', '2026-11-10')], [], today);
  assert.deepEqual(result.todaySessions.map(s => s.id), ['today']);
  assert.equal(result.next.id, 'a');
});
test('review totals cover exactly 30 calendar dates and overlapping issues do not duplicate records', () => {
  const result = dailyTraining([], [entry('both'), entry('no-rpe', '2026-10-26', null, 's'), entry('no-link', '2026-10-25', 5), entry('complete', '2026-10-24', 4, 's'), entry('first', '2026-09-28', null, 's'), entry('old', '2026-09-27'), entry('future', '2026-10-28')], today);
  assert.equal(result.start, '2026-09-28');
  assert.equal(result.missingEffort.length, 3);
  assert.equal(result.unlinked.length, 2);
  assert.deepEqual(result.toReview.map(e => e.id), ['both', 'no-rpe', 'no-link', 'first']);
  assert.equal(result.next, null);
});
test('week boundaries use Madrid calendar dates across midnight, DST and year transitions', () => {
  assert.equal(athleteToday(new Date('2026-10-25T23:30:00Z')), '2026-10-26');
  assert.deepEqual(madridWeekBounds('2026-10-26'), ['2026-10-26', '2026-11-02']);
  assert.deepEqual(madridWeekBounds('2027-01-03'), ['2026-12-28', '2027-01-04']);
  assert.throws(() => madridWeekBounds('2026-02-30'));
});
test('deep links retain session or entry identifiers and exact dates without changing account context', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const plan = new URL(sessionPlanHref(session(id, '2026-11-02')), 'https://example.test');
  assert.equal(plan.searchParams.get('session'), id);
  assert.equal(plan.searchParams.get('date'), '2026-11-02');
  assert.equal(plan.searchParams.has('athlete'), false);
  const log = new URL(trailEntryHref(entry(id, '2026-09-29')), 'https://example.test');
  assert.equal(requestedEntry(log.searchParams), id);
  assert.equal(log.searchParams.get('date'), '2026-09-29');
  for (const entry of ['../admin', id + ',id.eq.other', '', 'invalid']) assert.equal(requestedEntry(new URLSearchParams({ entry })), '');
});
function fake(tables) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select() { return q; }, eq(...a) { call.filters.push(['eq', ...a]); return q; }, gte(...a) { call.filters.push(['gte', ...a]); return q; }, lt(...a) { call.filters.push(['lt', ...a]); return q; }, order() { return q; }, range(from, to) {
      call.range = [from, to]; const rows = tables[table];
      return Promise.resolve(rows instanceof Error ? { data: null, error: rows } : { data: (rows ?? []).slice(from, to + 1), error: null });
    } }; return q;
  } };
}
test('all pages of plan and activity queries are owned and bounded, preserving more than 1000 records', async () => {
  const db = fake({ weekly_training_plan: Array.from({ length: 501 }, (_, i) => session('s' + i, today)), trail_activity_log: Array.from({ length: 1001 }, (_, i) => entry('r' + i)) });
  const result = await loadDailyTraining(db, 'runner-a', today, true);
  assert.equal(result.todaySessions.length, 501); assert.equal(result.missingEffort.length, 1001);
  for (const c of db.calls) {
    assert.deepEqual(c.filters[0], ['eq', 'athlete_id', 'runner-a']);
    assert.deepEqual(c.filters.slice(1), c.table === 'weekly_training_plan' ? [['gte', 'session_date', today], ['lt', 'session_date', '2026-11-10']] : [['gte', 'activity_date', '2026-09-28'], ['lt', 'activity_date', '2026-10-28']]);
  }
  assert.equal(db.calls.length, 5);
});
test('basic access never issues an individual plan query', async () => {
  const db = fake({ trail_activity_log: [entry('r1')] });
  const result = await loadDailyTraining(db, 'runner-a', today, false);
  assert.equal(db.calls.length, 1); assert.equal(db.calls[0].table, 'trail_activity_log');
  assert.equal(result.todaySessions.length, 0); assert.equal(result.toReview.length, 1);
});
test('a failed source rejects instead of announcing that there are no sessions or incomplete records', async () => {
  for (const table of ['weekly_training_plan', 'trail_activity_log']) await assert.rejects(loadDailyTraining(fake({ [table]: new Error('offline') }), 'runner-a', today, true), /offline/);
});
test('invalid dates or missing athlete never query', async () => {
  const db = fake({});
  await assert.rejects(loadDailyTraining(db, '', today, true));
  await assert.rejects(loadDailyTraining(db, 'runner-a', '2026-02-30', true));
  assert.equal(db.calls.length, 0);
});
