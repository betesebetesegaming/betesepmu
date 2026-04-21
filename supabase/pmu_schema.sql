-- PMU-style Pari-Mutuel payout schema
-- Run this in Supabase SQL editor.

create table if not exists bets (
  id text primary key,
  race_id text not null,
  bet_type text not null,
  selection int[] not null,
  stake numeric(12,2) not null check (stake > 0),
  units int not null default 1 check (units > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_bets_race_type on bets (race_id, bet_type);

create table if not exists results (
  race_id text primary key,
  positions int[] not null,
  updated_at timestamptz not null default now()
);

create table if not exists config (
  bet_type text primary key,
  is_enabled boolean not null default true,
  calculation_mode text not null default 'automatic' check (calculation_mode in ('automatic','manual')),
  payout_percentage numeric(5,4) not null check (payout_percentage > 0 and payout_percentage <= 1),
  split_rules jsonb not null default '{"main":1}'::jsonb,
  jackpot_enabled boolean not null default true,
  minimum_dividend numeric(12,2) not null default 20,
  rounding_base numeric(12,2) not null default 5,
  updated_at timestamptz not null default now()
);

create table if not exists payouts (
  id bigserial primary key,
  race_id text not null,
  bet_type text not null,
  level text not null,
  pool numeric(14,4) not null,
  winners numeric(14,4) not null default 0,
  winner_tickets int not null default 0,
  dividend numeric(14,4),
  carry_in numeric(14,4) not null default 0,
  carry_out numeric(14,4) not null default 0,
  manual_dividend numeric(14,4),
  calculation_mode text not null default 'automatic' check (calculation_mode in ('automatic','manual')),
  is_overridden boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (race_id, bet_type, level)
);

create index if not exists idx_payouts_race on payouts (race_id);

create table if not exists jackpot_carry (
  id bigserial primary key,
  race_id text not null,
  bet_type text not null,
  level text not null,
  amount numeric(14,4) not null check (amount >= 0),
  is_settled boolean not null default false,
  settled_race_id text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_jackpot_carry_open on jackpot_carry (bet_type, level) where is_settled = false;

insert into config (bet_type, is_enabled, calculation_mode, payout_percentage, split_rules, jackpot_enabled, minimum_dividend, rounding_base)
values
  ('gagnant', true, 'automatic', 0.75, '{"main":1}', true, 20, 5),
  ('place', true, 'automatic', 0.75, '{"main":1}', true, 20, 5),
  ('couple', true, 'automatic', 0.75, '{"order":0.5,"disorder":0.5}', true, 20, 5),
  ('tierce', true, 'automatic', 0.75, '{"order":0.6,"disorder":0.4}', true, 20, 5),
  ('quarte', true, 'automatic', 0.75, '{"order":0.5,"disorder":0.25,"bonus3":0.25}', true, 20, 5),
  ('quinte', true, 'automatic', 0.75, '{"order":0.4,"disorder":0.2,"bonus4":0.25,"bonus3":0.15}', true, 20, 5),
  ('multi4', true, 'automatic', 0.75, '{"main":1}', true, 20, 5),
  ('multi5', true, 'automatic', 0.75, '{"main":1}', true, 20, 5),
  ('multi6', true, 'automatic', 0.75, '{"main":1}', true, 20, 5),
  ('multi7', true, 'automatic', 0.75, '{"main":1}', true, 20, 5)
on conflict (bet_type) do update set
  is_enabled = excluded.is_enabled,
  calculation_mode = excluded.calculation_mode,
  payout_percentage = excluded.payout_percentage,
  split_rules = excluded.split_rules,
  jackpot_enabled = excluded.jackpot_enabled,
  minimum_dividend = excluded.minimum_dividend,
  rounding_base = excluded.rounding_base,
  updated_at = now();
