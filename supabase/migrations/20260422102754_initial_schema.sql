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

-- ====================================================================
-- Core app schema for Betese PMU dashboard (users, tickets, finance,
-- promotions, media, chat, manual bet orders, payment settings)
-- ====================================================================

create table if not exists users (
  id text primary key,
  name text not null,
  role text not null check (role in ('Admin', 'Supervisor', 'Vendor', 'Customer')),
  is_locked boolean not null default false,
  phone text,
  password text,
  wallet_balance numeric(12,2) not null default 0,
  bonus_balance numeric(12,2) not null default 0,
  created_by_id text,
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table users add column if not exists name text;
alter table users add column if not exists role text;
alter table users add column if not exists is_locked boolean not null default false;
alter table users add column if not exists phone text;
alter table users add column if not exists password text;
alter table users add column if not exists wallet_balance numeric(12,2) not null default 0;
alter table users add column if not exists bonus_balance numeric(12,2) not null default 0;
alter table users add column if not exists created_by_id text;
alter table users add column if not exists created_by_name text;
alter table users add column if not exists created_at timestamptz not null default now();

create index if not exists idx_users_role on users (role);
create index if not exists idx_users_phone on users (phone);

create table if not exists races (
  id text primary key,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  horse_count int not null check (horse_count > 0),
  non_runners int[] not null default '{}',
  disabled_bet_types text[] not null default '{}',
  result jsonb,
  jackpot numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table races add column if not exists name text;
alter table races add column if not exists start_date timestamptz;
alter table races add column if not exists end_date timestamptz;
alter table races add column if not exists horse_count int;
alter table races add column if not exists non_runners int[] not null default '{}';
alter table races add column if not exists disabled_bet_types text[] not null default '{}';
alter table races add column if not exists result jsonb;
alter table races add column if not exists jackpot numeric(12,2) not null default 0;
alter table races add column if not exists created_at timestamptz not null default now();
alter table races add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_races_end_date on races (end_date desc);

create table if not exists tickets (
  id text primary key,
  timestamp timestamptz not null,
  vendor_id text references users(id) on delete set null,
  vendor_name text,
  customer_id text references users(id) on delete set null,
  status text not null check (status in ('Active', 'Winning', 'Lost', 'Canceled', 'Booked', 'Paid')),
  booking_code text unique,
  selections jsonb not null,
  total_cost numeric(12,2) not null check (total_cost >= 0),
  winnings numeric(12,2),
  winnings_breakdown jsonb,
  paid_at timestamptz,
  paid_by_id text,
  paid_by_name text,
  canceled_at timestamptz,
  canceled_by_id text,
  canceled_by_name text,
  created_at timestamptz not null default now()
);

alter table tickets add column if not exists timestamp timestamptz;
alter table tickets add column if not exists vendor_id text references users(id) on delete set null;
alter table tickets add column if not exists vendor_name text;
alter table tickets add column if not exists customer_id text references users(id) on delete set null;
alter table tickets add column if not exists status text;
alter table tickets add column if not exists booking_code text;
alter table tickets add column if not exists selections jsonb;
alter table tickets add column if not exists total_cost numeric(12,2);
alter table tickets add column if not exists winnings numeric(12,2);
alter table tickets add column if not exists winnings_breakdown jsonb;
alter table tickets add column if not exists paid_at timestamptz;
alter table tickets add column if not exists paid_by_id text;
alter table tickets add column if not exists paid_by_name text;
alter table tickets add column if not exists canceled_at timestamptz;
alter table tickets add column if not exists canceled_by_id text;
alter table tickets add column if not exists canceled_by_name text;
alter table tickets add column if not exists created_at timestamptz not null default now();

create index if not exists idx_tickets_status on tickets (status);
create index if not exists idx_tickets_vendor on tickets (vendor_id);
create index if not exists idx_tickets_customer on tickets (customer_id);
create index if not exists idx_tickets_booking_code on tickets (booking_code);
create index if not exists idx_tickets_timestamp on tickets (timestamp desc);

create table if not exists deposit_requests (
  id text primary key,
  customer_id text not null references users(id) on delete cascade,
  customer_name text,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('Wave', 'AfriMoney')),
  transaction_id text not null,
  status text not null check (status in ('Pending', 'Approved', 'Rejected')),
  processed_by text,
  processed_by_name text,
  processed_at timestamptz,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

alter table deposit_requests add column if not exists customer_id text references users(id) on delete cascade;
alter table deposit_requests add column if not exists customer_name text;
alter table deposit_requests add column if not exists amount numeric(12,2);
alter table deposit_requests add column if not exists method text;
alter table deposit_requests add column if not exists transaction_id text;
alter table deposit_requests add column if not exists status text;
alter table deposit_requests add column if not exists processed_by text;
alter table deposit_requests add column if not exists processed_by_name text;
alter table deposit_requests add column if not exists processed_at timestamptz;
alter table deposit_requests add column if not exists timestamp timestamptz;
alter table deposit_requests add column if not exists created_at timestamptz not null default now();

create index if not exists idx_deposit_requests_status on deposit_requests (status);
create index if not exists idx_deposit_requests_customer on deposit_requests (customer_id);

create table if not exists withdrawal_requests (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  user_name text,
  amount numeric(12,2) not null check (amount > 0),
  status text not null check (status in ('Pending', 'Completed', 'Canceled')),
  code text not null unique,
  requested_at timestamptz not null,
  completed_at timestamptz,
  processed_by text,
  processed_by_name text,
  created_at timestamptz not null default now()
);

alter table withdrawal_requests add column if not exists user_id text references users(id) on delete cascade;
alter table withdrawal_requests add column if not exists user_name text;
alter table withdrawal_requests add column if not exists amount numeric(12,2);
alter table withdrawal_requests add column if not exists status text;
alter table withdrawal_requests add column if not exists code text;
alter table withdrawal_requests add column if not exists requested_at timestamptz;
alter table withdrawal_requests add column if not exists completed_at timestamptz;
alter table withdrawal_requests add column if not exists processed_by text;
alter table withdrawal_requests add column if not exists processed_by_name text;
alter table withdrawal_requests add column if not exists created_at timestamptz not null default now();

create index if not exists idx_withdrawal_requests_status on withdrawal_requests (status);
create index if not exists idx_withdrawal_requests_user on withdrawal_requests (user_id);

create table if not exists promotions (
  id text primary key,
  name text not null,
  type text not null check (type in ('first-deposit', 'weekly', 'special')),
  is_active boolean not null default true,
  rules jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table promotions add column if not exists name text;
alter table promotions add column if not exists type text;
alter table promotions add column if not exists is_active boolean not null default true;
alter table promotions add column if not exists rules jsonb not null default '[]'::jsonb;
alter table promotions add column if not exists sort_order int not null default 0;
alter table promotions add column if not exists created_at timestamptz not null default now();
alter table promotions add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_promotions_order on promotions (sort_order asc);

create table if not exists program_images (
  id text primary key,
  type text not null check (type in ('program', 'advertisement')),
  url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create table if not exists payment_configs (
  provider text primary key check (provider in ('Wave', 'AfriMoney')),
  is_enabled boolean not null default false,
  api_key text not null default '',
  api_secret text not null default '',
  merchant_id text not null default '',
  webhook_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists chat_threads (
  id text primary key,
  participant_ids text[] not null,
  name text,
  is_broadcast boolean not null default false,
  last_message_timestamp timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id text primary key,
  thread_id text not null references chat_threads(id) on delete cascade,
  sender_id text not null,
  sender_name text not null,
  content text not null,
  timestamp timestamptz not null default now(),
  read_by_ids text[] not null default '{}',
  content_type text not null default 'text' check (content_type in ('text', 'audio')),
  audio_base64 text,
  audio_duration int
);

create index if not exists idx_chat_messages_thread on chat_messages (thread_id, timestamp asc);
create index if not exists idx_chat_threads_last_message on chat_threads (last_message_timestamp desc);

create table if not exists manual_bet_orders (
  id text primary key,
  created_at timestamptz not null,
  created_by_id text not null,
  created_by_name text not null,
  assigned_vendor_id text not null references users(id) on delete restrict,
  selections jsonb not null,
  total_cost numeric(12,2) not null check (total_cost > 0),
  status text not null check (status in ('Pending', 'Completed', 'Canceled'))
);

create index if not exists idx_manual_bet_orders_status on manual_bet_orders (status);
create index if not exists idx_manual_bet_orders_vendor on manual_bet_orders (assigned_vendor_id);

-- --------------------------------------------------------------------
-- Transaction functions
-- --------------------------------------------------------------------

create or replace function payout_ticket_transaction(
  p_ticket_id text,
  p_payout_amount numeric,
  p_paid_by_id text,
  p_paid_by_name text
) returns boolean
language plpgsql
as $$
declare
  v_ticket tickets%rowtype;
  v_customer_balance numeric(12,2);
begin
  select * into v_ticket from tickets where id = p_ticket_id for update;
  if not found then
    return false;
  end if;

  if v_ticket.status = 'Paid' then
    return false;
  end if;

  if v_ticket.status in ('Canceled', 'Lost', 'Booked') then
    return false;
  end if;

  update tickets
  set status = 'Paid',
      paid_at = now(),
      paid_by_id = p_paid_by_id,
      paid_by_name = p_paid_by_name,
      winnings = coalesce(p_payout_amount, winnings)
  where id = p_ticket_id;

  if v_ticket.customer_id is not null and coalesce(p_payout_amount, 0) > 0 then
    select wallet_balance into v_customer_balance from users where id = v_ticket.customer_id for update;
    if found then
      update users
      set wallet_balance = round((coalesce(v_customer_balance, 0) + p_payout_amount)::numeric, 2)
      where id = v_ticket.customer_id;
    end if;
  end if;

  return true;
end;
$$;

create or replace function approve_deposit_transaction(
  p_request_id text,
  p_admin_id text,
  p_admin_name text,
  p_token text,
  p_time timestamptz
) returns boolean
language plpgsql
as $$
declare
  v_req deposit_requests%rowtype;
  v_balance numeric(12,2);
begin
  select * into v_req from deposit_requests where id = p_request_id for update;
  if not found then
    return false;
  end if;

  if v_req.status <> 'Pending' then
    return false;
  end if;

  select wallet_balance into v_balance from users where id = v_req.customer_id for update;

  update users
  set wallet_balance = round((coalesce(v_balance, 0) + v_req.amount)::numeric, 2)
  where id = v_req.customer_id;

  update deposit_requests
  set status = 'Approved',
      processed_by = p_admin_id,
      processed_by_name = p_admin_name,
      processed_at = coalesce(p_time, now())
  where id = p_request_id;

  return true;
end;
$$;

create or replace function pay_for_booking_transaction(
  p_booking_code text,
  p_vendor_id text,
  p_vendor_name text,
  p_paid_at timestamptz
) returns boolean
language plpgsql
as $$
declare
  v_ticket tickets%rowtype;
begin
  select * into v_ticket
  from tickets
  where upper(booking_code) = upper(p_booking_code)
    and status = 'Booked'
  for update;

  if not found then
    return false;
  end if;

  update tickets
  set status = 'Active',
      vendor_id = p_vendor_id,
      vendor_name = p_vendor_name,
      timestamp = coalesce(p_paid_at, now())
  where id = v_ticket.id;

  return true;
end;
$$;

create or replace function process_withdrawal_request_transaction(
  p_code text,
  p_processed_by_id text,
  p_processed_by_name text,
  p_processed_at timestamptz
) returns boolean
language plpgsql
as $$
declare
  v_req withdrawal_requests%rowtype;
  v_balance numeric(12,2);
begin
  select * into v_req
  from withdrawal_requests
  where code = p_code and status = 'Pending'
  for update;

  if not found then
    return false;
  end if;

  select wallet_balance into v_balance from users where id = v_req.user_id for update;
  if coalesce(v_balance, 0) < v_req.amount then
    return false;
  end if;

  update users
  set wallet_balance = round((coalesce(v_balance, 0) - v_req.amount)::numeric, 2)
  where id = v_req.user_id;

  update withdrawal_requests
  set status = 'Completed',
      completed_at = coalesce(p_processed_at, now()),
      processed_by = p_processed_by_id,
      processed_by_name = p_processed_by_name
  where id = v_req.id;

  return true;
end;
$$;

create or replace function mark_message_thread_read(
  p_thread_id text,
  p_user_id text
) returns void
language plpgsql
as $$
begin
  update chat_messages
  set read_by_ids = array(
    select distinct unnest(coalesce(read_by_ids, '{}'::text[]) || array[p_user_id])
  )
  where thread_id = p_thread_id;
end;
$$;

-- --------------------------------------------------------------------
-- Seed baseline users/configs for first login
-- --------------------------------------------------------------------

insert into users (id, name, role, is_locked, password)
values
  ('ADMIN-001', 'admin', 'Admin', false, 'password'),
  ('SUPER-001', 'supervisor', 'Supervisor', false, 'password'),
  ('VEND-JOHN', 'john', 'Vendor', false, 'password'),
  ('CUST-001', 'Lamin', 'Customer', false, 'password')
on conflict (id) do nothing;

insert into payment_configs (provider, is_enabled, api_key, api_secret, merchant_id, webhook_url)
values
  ('Wave', false, '', '', '', 'https://api.betese.com/webhooks/wave'),
  ('AfriMoney', false, '', '', '', 'https://api.betese.com/webhooks/afrimoney')
on conflict (provider) do nothing;
