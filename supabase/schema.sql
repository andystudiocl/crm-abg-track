-- =====================================================================
-- CRM ABG Car Boutique — esquema completo
-- Ejecutar entero en Supabase > SQL Editor. Es re-ejecutable.
-- =====================================================================

-- ---------- Tipos ----------
do $$ begin
  create type public.advisor_role as enum ('admin', 'asesor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vehicle_status as enum ('en_camino', 'disponible', 'reservado', 'vendido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum ('meta_ads', 'whatsapp', 'web', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('nuevo', 'contactado', 'agendado', 'negociacion', 'ganado', 'perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_direction as enum ('in', 'out');
exception when duplicate_object then null; end $$;

-- ---------- Utilidad: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- advisors ----------
create table if not exists public.advisors (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role public.advisor_role not null default 'asesor',
  google_refresh_token text,
  -- Permite a la UI saber si hay Google conectado sin leer el token.
  google_connected boolean generated always as (google_refresh_token is not null) stored,
  created_at timestamptz not null default now()
);

-- Crea la fila del asesor al registrar un usuario. El primero es admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.advisors) into is_first;
  insert into public.advisors (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case when is_first then 'admin'::public.advisor_role else 'asesor'::public.advisor_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- vehicles ----------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  modelo text not null,
  version text,
  anio integer not null check (anio between 1950 and 2100),
  km integer not null default 0 check (km >= 0),
  precio_clp bigint not null default 0 check (precio_clp >= 0),
  combustible text,
  transmision text,
  color text,
  patente text,
  descripcion text,
  status public.vehicle_status not null default 'disponible',
  published boolean not null default false,
  arrived_at date,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_status_idx on public.vehicles (status);
create index if not exists vehicles_published_idx on public.vehicles (published) where published;

drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- Al pasar a vendido: registra sold_at y despublica. Al salir de vendido: limpia sold_at.
create or replace function public.vehicles_sold_rules()
returns trigger language plpgsql as $$
begin
  if new.status = 'vendido' then
    new.published := false;
    if tg_op = 'INSERT' or old.status is distinct from 'vendido' then
      new.sold_at := coalesce(new.sold_at, now());
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'vendido' then
    new.sold_at := null;
  end if;
  return new;
end $$;

drop trigger if exists vehicles_sold on public.vehicles;
create trigger vehicles_sold
  before insert or update on public.vehicles
  for each row execute function public.vehicles_sold_rules();

-- ---------- vehicle_photos ----------
create table if not exists public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  path text not null,
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_photos_vehicle_idx on public.vehicle_photos (vehicle_id, position);
-- Solo una portada por auto.
create unique index if not exists vehicle_photos_one_cover on public.vehicle_photos (vehicle_id) where is_cover;

-- ---------- leads ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  phone text,                 -- formato internacional sin +, ej. 56912345678
  email text,
  source public.lead_source not null default 'manual',
  status public.lead_status not null default 'nuevo',
  vehicle_id uuid references public.vehicles (id) on delete set null,
  advisor_id uuid references public.advisors (id) on delete set null,
  campaign text,
  notes text,
  external_id text unique,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_phone_idx on public.leads (phone);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_idx on public.leads (created_at desc);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------- lead_messages ----------
create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  direction public.message_direction not null,
  body text not null default '',
  wa_message_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists lead_messages_lead_idx on public.lead_messages (lead_id, created_at);

-- ---------- appointments ----------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  advisor_id uuid references public.advisors (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  google_event_id text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointments_starts_idx on public.appointments (starts_at);

-- =====================================================================
-- Seguridad (RLS). El equipo autenticado lee y escribe todo.
-- Webhooks y API pública usan service_role (salta RLS) solo en el servidor.
-- =====================================================================
alter table public.advisors       enable row level security;
alter table public.vehicles       enable row level security;
alter table public.vehicle_photos enable row level security;
alter table public.leads          enable row level security;
alter table public.lead_messages  enable row level security;
alter table public.appointments   enable row level security;

-- advisors: el token de Google nunca es legible desde el navegador.
revoke all on public.advisors from anon, authenticated;
grant select (id, name, email, role, google_connected, created_at) on public.advisors to authenticated;
grant update (name) on public.advisors to authenticated;

drop policy if exists "advisors_select" on public.advisors;
create policy "advisors_select" on public.advisors
  for select to authenticated using (true);

drop policy if exists "advisors_update_self" on public.advisors;
create policy "advisors_update_self" on public.advisors
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Resto de tablas: acceso total para autenticados, nada para anon.
do $$
declare t text;
begin
  foreach t in array array['vehicles', 'vehicle_photos', 'leads', 'lead_messages', 'appointments'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "team_all" on public.%I', t);
    execute format(
      'create policy "team_all" on public.%I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- =====================================================================
-- Storage: bucket público "vehicles" (lectura pública, escritura autenticada)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicles', 'vehicles', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicles_read_auth" on storage.objects;
create policy "vehicles_read_auth" on storage.objects
  for select to authenticated using (bucket_id = 'vehicles');

drop policy if exists "vehicles_insert_auth" on storage.objects;
create policy "vehicles_insert_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'vehicles');

drop policy if exists "vehicles_update_auth" on storage.objects;
create policy "vehicles_update_auth" on storage.objects
  for update to authenticated using (bucket_id = 'vehicles') with check (bucket_id = 'vehicles');

drop policy if exists "vehicles_delete_auth" on storage.objects;
create policy "vehicles_delete_auth" on storage.objects
  for delete to authenticated using (bucket_id = 'vehicles');
