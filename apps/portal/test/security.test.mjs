import test from "node:test";
import assert from "node:assert/strict";
import { trustedOrigin, validDisplayName } from "../src/lib/security.mjs";

test("account mutations accept only the configured browser origin", () => {
  assert.equal(
    trustedOrigin("https://portal.example", "https://portal.example"),
    true,
  );
  for (const origin of [
    null,
    "null",
    "https://evil.example",
    "https://portal.example.evil",
    "https://portal.example/path",
    "https://portal.example\n",
    "https://portal.example\t",
    "//portal.example",
  ]) {
    assert.equal(
      trustedOrigin(origin, "https://portal.example"),
      false,
      String(origin),
    );
  }
  assert.equal(
    trustedOrigin("http://localhost:3000", "http://localhost:3000"),
    true,
  );
  assert.equal(
    trustedOrigin("http://localhost:3001", "http://localhost:3000"),
    false,
  );
});
test("profile names reject control characters and empty or oversized values", () => {
  assert.equal(validDisplayName("개발자"), true);
  for (const value of [
    "",
    "   ",
    "a".repeat(81),
    "name\nspoof",
    "\u0000",
    null,
  ])
    assert.equal(validDisplayName(value), false);
});
