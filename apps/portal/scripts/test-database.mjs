import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Actual PostgreSQL execution. auth.users/auth.sessions/auth.uid/auth.jwt are a
// small fixture, not a mock of PostgreSQL RLS. Hosted email/GoTrue are not tested.
const container = `skillwhy-portal-db-${randomUUID().slice(0, 8)}`;
const image =
  process.env.PORTAL_TEST_POSTGRES_IMAGE || "postgres:17.11-bookworm";
function command(args, input) {
  const result = spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || "Docker command failed");
  return result.stdout.trim();
}
function sql(input) {
  return command(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-A",
      "-t",
    ],
    input,
  );
}
const admin = "10000000-0000-0000-0000-000000000001",
  a = "10000000-0000-0000-0000-000000000002",
  b = "10000000-0000-0000-0000-000000000003";
const session = (id) => id.replace("10000000", "20000000");
function as(id, body, extra = {}) {
  return sql(
    `begin; set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, session_id: session(id), ...extra })}', true); ${body}; rollback;`,
  );
}
const assertion = (condition) =>
  `do $$ begin if not (${condition}) then raise exception 'ASSERTION_FAILED'; end if; end $$`;
const forbidden = (query) =>
  `do $$ begin begin ${query}; raise exception 'EXPECTED_DENIAL'; exception when insufficient_privilege then null; end; end $$`;
const zeroUpdates = (query) =>
  `do $$ declare affected integer; begin ${query}; get diagnostics affected = row_count; if affected <> 0 then raise exception 'UNEXPECTED_ROWS_UPDATED'; end if; end $$`;
const invalid = (query) =>
  `do $$ begin begin ${query}; raise exception 'EXPECTED_INVALID_ARGUMENT'; exception when invalid_parameter_value then null; end; end $$`;
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
try {
  command([
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "--network",
    "none",
    "-e",
    `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`,
    image,
  ]);
  for (let n = 0; n < 60; n++) {
    const r = spawnSync(
      "docker",
      ["exec", container, "pg_isready", "-U", "postgres"],
      { encoding: "utf8" },
    );
    if (r.status === 0) break;
    if (n === 59) throw new Error("Postgres did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  sql(`create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.jwt(),auth.uid() to authenticated;`);
  const migration = readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).find((name) => name.endsWith("_portal_members.sql"));
  if (!migration) throw new Error("Portal migration missing");
  sql(
    readFileSync(
      new URL("../supabase/migrations/" + migration, import.meta.url),
      "utf8",
    ),
  );
  sql(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${admin}','admin@example.invalid','{"display_name":"Admin"}'),
    ('${a}','member-a@example.invalid','{"display_name":"A"}'),
    ('${b}','member-b@example.invalid','{"display_name":"B","role":"admin","status":"active"}');
    update public.member_profiles set role='admin' where id='${admin}';
    insert into auth.sessions(id,user_id) values ('${session(admin)}','${admin}'),('${session(a)}','${a}'),('${session(b)}','${b}');`);
  check("registration trigger ignores user-editable role metadata", () =>
    sql(
      assertion(
        `(select role='member' from public.member_profiles where id='${b}')`,
      ),
    ),
  );
  check(
    "anonymous cannot select member data or invoke administrative RPC",
    () =>
      sql(
        `begin;set local role anon;${forbidden("perform * from public.member_profiles")};${forbidden(`perform public.portal_set_member_status('${a}','suspended')`)};rollback;`,
      ),
  );
  check("member sees own profile but not another member or audit history", () =>
    as(
      a,
      `${assertion("(select count(*)=1 from public.member_profiles)")};${assertion("(select count(*)=0 from public.member_audit_events)")}`,
    ),
  );
  check(
    "member can edit own display name and cannot edit protected columns",
    () =>
      as(
        a,
        `update public.member_profiles set display_name='Changed' where id='${a}';${assertion(`(select display_name='Changed' from public.member_profiles where id='${a}')`)};${forbidden(`update public.member_profiles set role='admin' where id='${a}'`)};${forbidden(`update public.member_profiles set status='active' where id='${a}'`)}`,
      ),
  );
  check(
    "member cannot reassign identity, create profiles, or call admin RPC",
    () =>
      as(
        a,
        `${forbidden(`update public.member_profiles set id='${b}' where id='${a}'`)};${forbidden(`insert into public.member_profiles(id,email) values(gen_random_uuid(),'x@example.invalid')`)};${forbidden(`perform public.portal_set_member_status('${b}','suspended')`)}`,
      ),
  );
  check("member cannot edit another profile through an allowed column", () =>
    as(
      a,
      `${zeroUpdates("update public.member_profiles set display_name='Hijack' where id='" + b + "'")};${assertion("(select count(*)=1 from public.member_profiles)")}`,
    ),
  );
  check("administrator can inspect members and cannot suspend self", () =>
    as(
      admin,
      `${assertion("(select count(*)=3 from public.member_profiles)")};${invalid(`perform public.portal_set_member_status('${admin}','suspended')`)}`,
    ),
  );
  sql(
    `begin; set local role authenticated; select set_config('request.jwt.claims','${JSON.stringify({ sub: admin, session_id: session(admin) })}',true); select public.portal_set_member_status('${b}','suspended'); commit;`,
  );
  check(
    "suspension blocks existing JWT profile access and writes immediately",
    () =>
      as(
        b,
        `${assertion("(select count(*)=0 from public.member_profiles)")};${zeroUpdates("update public.member_profiles set display_name='Bypass' where id='" + b + "'")};${forbidden(`perform public.portal_set_member_status('${a}','suspended')`)}`,
      ),
  );
  check(
    "suspended member can still submit one idempotent deletion request",
    () =>
      as(
        b,
        `select public.portal_request_account_deletion('Please review');select public.portal_request_account_deletion('Again');${assertion("(select count(*)=1 from public.account_deletion_requests)")};${forbidden("perform public.portal_review_account_deletion((select id from public.account_deletion_requests limit 1))")}`,
      ),
  );
  check(
    "revoked session cannot see profiles or request deletion using old JWT",
    () => {
      sql(`delete from auth.sessions where user_id='${a}'`);
      as(
        a,
        `${assertion("(select count(*)=0 from public.member_profiles)")};${forbidden("perform public.portal_request_account_deletion('stale')")}`,
      );
    },
  );
  check("anonymous-auth JWT cannot access portal even with a profile", () =>
    as(
      admin,
      `${assertion("(select count(*)=0 from public.member_profiles)")};${forbidden("perform public.portal_request_account_deletion('anonymous')")}`,
      { is_anonymous: true },
    ),
  );
  check("timeboxed expired session cannot access portal", () => {
    sql(
      `update auth.sessions set not_after=now()-interval '1 minute' where user_id='${admin}'`,
    );
    as(
      admin,
      `${assertion("(select count(*)=0 from public.member_profiles)")};${forbidden(`perform public.portal_set_member_status('${b}','active')`)}`,
    );
    sql(`update auth.sessions set not_after=null where user_id='${admin}'`);
  });
  check("audit records cannot be inserted or altered by administrator", () =>
    as(
      admin,
      `${forbidden("insert into public.member_audit_events(action) values('profile_updated')")};${forbidden("delete from public.member_audit_events")}`,
    ),
  );
  check(
    "deletion review updates request without deleting the auth identity",
    () => {
      sql(
        `insert into public.account_deletion_requests(user_id,reason) values('${b}','Test review');`,
      );
      as(
        admin,
        `select public.portal_review_account_deletion((select id from public.account_deletion_requests where user_id='${b}' limit 1));${assertion(`(select status='reviewed' from public.account_deletion_requests where user_id='${b}' limit 1)`)}`,
      );
      sql(assertion(`(select count(*)=1 from auth.users where id='${b}')`));
    },
  );
  const badFunctions = sql(
    `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef;`,
  );
  if (badFunctions !== "0")
    throw new Error("Exposed SECURITY DEFINER function found");
  console.log(
    JSON.stringify({
      checks,
      postgres: image,
      rlsExecuted: true,
      hostedAuthOrEmailTested: false,
    }),
  );
} finally {
  spawnSync("docker", ["rm", "--force", container], { encoding: "utf8" });
}
