create table if not exists flora_runs (
  user_id text not null,
  run_id text not null,
  title text not null,
  type_label text not null,
  status text not null,
  cost double precision,
  created_at timestamptz not null,
  snap jsonb not null,
  primary key (user_id, run_id)
);

create index if not exists flora_runs_user_created_idx on flora_runs (user_id, created_at desc);
