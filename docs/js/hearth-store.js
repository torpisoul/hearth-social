export const KEY = "hearth-demo-v1";
export const topics = [
  "Everyday life",
  "Little joys",
  "Outdoors",
  "Making things",
];
export function seed(now = Date.now()) {
  return {
    version: 1,
    name: "Alex",
    started: false,
    paused: false,
    settings: { quiet: true, dark: false, ads: false, topics: [...topics] },
    muted: [],
    hearts: [],
    hidden: [],
    read: [],
    posts: [
      {
        id: "p1",
        person: "ella",
        name: "Ella Thompson",
        content:
          "A small victory: the tomatoes we planted in April finally made it onto our plates. A little wonky, very sweet, and absolutely worth the wait. 🍅",
        topic: "Little joys",
        audience: "All kin",
        time: now - 3600000,
        art: true,
      },
      {
        id: "p2",
        person: "jamie",
        name: "Jamie Wilson",
        content:
          "Took the long way home with Dad this morning. No particular destination, just a flask of tea and a good catch-up. More of this, please.",
        topic: "Outdoors",
        audience: "Inner circle",
        time: now - 7200000,
      },
      {
        id: "p3",
        person: "sam",
        name: "Sam Patel",
        content:
          "Not a particularly easy week, but we made pancakes for dinner and that helped. Sending a little love to anyone who needs it today.",
        topic: "Everyday life",
        audience: "All kin",
        time: now - 18000000,
      },
    ],
    kin: [
      {
        id: "ella",
        name: "Ella Thompson",
        initials: "ET",
        note: "Finding joy in the everyday",
        circle: true,
        color: "rose",
      },
      {
        id: "jamie",
        name: "Jamie Wilson",
        initials: "JW",
        note: "Usually somewhere outside",
        circle: true,
        color: "sage",
      },
      {
        id: "sam",
        name: "Sam Patel",
        initials: "SP",
        note: "Making a little room for slow",
        circle: false,
        color: "blue",
      },
    ],
    messages: {
      ella: [
        {
          text: "I saved you a few tomatoes! Pop round for a cup of tea sometime this week?",
          mine: false,
          time: now - 3600000,
        },
      ],
      jamie: [
        {
          text: "It was so lovely to catch up at the weekend. Let’s do it again soon.",
          mine: false,
          time: now - 86400000,
        },
      ],
      sam: [],
    },
    events: [
      {
        id: "e1",
        title: "Sunday, slowly",
        date: new Date(now + 4 * 86400000).toISOString().slice(0, 10),
        time: "11:00",
        place: "Ella’s garden",
        note: "Tea, something homemade, and a little time together. Bring yourself.",
        going: false,
      },
    ],
    notifications: [
      {
        id: "n1",
        text: "Ella invited you to Sunday, slowly.",
        route: "gatherings",
      },
      { id: "n2", text: "Jamie joined your inner circle.", route: "kin" },
    ],
  };
}
export function valid(s) {
  return (
    s?.version === 1 &&
    typeof s.name === "string" &&
    s.settings &&
    Array.isArray(s.settings.topics) &&
    [
      "kin",
      "posts",
      "events",
      "notifications",
      "muted",
      "hearts",
      "hidden",
      "read",
    ].every((k) => Array.isArray(s[k])) &&
    s.messages &&
    typeof s.messages === "object"
  );
}
export function load(storage) {
  try {
    const value = storage.getItem(KEY);
    if (!value) return { state: seed(), error: false };
    const parsed = JSON.parse(value);
    if (!valid(parsed)) throw Error();
    return { state: parsed, error: false };
  } catch {
    return { state: seed(), error: true };
  }
}
export function visiblePosts(s, filter = "all") {
  return s.posts
    .filter(
      (p) =>
        !s.hidden.includes(p.id) &&
        (p.person === "me" ||
          (!s.muted.includes(p.person) &&
            s.settings.topics.includes(p.topic) &&
            p.audience !== "Only me")) &&
        (filter !== "circle" ||
          p.person === "me" ||
          s.kin.some((k) => k.id === p.person && k.circle)) &&
        (filter !== "mine" || p.person === "me"),
    )
    .sort((a, b) => b.time - a.time);
}
