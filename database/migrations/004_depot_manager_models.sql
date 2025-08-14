-- Depot Manager Models: Drivers, Name Mappings, Enriched Views

-- 1) Core driver dimension
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  employee_id text,
  fleet text not null check (fleet in ('Stevemacs','Great Southern Fuels')),
  depot text not null,
  status text not null default 'Active' check (status in ('Active','Inactive','On Leave','Terminated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure full_name exists even if table was previously created without it
alter table drivers add column if not exists full_name text;

-- Backfill full_name where missing
update drivers
set full_name = trim(both ' ' from coalesce(first_name,'') || ' ' || coalesce(last_name,''))
where full_name is null;

-- Keep full_name in sync on insert/update
create or replace function drivers_set_full_name()
returns trigger as $$
begin
  new.full_name := trim(both ' ' from coalesce(new.first_name,'') || ' ' || coalesce(new.last_name,''));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_drivers_set_full_name on drivers;
create trigger trg_drivers_set_full_name
before insert or update of first_name, last_name on drivers
for each row execute function drivers_set_full_name();

-- Index supports both existing and newly computed names
create index if not exists idx_drivers_full_name on drivers (
  lower(coalesce(full_name, trim(both ' ' from coalesce(first_name,'') || ' ' || coalesce(last_name,''))))
);
create index if not exists idx_drivers_fleet_depot on drivers (fleet, depot);

-- 2) System name mappings (LYTX, Guardian, etc.)
create table if not exists driver_name_mappings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  system_name text not null,
  mapped_name text not null,
  is_primary boolean default false,
  confidence numeric(3,2) default 1.00,
  created_at timestamptz default now(),
  unique (system_name, mapped_name)
);

create index if not exists idx_driver_name_mappings_lower on driver_name_mappings (lower(mapped_name));

-- 3) Enriched LYTX events with resolved vehicle and driver
create or replace view lytx_events_driver_enriched as
select
  e.*,
  v.id as vehicle_id,
  coalesce(nullif(e.vehicle_registration,''), v.registration) as resolved_registration,
  v.fleet as resolved_fleet,
  v.depot as resolved_depot,
  coalesce(dm.driver_id, d.id) as resolved_driver_id
from lytx_safety_events e
left join vehicles v
  on upper(e.vehicle_registration) = upper(v.registration)
  or (e.device_serial is not null and e.device_serial = v.lytx_device)
left join driver_name_mappings dm
  on lower(e.driver_name) = lower(dm.mapped_name) and dm.system_name = 'LYTX'
left join drivers d
  on lower(e.driver_name) = lower(d.full_name) and (v.fleet is null or d.fleet = v.fleet);

-- 4) Depot manager overview (30-day window)
create or replace view depot_manager_overview as
with recent_lytx as (
  select resolved_fleet as fleet, coalesce(resolved_depot, depot) as depot,
         count(*) as lytx_events_30d
  from lytx_events_driver_enriched
  where event_datetime >= now() - interval '30 days'
  group by resolved_fleet, coalesce(resolved_depot, depot)
)
select
  v.fleet,
  v.depot,
  count(distinct v.id)::int as total_vehicles,
  count(distinct case when v.status = 'Active' then v.id end)::int as active_vehicles,
  count(distinct d.id)::int as total_drivers,
  coalesce(r.lytx_events_30d, 0)::int as lytx_events_30d
from vehicles v
left join drivers d on d.fleet = v.fleet and d.depot = v.depot
left join recent_lytx r on r.fleet = v.fleet and r.depot = v.depot
group by v.fleet, v.depot, r.lytx_events_30d
order by v.fleet, v.depot;

-- 5) RLS and grants
alter table drivers enable row level security;
alter table driver_name_mappings enable row level security;

-- Read access for authenticated users
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'drivers' and policyname = 'drivers_select') then
    create policy drivers_select on drivers for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'driver_name_mappings' and policyname = 'driver_name_mappings_select') then
    create policy driver_name_mappings_select on driver_name_mappings for select to authenticated using (true);
  end if;
end $$;

grant select on drivers to authenticated;
grant select on driver_name_mappings to authenticated;
grant select on lytx_events_driver_enriched to authenticated;
grant select on depot_manager_overview to authenticated;

