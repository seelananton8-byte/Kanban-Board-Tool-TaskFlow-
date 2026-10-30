import test from "node:test";
import assert from "node:assert/strict";
import { isEmail, str } from "../utils/validate.js";

test("str trims and accepts normal text", () => {
  assert.equal(str("  Hello  ", 10), "Hello");
});

test("str rejects empty, blank, too long and non-string values", () => {
  assert.equal(str("", 10), null);
  assert.equal(str("   ", 10), null);
  assert.equal(str("abcdefghijk", 10), null);
  assert.equal(str(42, 10), null);
  assert.equal(str({ $gt: "" }, 10), null); // NoSQL-injection style object
  assert.equal(str(["a"], 10), null);
});

test("isEmail accepts valid and rejects invalid addresses", () => {
  assert.equal(isEmail("a@b.com"), true);
  assert.equal(isEmail(" user@example.org "), true);
  assert.equal(isEmail("not-an-email"), false);
  assert.equal(isEmail("a@b"), false);
  assert.equal(isEmail("a b@c.com"), false);
  assert.equal(isEmail(null), false);
  assert.equal(isEmail({ $ne: "" }), false);
  assert.equal(isEmail("a@b.com".padEnd(300, "x")), false);
});