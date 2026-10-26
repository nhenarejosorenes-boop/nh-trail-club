import test from "node:test";
import assert from "node:assert/strict";
import { resolveMembershipAccess, membershipMonth } from "../../lib/membership-model.ts";

const at = new Date("2026-10-26T12:00:00Z");
const sub = (plan = "plus", status = "approved", id = "s") => ({ id, plan, status });
const due = (overrides = {}) => ({ subscription_id: "s", period_month: "2026-10-01", status: "paid", amount_eur: 60, ...overrides });
for (const [plan, premium] of [["basic", false], ["plus", true], ["plus_performance", true]]) {
  test(`paid ${plan} access matches server rules`, () => {
    assert.deepEqual(resolveMembershipAccess("athlete", [sub(plan)], [due()], at), { state: "active", plan, club: true, premium });
  });
}
for (const status of ["pending", "overdue", "waived"]) {
  test(`${status} is not a verified payment`, () => assert.equal(resolveMembershipAccess("athlete", [sub()], [due({ status })], at).state, "unpaid"));
}
for (const amount_eur of [0, -1, "invalid"]) {
  test(`invalid payment amount ${amount_eur} does not grant access`, () => assert.equal(resolveMembershipAccess("athlete", [sub()], [due({ amount_eur })], at).club, false));
}
test("pending approval stays pending even when a payment exists", () => assert.equal(resolveMembershipAccess("athlete", [sub("plus", "pending")], [due()], at).state, "pending"));
for (const status of ["cancelled", "rejected"]) {
  test(`${status} subscription does not grant access`, () => assert.equal(resolveMembershipAccess("athlete", [sub("plus", status)], [due()], at).state, "none"));
}
test("no request requires choosing a membership", () => assert.equal(resolveMembershipAccess("athlete", [], [], at).state, "none"));
test("last month's payment is not current", () => assert.equal(resolveMembershipAccess("athlete", [sub()], [due({ period_month: "2026-09-01" })], at).club, false));
test("another subscription's payment grants no access", () => assert.equal(resolveMembershipAccess("athlete", [sub()], [due({ subscription_id: "other" })], at).club, false));
test("an older paid approval is not masked by a newer unpaid approval", () => {
  const result = resolveMembershipAccess("athlete", [sub("basic", "approved", "new"), sub("plus")], [due()], at);
  assert.equal(result.plan, "plus");
});
test("the highest paid eligible plan wins irrespective of request order", () => {
  for (const requests of [[sub("basic"), sub("plus_performance", "approved", "p")], [sub("plus_performance", "approved", "p"), sub("basic")]]) {
    assert.equal(resolveMembershipAccess("athlete", requests, [due(), due({ subscription_id: "p" })], at).plan, "plus_performance");
  }
});
test("admin access is independent of subscription", () => assert.equal(resolveMembershipAccess("admin", [], [], at).premium, true));
test("a plan name inherited from Object grants no access", () => assert.equal(resolveMembershipAccess("athlete", [sub("toString")], [due()], at).club, false));
test("Madrid month boundary matches database access calendar", () => {
  const boundary = new Date("2026-10-31T23:30:00Z");
  assert.equal(membershipMonth(boundary), "2026-11-01");
  assert.equal(resolveMembershipAccess("athlete", [sub()], [due()], boundary).club, false);
  assert.equal(resolveMembershipAccess("athlete", [sub()], [due({ period_month: "2026-11-01" })], boundary).club, true);
});
