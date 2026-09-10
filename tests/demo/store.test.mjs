import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, load, visiblePosts, KEY } from "../../js/hearth-store.js";
test("feed is chronological and respects topics and muted kin", () => {
  const s = seed(100000000);
  assert.deepEqual(
    visiblePosts(s).map((p) => p.id),
    ["p1", "p2", "p3"],
  );
  s.settings.topics = ["Outdoors"];
  assert.deepEqual(
    visiblePosts(s).map((p) => p.id),
    ["p2"],
  );
  s.muted = ["jamie"];
  assert.equal(visiblePosts(s).length, 0);
});
test("own private moments remain visible; others private moments never appear", () => {
  const s = seed();
  s.settings.topics = [];
  s.posts.push(
    { id: "own", person: "me", audience: "Only me", time: Date.now() },
    {
      id: "private",
      person: "ella",
      audience: "Only me",
      topic: "Little joys",
      time: Date.now(),
    },
  );
  assert.deepEqual(
    visiblePosts(s).map((p) => p.id),
    ["own"],
  );
});
test("inner circle and hidden filters apply", () => {
  const s = seed();
  assert.deepEqual(
    visiblePosts(s, "circle").map((p) => p.id),
    ["p1", "p2"],
  );
  s.hidden = ["p1"];
  assert.deepEqual(
    visiblePosts(s, "circle").map((p) => p.id),
    ["p2"],
  );
  assert.equal(visiblePosts(s, "mine").length, 0);
});
test("storage recovers from invalid and unavailable data", () => {
  for (const value of ["nope", "{}", "null"])
    assert.equal(load({ getItem: () => value }).error, true);
  assert.equal(
    load({
      getItem: () => {
        throw Error();
      },
    }).error,
    true,
  );
  assert.equal(load({ getItem: () => null }).error, false);
});
test("saved preferences and content survive a round trip", () => {
  const s = seed();
  s.name = "<img src=x onerror=alert(1)>";
  s.settings.ads = true;
  s.messages.ella.push({ text: "hello", mine: true, time: 123 });
  const loaded = load({
    getItem: (key) => (key === KEY ? JSON.stringify(s) : null),
  });
  assert.deepEqual(loaded.state, s);
  assert.equal(loaded.error, false);
});
