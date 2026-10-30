import test from "node:test";
import assert from "node:assert/strict";
import { computePosition, nextPosition } from "../utils/position.js";

// Minimal stand-in for a Mongoose model: find().sort().select().lean()
const fakeModel = (positions) => ({
  find: (query) => {
    let items = positions.map((position, i) => ({ _id: String(i), position }));
    if (query._id?.$ne !== undefined) items = items.filter((x) => x._id !== query._id.$ne);
    items.sort((a, b) => a.position - b.position);
    return { sort: () => ({ select: () => ({ lean: async () => items }) }) };
  },
});

test("empty list starts at 1024", async () => {
  assert.equal(await computePosition(fakeModel([]), {}, 0), 1024);
});

test("moving to the top goes before the first item", async () => {
  assert.equal(await computePosition(fakeModel([1024, 2048]), {}, 0), 0);
});

test("moving to the end goes after the last item", async () => {
  assert.equal(await computePosition(fakeModel([1024, 2048]), {}, 2), 3072);
  assert.equal(await nextPosition(fakeModel([1024, 2048]), {}), 3072);
});

test("moving between two items lands in the middle", async () => {
  assert.equal(await computePosition(fakeModel([1024, 2048, 3072]), {}, 1), 1536);
});

test("the moved item is ignored when computing neighbours", async () => {
  // item "0" (position 1024) is moved to index 0 of the remaining [2048, 3072]
  assert.equal(await computePosition(fakeModel([1024, 2048, 3072]), {}, 0, "0"), 1024);
});

test("out of range or invalid index is clamped", async () => {
  assert.equal(await computePosition(fakeModel([1024, 2048]), {}, 99), 3072);
  assert.equal(await computePosition(fakeModel([1024, 2048]), {}, -5), 0);
  assert.equal(await computePosition(fakeModel([1024, 2048]), {}, Number.NaN), 0);
});