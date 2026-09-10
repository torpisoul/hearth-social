import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  c = "00000000-0000-4000-8000-000000000003";
async function as(id, sql, args = []) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  return (await db.query(sql, args)).rows;
}
before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}'),('${b}'),('${c}');`,
  );
  const files = (
    await readdir(new URL("../../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files)
    await db.exec(
      await readFile(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  for (const [id, n] of [
    [a, "Alice"],
    [b, "Bob"],
    [c, "Carol"],
  ])
    await as(id, "insert into public.hearth_profiles(id,name) values($1,$2)", [
      id,
      n,
    ]);
});
after(async () => {
  await db.close();
});
test("feedback is private, cannot impersonate another author, and limits repeated submissions", async () => {
  await as(a, "insert into hearth_feedback(content) values('A little idea')");
  assert.equal((await as(a, "select * from hearth_feedback")).length, 1);
  assert.equal((await as(b, "select * from hearth_feedback")).length, 0);
  await assert.rejects(as(b, "insert into hearth_feedback(author,content) values($1,'forged')", [a]), /permission denied/);
  await assert.rejects(as(a, "insert into hearth_feedback(content) values('   ')"), /check constraint/);
  await assert.rejects(as(a, "insert into hearth_feedback(content) values(repeat('a',2001))"), /check constraint/);
  await as(a, "insert into hearth_feedback(content) select 'More thoughts' from generate_series(1,4)");
  await assert.rejects(as(a, "insert into hearth_feedback(content) values('Too soon')"), /Come back/);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select * from hearth_feedback"), /permission denied/);
  await assert.rejects(db.query("insert into hearth_feedback(content) values('anonymous')"), /permission denied/);
});
test("topic preferences are private and start with every category off", async () => {
 await as(a, "insert into hearth_preferences(owner) values($1)", [a]);
 assert.deepEqual((await as(a, "select topics from hearth_preferences"))[0].topics, []);
 assert.equal((await as(b, "select * from hearth_preferences")).length, 0);
 await assert.rejects(as(b,"insert into hearth_preferences(owner) values($1)",[a]), /row-level security/);
 await assert.rejects(as(a,"update hearth_preferences set topics=array['unexpected']"), /check constraint/);
});
test("profile pictures can be changed only by their owner", async () => {
 await as(a,"update hearth_profiles set avatar='data:image/png;base64,aGVsbG8=' where id=$1",[a]);
 assert.equal((await as(a,"select avatar from hearth_profiles where id=$1",[a]))[0].avatar,'data:image/png;base64,aGVsbG8=');
 assert.equal((await as(b,"update hearth_profiles set avatar=null where id=$1 returning id",[a])).length,0);
 await assert.rejects(as(a,"update hearth_profiles set avatar='https://tracker.example/pixel' where id=$1",[a]),/check constraint/);
});
test("anonymous users cannot access data or privileged friend RPCs", async () => {
  await db.exec("reset role;set role anon");
  await assert.rejects(
    db.query("select * from hearth_profiles"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select hearth_request_friend($1)", [a]),
    /permission denied/,
  );
});
test("outsiders cannot enumerate profiles, impersonate users or read private statuses", async () => {
  await as(
    a,
    "insert into hearth_statuses(author,content,audience,topic) values($1,'private','Only me','Everyday life'),($1,'kin','All kin','Everyday life'),($1,'circle','Inner circle','Everyday life')",
    [a],
  );
  assert.equal((await as(b, "select * from hearth_statuses")).length, 0);
  assert.equal((await as(b, "select * from hearth_profiles")).length, 1);
  await assert.rejects(
    as(
      b,
      "insert into hearth_statuses(author,content,topic) values($1,'forged','Little joys')",
      [a],
    ),
    /row-level security|Not authorized/,
  );
  await assert.rejects(
    as(b, "update hearth_profiles set id=$1 where id=$2", [a, b]),
    /permission denied/,
  );
});
test("requests require the recipient to accept before sharing", async () => {
  await as(a, "select hearth_request_friend($1)", [b]);
  assert.equal((await as(b, "select * from hearth_profiles")).length, 2);
  assert.equal((await as(b, "select * from hearth_statuses")).length, 0);
  await assert.rejects(
    as(a, "select hearth_accept_friend($1)", [b]),
    /Request not found/,
  );
  await assert.rejects(
    as(c, "select hearth_accept_friend($1)", [a]),
    /Request not found/,
  );
  await as(b, "select hearth_accept_friend($1)", [a]);
  assert.deepEqual(
    (await as(b, "select content from hearth_statuses")).map((r) => r.content),
    ["kin"],
  );
});
test("gatherings and RSVPs are visible only to the host and connected kin", async () => {
 const [event] = await as(a,"insert into hearth_events(title,place,starts_at) values('A walk','The park',now()+interval '1 day') returning id");
 assert.equal((await as(b,"select * from hearth_events")).length,1);
 assert.equal((await as(c,"select * from hearth_events")).length,0);
 await as(b,"insert into hearth_rsvps(event) values($1)",[event.id]);
 assert.equal((await as(a,"select * from hearth_rsvps")).length,1);
 assert.equal((await as(c,"select * from hearth_rsvps")).length,0);
 await assert.rejects(as(c,"insert into hearth_rsvps(event) values($1)",[event.id]),/row-level security/);
 assert.equal((await as(b,"delete from hearth_events where id=$1 returning id",[event.id])).length,0);
 await as(a,"insert into hearth_blocks(owner,target) values($1,$2)",[a,b]);
 assert.equal((await as(b,"select * from hearth_events")).length,0);
 assert.equal((await as(b,"select * from hearth_rsvps")).length,0);
 await as(a,"delete from hearth_blocks where owner=$1 and target=$2",[a,b]);
 await as(a,"delete from hearth_events where id=$1",[event.id]);
});
test("waiting notes allow only connected participants and reject forged senders", async () => {
 const id='00000000-0000-4000-9000-000000000999';
 await as(a,"insert into hearth_waiting_notes(id,sender,recipient,version,iv,ciphertext) values($1,$2,$3,1,repeat('a',16),repeat('b',30))",[id,a,b]);
 assert.equal((await as(b,"select * from hearth_waiting_notes")).length,1);
 assert.equal((await as(c,"select * from hearth_waiting_notes")).length,0);
 await assert.rejects(as(c,"insert into hearth_waiting_notes(id,sender,recipient,version,iv,ciphertext) values(gen_random_uuid(),$1,$2,1,repeat('a',16),repeat('b',30))",[a,b]),/row-level security/);
 assert.equal((await as(b,"delete from hearth_waiting_notes returning id")).length,0);
 await as(a,"delete from hearth_waiting_notes where id=$1",[id]);
});
test("inner-circle access is controlled by author, not reader", async () => {
  await as(b, "insert into hearth_circle values($1,$2)", [b, a]);
  assert.equal((await as(b, "select * from hearth_statuses")).length, 1);
  await as(a, "insert into hearth_circle values($1,$2)", [a, b]);
  assert.equal((await as(b, "select * from hearth_statuses")).length, 2);
  await assert.rejects(
    as(c, "insert into hearth_circle values($1,$2)", [a, c]),
    /row-level security/,
  );
  assert.equal(
    (
      await as(b, "delete from hearth_statuses where author=$1 returning id", [
        a,
      ])
    ).length,
    0,
  );
});
test("private key vaults stay private; published keys cannot be replaced", async () => {
  const key = { kty: "EC", crv: "P-256", x: "x".repeat(43), y: "y".repeat(43) };
  const vault = {
    version: 1,
    salt: "s".repeat(24),
    iv: "i".repeat(16),
    ciphertext: "c".repeat(200),
  };
  await as(
    a,
    "insert into hearth_keys(owner,public_key,vault) values($1,$2,$3)",
    [a, key, vault],
  );
  assert.deepEqual(
    (await as(a, "select hearth_my_vault() as vault"))[0].vault,
    vault,
  );
  assert.equal(
    (await as(b, "select hearth_my_vault() as vault"))[0].vault,
    null,
  );
  assert.deepEqual(
    (await as(b, "select hearth_public_key($1) as key", [a]))[0].key,
    key,
  );
  assert.equal(
    (await as(c, "select hearth_public_key($1) as key", [a]))[0].key,
    null,
  );
  await assert.rejects(as(b, "select * from hearth_keys"), /permission denied/);
  await assert.rejects(
    as(a, "update hearth_keys set public_key=$1 where owner=$2", [key, a]),
    /permission denied/,
  );
  await assert.rejects(
    as(b, "insert into hearth_keys(owner,public_key,vault) values($1,$2,$3)", [
      b,
      { ...key, d: "secret" },
      vault,
    ]),
    /check constraint/,
  );
});
test("only conversation participants can read messages; forged senders rejected", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  await as(
    a,
    "insert into hearth_messages(id,sender,recipient,ciphertext,iv) values($1,$2,$3,repeat('X',24),repeat('A',16))",
    [id, a, b],
  );
  assert.equal((await as(b, "select * from hearth_messages")).length, 1);
  assert.equal((await as(c, "select * from hearth_messages")).length, 0);
  await assert.rejects(
    as(
      c,
      "insert into hearth_messages(id,sender,recipient,ciphertext,iv) values(gen_random_uuid(),$1,$2,repeat('X',24),repeat('A',16))",
      [a, b],
    ),
    /row-level security|Not authorized/,
  );
});
test("blocks stop sharing and new messages, keeping already delivered history", async () => {
  await as(b, "insert into hearth_blocks(owner,target) values($1,$2)", [b, a]);
  assert.equal((await as(b, "select * from hearth_statuses")).length, 0);
  assert.equal((await as(a, "select * from hearth_connections")).length, 0);
  await assert.rejects(
    as(
      a,
      "insert into hearth_messages(id,sender,recipient,ciphertext,iv) values(gen_random_uuid(),$1,$2,repeat('X',24),repeat('A',16))",
      [a, b],
    ),
    /row-level security/,
  );
  await assert.rejects(
    as(a, "select hearth_request_friend($1)", [b]),
    /Unable/,
  );
  assert.equal((await as(b, "select * from hearth_messages")).length, 1);
});
test("malformed key documents are rejected, including absent required fields", async () => {
  await assert.rejects(
    as(
      c,
      "insert into hearth_keys(owner,public_key,vault) values($1,'{}','{}')",
      [c],
    ),
    /check constraint/,
  );
});
test("server timestamps and status rate limits cannot be bypassed with supplied dates", async () => {
  for (let i = 0; i < 30; i++)
    await as(
      c,
      "insert into hearth_statuses(author,content,topic,created_at) values($1,'moment','Everyday life','2000-01-01')",
      [c],
    );
  const rows = await as(c, "select created_at from hearth_statuses");
  assert.equal(rows.length, 30);
  assert.ok(new Date(rows[0].created_at).getFullYear() > 2020);
  await assert.rejects(
    as(
      c,
      "insert into hearth_statuses(author,content,topic) values($1,'extra','Everyday life')",
      [c],
    ),
    /Please wait/,
  );
});
test("all exposed tables have RLS; public API functions are invoker functions", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and relname like 'hearth_%' ",
    )
  ).rows;
  assert.equal(rows.length, 12);
  assert.ok(rows.every((r) => r.relrowsecurity));
  assert.equal(
    (
      await db.query(
        "select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and prosecdef",
      )
    ).rows.length,
    0,
  );
});

test("account deletion removes sessions and owned data; old tokens cannot restore the profile", async () => {
  await db.exec("reset role");
  await db.query("insert into auth.sessions values(gen_random_uuid(),$1)", [c]);
  await as(c, "insert into hearth_feedback(content) values('Goodbye note')");
  await as(c, "select hearth_delete_account()");
  assert.equal((await as(c, "select * from hearth_feedback")).length, 0);
  assert.equal((await as(c, "select * from hearth_profiles")).length, 0);
  await assert.rejects(
    as(c, "insert into hearth_profiles(id,name) values($1,'return')", [c]),
    /foreign key/,
  );
  await db.exec("reset role");
  assert.equal(
    (await db.query("select * from auth.sessions where user_id=$1", [c])).rows
      .length,
    0,
  );
});
