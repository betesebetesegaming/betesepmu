do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'payment_configs_provider_check'
      and conrelid = 'public.payment_configs'::regclass
  ) then
    alter table public.payment_configs
      drop constraint payment_configs_provider_check;
  end if;

  alter table public.payment_configs
    add constraint payment_configs_provider_check
    check (provider in ('Wave', 'AfriMoney', 'VendorCommission'));
exception
  when duplicate_object then
    null;
end $$;
