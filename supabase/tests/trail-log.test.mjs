import test from "node:test";
import assert from "node:assert/strict";
import { loadTrailMonth, trailRecord } from "../../lib/trail-log.ts";

const draft = { date: "2026-10-26", distance: "12.35", elevation: "450", duration: "92", effort: "", feelings: "  Buenas sensaciones  " };
const today = "2026-10-26";
const range = { start: "2026-10-01", end: "2026-11-01" };

function clientWithPages(pages) {
  const calls = [];
  let pageIndex = 0;
  const client = { from(table) {
    const call = { table, filters: [], orders: [] };
    calls.push(call);
    const query = {
      select(columns) { call.columns = columns; return query; },
      eq(...args) { call.filters.push(["eq", ...args]); return query; },
      gte(...args) { call.filters.push(["gte", ...args]); return query; },
      lt(...args) { call.filters.push(["lt", ...args]); return query; },
      order(...args) { call.orders.push(args); return query; },
      range(from, to) { call.range = [from, to]; const page = pages[pageIndex++]; if (page instanceof Error) return Promise.reject(page); return Promise.resolve(page ?? { data: [], error: null }); },
    };
    return query;
  } };
  return { client, calls };
}

test("monthly log loads more than 1000 records without truncating totals", async () => {
  const rows = Array.from({ length: 1101 }, (_, i) => ({ id: String(i), distance_km: 1 }));
  const { client, calls } = clientWithPages([0, 500, 1000].map(offset => ({ data: rows.slice(offset, offset + 500), error: null })));
  const result = await loadTrailMonth(client, "athlete-a", range);
  assert.deepEqual(result, rows);
  assert.deepEqual(calls.map(c => c.range), [[0, 499], [500, 999], [1000, 1499]]);
  for (const call of calls) {
    assert.equal(call.table, "trail_activity_log");
    assert.deepEqual(call.filters, [["eq", "athlete_id", "athlete-a"], ["gte", "activity_date", range.start], ["lt", "activity_date", range.end]]);
    assert.deepEqual(call.orders, [["activity_date", { ascending: false }], ["id", { ascending: false }]]);
  }
});
test("an exact full page is followed by an empty-page check", async () => {
  const { client, calls } = clientWithPages([{ data: Array(500).fill({ id: "test" }), error: null }]);
  assert.equal((await loadTrailMonth(client, "athlete-a", range)).length, 500);
  assert.equal(calls.length, 2);
});
test("empty history returns no fabricated rows", async () => {
  const { client, calls } = clientWithPages([]);
  assert.deepEqual(await loadTrailMonth(client, "athlete-a", range), []);
  assert.equal(calls.length, 1);
});
test("a later API error rejects the entire month instead of returning partial totals", async () => {
  const failure = { message: "unavailable" };
  const { client } = clientWithPages([{ data: Array(500).fill({ id: "test" }), error: null }, { data: null, error: failure }]);
  await assert.rejects(loadTrailMonth(client, "athlete-a", range), e => e === failure);
});
test("network errors propagate and missing identity never issues a query", async () => {
  const { client, calls } = clientWithPages([new Error("network")]);
  await assert.rejects(loadTrailMonth(client, "", range));
  assert.equal(calls.length, 0);
  await assert.rejects(loadTrailMonth(client, "athlete-a", range), /network/);
});
test("trail values preserve decimal distance and absent effort", () => {
  assert.deepEqual(trailRecord(draft, today), { activity_date: today, distance_km: 12.35, elevation_m: 450, duration_minutes: 92, effort: null, feelings: "Buenas sensaciones" });
});
test("zero distance and elevation are valid but blank numeric fields are rejected", () => {
  assert.equal(trailRecord({ ...draft, distance: "0", elevation: "0" }, today).distance_km, 0);
  for (const field of ["distance", "elevation", "duration"]) {
    for (const value of ["", " ", "NaN", "Infinity", "-1"]) assert.throws(() => trailRecord({ ...draft, [field]: value }, today));
  }
});
test("duration, elevation and effort require integers within the supported bounds", () => {
  for (const [field, values] of Object.entries({ distance: ["500.01"], elevation: ["30001", "1.5"], duration: ["0", "10081", "1.5"], effort: ["0", "11", "1.5", " "] })) {
    for (const value of values) assert.throws(() => trailRecord({ ...draft, [field]: value }, today));
  }
  assert.equal(trailRecord({ ...draft, effort: "10" }, today).effort, 10);
});
test("future and nonexistent calendar dates are rejected, valid leap days survive", () => {
  for (const date of ["", "2026-10-27", "2026-02-29", "2026-04-31", "2026-13-01", "1999-12-31", "2026-1-01"]) assert.throws(() => trailRecord({ ...draft, date }, today));
  assert.equal(trailRecord({ ...draft, date: "2024-02-29" }, today).activity_date, "2024-02-29");
});
test("editing validation trims notes without mutating the original draft", () => {
  const original = Object.freeze({ ...draft });
  assert.equal(trailRecord(original, today).feelings, "Buenas sensaciones");
  assert.equal(original.feelings, draft.feelings);
  assert.throws(() => trailRecord({ ...draft, feelings: "x".repeat(1001) }, today));
});
