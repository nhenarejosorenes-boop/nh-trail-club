import test from "node:test";
import assert from "node:assert/strict";
import { athleteToday, monthRange, trainingProgress } from "../../lib/training-progress.ts";

const session = (date, completed = false, category = "trail") => ({ id: date, session_date: date, completed, category, title: "Test" });
const run = (date, overrides = {}) => ({ id: date, activity_date: date, distance_km: 10, elevation_m: 200, duration_minutes: 60, effort: 5, ...overrides });
const calculate = (sessions = [], entries = []) => trainingProgress(sessions, entries, "2026-10", "2026-10-26");

test("month bounds cross the year boundary", () => assert.deepEqual(monthRange("2026-12"), { start: "2026-12-01", end: "2027-01-01" }));
test("leap-year February retains the leap day", () => {
  assert.deepEqual(monthRange("2028-02"), { start: "2028-02-01", end: "2028-03-01" });
  assert.equal(trainingProgress([], [run("2028-02-29")], "2028-02", "2028-03-01").runs, 1);
});
test("six-week calendar months do not lose the final days", () => {
  const result = trainingProgress([], [run("2026-03-31")], "2026-03", "2026-04-01");
  assert.equal(result.weeks.length, 6); assert.equal(result.weeks.at(-1).start, "2026-03-30"); assert.equal(result.weeks.at(-1).km, 10);
});
test("records outside the selected month are excluded from all totals", () => {
  const p = calculate([session("2026-09-30", true), session("2026-10-01", true), session("2026-11-01")], [run("2026-09-30"), run("2026-10-01"), run("2026-11-01")]);
  assert.equal(p.planned, 1); assert.equal(p.completed, 1); assert.equal(p.km, 10); assert.equal(p.runs, 1);
});
test("overdue, today's and future sessions are distinct", () => {
  const p = calculate([session("2026-10-20"), session("2026-10-26"), session("2026-10-27"), session("2026-10-25", true)]);
  assert.equal(p.planned, 4); assert.equal(p.completed, 1); assert.equal(p.completion, 25); assert.equal(p.overdue, 1); assert.equal(p.upcoming, 2);
});
test("missing effort does not count as zero effort or reduce the average", () => {
  const p = calculate([], [run("2026-10-01"), run("2026-10-02", { effort: null, duration_minutes: 30 })]);
  assert.equal(p.averageEffort, 5); assert.equal(p.load, 300); assert.equal(p.minutes, 90); assert.equal(p.missingEffort, 1);
});
test("numeric API strings are summed numerically", () => {
  const p = calculate([], [run("2026-10-01", { distance_km: "2.5" }), run("2026-10-02", { distance_km: "7.25" })]);
  assert.equal(p.km, 9.75); assert.equal(p.elevation, 400); assert.equal(p.runs, 2);
});
test("calendar weeks start on Monday and include only the selected month's days", () => {
  const p = calculate([], [run("2026-09-30"), run("2026-10-01", { distance_km: 3 }), run("2026-10-05", { distance_km: 7 })]);
  assert.equal(p.weeks[0].start, "2026-09-28"); assert.equal(p.weeks[0].km, 3); assert.equal(p.weeks[1].start, "2026-10-05"); assert.equal(p.weeks[1].km, 7);
});
test("empty data has finite totals and no invented average", () => {
  const p = calculate(); assert.equal(p.completion, 0); assert.equal(p.averageEffort, null); assert.equal(p.load, 0); assert.equal(p.km, 0);
});
test("category completion uses only selected-month sessions", () => {
  const p = calculate([session("2026-09-30", true, "fuerza"), session("2026-10-01", true, "fuerza"), session("2026-10-02", false, "fuerza"), session("2026-10-03", true, "movilidad")]);
  assert.deepEqual(p.categories.find(c => c.category === "fuerza"), { category: "fuerza", planned: 2, completed: 1 });
  assert.equal(p.categories.find(c => c.category === "movilidad").completed, 1);
});
test("Madrid local date is used around UTC midnight", () => assert.equal(athleteToday(new Date("2026-10-31T23:30:00Z")), "2026-11-01"));
test("invalid calendar months are rejected", () => { for (const month of ["", "2026-13", "2026-00", "2026-1", "text"]) assert.throws(() => monthRange(month)); });
test("calculating progress does not mutate stored records", () => {
  const sessions = Object.freeze([Object.freeze(session("2026-10-01", true))]);
  const entries = Object.freeze([Object.freeze(run("2026-10-01"))]);
  assert.equal(calculate(sessions, entries).completed, 1); assert.equal(entries[0].distance_km, 10);
});
