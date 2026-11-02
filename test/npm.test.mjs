import test from "node:test";
import assert from "node:assert/strict";
import { checkNpmPublicationEvent } from "../scripts/npm-check.mjs";

const release = { tag: "v0.1.0-alpha.3", commit: "a".repeat(40) };

test("npm dry runs may inspect a selected release from the main dispatch ref", () => {
  assert.doesNotThrow(() => checkNpmPublicationEvent(release, { publish: false, ref: "refs/heads/main", sha: "b".repeat(40) }));
});

test("actual npm publication binds the dispatched ref and SHA to the tested release", () => {
  assert.doesNotThrow(() => checkNpmPublicationEvent(release, { publish: true, ref: `refs/tags/${release.tag}`, sha: release.commit }));
  for (const event of [
    { ref: "refs/heads/main", sha: release.commit },
    { ref: `refs/tags/${release.tag}`, sha: "b".repeat(40) },
    { ref: "refs/tags/v0.1.0-alpha.2", sha: release.commit },
  ]) assert.throws(() => checkNpmPublicationEvent(release, { publish: true, ...event }), /provenance matches/);
  assert.throws(() => checkNpmPublicationEvent(release, { publish: "true" }), /must be boolean/);
});
