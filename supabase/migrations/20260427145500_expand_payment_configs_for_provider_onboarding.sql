alter table payment_configs
  add column if not exists environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  add column if not exists signature_secret text not null default '',
  add column if not exists short_code text not null default '',
  add column if not exists merchant_msisdn text not null default '',
  add column if not exists merchant_display_name text not null default '',
  add column if not exists currency text not null default 'GMD',
  add column if not exists base_url text not null default '',
  add column if not exists webhook_secret text not null default '',
  add column if not exists callback_auth_token text not null default '',
  add column if not exists request_timeout_ms int not null default 30000;

update payment_configs
set
  currency = coalesce(nullif(currency, ''), 'GMD'),
  request_timeout_ms = case when request_timeout_ms is null or request_timeout_ms < 1000 then 30000 else request_timeout_ms end,
  environment = case when environment not in ('sandbox', 'production') then 'sandbox' else environment end;
