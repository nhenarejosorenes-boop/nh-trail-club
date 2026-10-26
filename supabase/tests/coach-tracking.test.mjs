import test from "node:test";
import assert from "node:assert/strict";
import { loadCoachAthletes, loadCoachMonth, plannerContext } from "../../lib/coach-tracking.ts";

function fakeClient(tables) {
  const calls = [];
  return { calls, client: { from(table) {
    const call = { table, filters: [], orders: [] };
    calls.push(call);
    const query = {
      select(columns) { call.columns = columns; return query; },
      gte(...args) { call.filters.push(["gte", ...args]); return query; },
      lt(...args) { call.filters.push(["lt", ...args]); return query; },
      order(...args) { call.orders.push(args); return query; },
      range(from, to) {
        call.range = [from, to];
        const source = tables[table];
        if (source instanceof Error) return Promise.reject(source);
        if (source?.error) return Promise.resolve({ data: null, error: source.error });
        return Promise.resolve({ data: (source ?? []).slice(from, to + 1), error: null });
      },
    };
    return query;
  } } };
}

test("coach loads all monthly runs and plans with date filters on every page", async () => {
  const logs = Array.from({ length: 1101 }, (_, i) => ({ id: "log-" + i, athlete_id: "a" }));
  const plans = Array.from({ length: 501 }, (_, i) => ({ id: "plan-" + i, athlete_id: "a" }));
  const { client, calls } = fakeClient({ trail_activity_log: logs, weekly_training_plan: plans });
  assert.deepEqual(await loadCoachMonth(client, { start: "2026-12-01", end: "2027-01-01" }), { logs, plans });
  for (const call of calls) {
    const column = call.table === "trail_activity_log" ? "activity_date" : "session_date";
    assert.deepEqual(call.filters, [["gte", column, "2026-12-01"], ["lt", column, "2027-01-01"]]);
    assert.deepEqual(call.orders, [[column, { ascending: false }], ["id"]]);
  }
  assert.deepEqual(calls.filter(c => c.table === "trail_activity_log").map(c => c.range), [[0, 499], [500, 999], [1000, 1499]]);
});
test("empty months return empty data for both sources", async () => {
  const { client } = fakeClient({});
  assert.deepEqual(await loadCoachMonth(client, { start: "2026-10-01", end: "2026-11-01" }), { logs: [], plans: [] });
});
test("a failed plan load rejects the entire month instead of presenting partial metrics", async () => {
  const failure = { message: "unavailable" };
  const { client } = fakeClient({ trail_activity_log: [{ id: "log" }], weekly_training_plan: { error: failure } });
  await assert.rejects(loadCoachMonth(client, { start: "2026-10-01", end: "2026-11-01" }), e => e === failure);
});
test("athlete choices are fully paginated and consistently ordered", async () => {
  const athletes = Array.from({ length: 1001 }, (_, i) => ({ id: "a-" + i, nombre: "Corredor", user_id: null }));
  const { client, calls } = fakeClient({ deportistas: athletes });
  assert.deepEqual(await loadCoachAthletes(client), athletes);
  assert.equal(calls.length, 3);
  for (const call of calls) assert.deepEqual(call.orders, [["nombre"], ["id"]]);
});
test("network failures do not turn into empty athlete lists", async () => {
  const { client } = fakeClient({ deportistas: new Error("network") });
  await assert.rejects(loadCoachAthletes(client), /network/);
});
const athletes = [{ user_id: "runner-a" }, { user_id: null }, { user_id: "runner-b" }];
test("planner links choose a known linked runner and Monday of the requested date", () => {
  assert.deepEqual(plannerContext(athletes, "coach", "runner-b", "2026-10-29"), { athleteId: "runner-b", week: "2026-10-26" });
});
test("planner links handle Sunday, leap days and year boundaries", () => {
  assert.equal(plannerContext(athletes, "coach", "runner-a", "2027-01-03").week, "2026-12-28");
  assert.equal(plannerContext(athletes, "coach", "runner-a", "2024-02-29").week, "2024-02-26");
});
test("unknown or missing requested runners fall back to the signed-in coach", () => {
  for (const id of [null, "", "unknown", "../runner-a"]) assert.equal(plannerContext(athletes, "coach", id, null).athleteId, "coach");
});
test("invalid planner dates are ignored instead of rolling into another month", () => {
  for (const date of [null, "", "2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "1999-12-31", "2101-01-01", "2026-10-26T00:00:00Z"]) assert.equal(plannerContext(athletes, "coach", "runner-a", date).week, null);
});
