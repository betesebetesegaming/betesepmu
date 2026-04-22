-- Migration: sync_bets_from_tickets
-- Creates a trigger that auto-populates the `bets` table from ticket.selections
-- so that the Netlify payout function can read it.
-- Also backfills any existing Active/Winning/Lost/Paid tickets.

-- -----------------------------------------------------------------------
-- Helper: map French bet-type display name to the internal bets.bet_type
-- -----------------------------------------------------------------------
create or replace function fn_map_bet_type(display_name text)
returns text language sql immutable as $$
  select case display_name
    when 'Simple Gagnant' then 'gagnant'
    when 'Simple Placé'   then 'place'
    when 'Couplé Gagnant' then 'couple'
    when 'Couplé Placé'   then 'couple'
    when 'Tiercé'         then 'tierce'
    when 'Quarté+'        then 'quarte'
    when 'Quinté+'        then 'quinte'
    when 'Multi 4'        then 'multi4'
    when 'Multi 5'        then 'multi5'
    when 'Multi 6'        then 'multi6'
    when 'Multi 7'        then 'multi7'
    else null
  end;
$$;

-- -----------------------------------------------------------------------
-- Trigger function: expand ticket.selections into bets rows
-- -----------------------------------------------------------------------
create or replace function fn_sync_bets_from_ticket()
returns trigger language plpgsql as $$
declare
  sel      jsonb;
  mapped   text;
  idx      int := 0;
  horse_nums int[];
begin
  -- Only process fully placed tickets (not Booked / Canceled)
  if NEW.status in ('Canceled', 'Booked') then
    return NEW;
  end if;

  for sel in select * from jsonb_array_elements(NEW.selections) loop
    mapped := fn_map_bet_type(sel->>'betType');

    if mapped is null then
      idx := idx + 1;
      continue;
    end if;

    -- Build int[] from selections->numbers JSON array
    select array_agg((v::text)::int)
      into horse_nums
      from jsonb_array_elements_text(sel->'numbers') as v;

    insert into bets (id, race_id, bet_type, selection, stake, units)
    values (
      NEW.id || '-' || idx,
      sel->>'raceId',
      mapped,
      coalesce(horse_nums, '{}'::int[]),
      coalesce((sel->>'cost')::numeric, 0),
      coalesce((sel->>'multiplier')::int, 1)
    )
    on conflict (id) do nothing;

    idx := idx + 1;
  end loop;

  return NEW;
end;
$$;

-- Trigger on INSERT (new ticket placed)
drop trigger if exists trg_sync_bets_insert on tickets;
create trigger trg_sync_bets_insert
  after insert on tickets
  for each row execute function fn_sync_bets_from_ticket();

-- Trigger on UPDATE when a Booked ticket becomes Active (vendor paid for booking)
drop trigger if exists trg_sync_bets_update on tickets;
create trigger trg_sync_bets_update
  after update of status on tickets
  for each row
  when (OLD.status = 'Booked' and NEW.status = 'Active')
  execute function fn_sync_bets_from_ticket();

-- -----------------------------------------------------------------------
-- Backfill: populate bets from existing tickets
-- -----------------------------------------------------------------------
insert into bets (id, race_id, bet_type, selection, stake, units)
select
  t.id || '-' || (ord - 1),
  sel->>'raceId',
  fn_map_bet_type(sel->>'betType'),
  coalesce(
    array(select (v::text)::int from jsonb_array_elements_text(sel->'numbers') as v),
    '{}'::int[]
  ),
  coalesce((sel->>'cost')::numeric, 0),
  coalesce((sel->>'multiplier')::int, 1)
from tickets t,
     jsonb_array_elements(t.selections) with ordinality as el(sel, ord)
where t.status not in ('Canceled', 'Booked')
  and fn_map_bet_type(sel->>'betType') is not null
on conflict (id) do nothing;
