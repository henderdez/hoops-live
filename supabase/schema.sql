-- Hoops Live schema. Paste this whole file into Supabase -> SQL Editor -> Run.

create table if not exists games (
  id          uuid primary key,
  code        text unique not null,           -- short code viewers type or scan
  our_name    text not null,
  opp_name    text not null,
  status      text not null default 'live',   -- live | final
  period      int  not null default 1,        -- 1-4, 5 = OT, 6 = 2OT ...
  stream_url  text,
  players     jsonb not null default '[]',    -- [{id, team: 'us'|'opp', number, name}]
  starters    jsonb not null default '[]',    -- [player ids]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists events (
  id         uuid primary key,                -- generated on the scorer's device, so retries are safe
  game_id    uuid not null references games(id) on delete cascade,
  ts         bigint not null,                 -- ms timestamp, defines play order
  period     int  not null,
  team       text not null check (team in ('us', 'opp')),
  player_id  text,                            -- null = team / unknown player
  type       text not null,                   -- m2 x2 m3 x3 mft xft oreb dreb ast stl blk to foul sub
  meta       jsonb not null default '{}',     -- {grp} links an assist/rebound to its shot; subs use {in, out}
  deleted    boolean not null default false   -- undo = soft delete
);
create index if not exists events_game_ts on events (game_id, ts);

alter table games  enable row level security;
alter table events enable row level security;

-- Anyone with the link can read (that's how the gym follows along).
drop policy if exists "public read games"  on games;
drop policy if exists "public read events" on events;
create policy "public read games"  on games  for select using (true);
create policy "public read events" on events for select using (true);

-- Only signed-in users (you) can write.
drop policy if exists "scorer write games"  on games;
drop policy if exists "scorer write events" on events;
create policy "scorer write games"  on games  for all to authenticated using (true) with check (true);
create policy "scorer write events" on events for all to authenticated using (true) with check (true);

-- Push changes to viewers in real time.
alter publication supabase_realtime add table games, events;
