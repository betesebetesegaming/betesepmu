alter table races
  add column if not exists updated_by_id text,
  add column if not exists updated_by_name text;

alter table tickets
  add column if not exists transaction_channel text not null default 'Terminal';

update tickets
set transaction_channel = case
  when customer_id is not null then 'Online'
  else 'Terminal'
end
where transaction_channel is null
   or transaction_channel not in ('Online', 'Terminal');
