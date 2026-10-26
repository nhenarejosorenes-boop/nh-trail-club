import test from "node:test";
import assert from "node:assert/strict";
import { messageBody, mergeMessages, totalUnread, initialConversation } from "../../lib/messaging-model.ts";
import { loadInbox, loadMessagePage, loadMessageUpdates } from "../../lib/messaging-client.ts";
const message = seq => ({ id: "m" + seq, seq, athlete_id: "athlete-a", sender_id: "coach", body: "Test " + seq });

test("message validation trims content and preserves line breaks", () => assert.equal(messageBody("  Hola\nsegunda línea  "), "Hola\nsegunda línea"));
test("empty or oversized messages are rejected", () => { for (const value of ["", "  \n", "a".repeat(2001)]) assert.throws(() => messageBody(value)); });
test("Unicode messages use character limits consistently with the database", () => assert.equal(Array.from(messageBody("⛰".repeat(2000))).length, 2000));
test("message merging deduplicates retry and polling results in server sequence order", () => {
  const current = Object.freeze([Object.freeze(message(3)), Object.freeze(message(1))]);
  assert.deepEqual(mergeMessages(current, [message(2), message(3)]).map(m => m.seq), [1, 2, 3]);
  assert.deepEqual(current.map(m => m.seq), [3, 1]);
});
test("unread total spans all conversations, including those outside a search result", () => assert.equal(totalUnread([{ unread: 2 }, { unread: 0 }, { unread: 5 }]), 7));
const conversations = [{ athlete_id: "athlete-a" }, { athlete_id: "athlete-b" }];
test("clients always open their own conversation even with a foreign URL parameter", () => assert.equal(initialConversation(conversations, "athlete-b", "athlete-a", false), "athlete-a"));
test("coaches can open a known requested conversation and unknown IDs fall back safely", () => {
  assert.equal(initialConversation(conversations, "athlete-b", "coach", true), "athlete-b");
  assert.equal(initialConversation(conversations, "unknown", "coach", true), "athlete-a");
  assert.equal(initialConversation([], null, "coach", true), "");
});

function clientWithResponses(responses) {
  const calls = [];
  return { calls, client: { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const query = {
      select() { return query; }, eq(...args) { call.filters.push(["eq", ...args]); return query; },
      gt(...args) { call.filters.push(["gt", ...args]); return query; }, lt(...args) { call.filters.push(["lt", ...args]); return query; },
      order(...args) { call.order = args; return query; }, limit(value) { call.limit = value; return query; },
      then(resolve, reject) { const response = responses.shift(); return (response instanceof Error ? Promise.reject(response) : Promise.resolve(response ?? { data: [], error: null })).then(resolve, reject); },
    };
    return query;
  } } };
}
test("latest and older pages are scoped to the thread and displayed chronologically", async () => {
  const { client, calls } = clientWithResponses([{ data: [message(9), message(8)], error: null }]);
  assert.deepEqual((await loadMessagePage(client, "athlete-a", 10)).map(m => m.seq), [8, 9]);
  assert.deepEqual(calls[0].filters, [["eq", "athlete_id", "athlete-a"], ["lt", "seq", 10]]);
  assert.deepEqual(calls[0].order, ["seq", { ascending: false }]); assert.equal(calls[0].limit, 50);
});
test("updates paginate past 100 new messages without gaps", async () => {
  const rows = Array.from({ length: 201 }, (_, i) => message(i + 2));
  const { client, calls } = clientWithResponses([rows.slice(0, 100), rows.slice(100, 200), rows.slice(200)].map(data => ({ data, error: null })));
  assert.deepEqual(await loadMessageUpdates(client, "athlete-a", 1), rows);
  assert.deepEqual(calls.map(c => c.filters), [1, 101, 201].map(seq => [["eq", "athlete_id", "athlete-a"], ["gt", "seq", seq]]));
});
test("a later update error rejects partial data so the caller does not advance its cursor", async () => {
  const failure = { message: "offline" };
  const { client } = clientWithResponses([{ data: Array.from({ length: 100 }, (_, i) => message(i + 1)), error: null }, { data: null, error: failure }]);
  await assert.rejects(loadMessageUpdates(client, "athlete-a", 0), e => e === failure);
});
test("a non-advancing update page fails instead of looping", async () => {
  const { client } = clientWithResponses([{ data: Array(100).fill(message(1)), error: null }]);
  await assert.rejects(loadMessageUpdates(client, "athlete-a", 1));
});
test("missing thread never queries the database", async () => {
  const { client, calls } = clientWithResponses([]);
  await assert.rejects(loadMessagePage(client, "")); await assert.rejects(loadMessageUpdates(client, "", 0)); assert.equal(calls.length, 0);
});
test("inbox failures never become a false zero unread count", async () => {
  const failure = { message: "offline" };
  await assert.rejects(loadInbox({ rpc: async () => ({ error: failure, data: null }) }), e => e === failure);
  await assert.rejects(loadInbox({ rpc: async () => ({ error: null, data: null }) }));
  assert.deepEqual(await loadInbox({ rpc: async () => ({ error: null, data: [] }) }), []);
});
