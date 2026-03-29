-- Areya RRHH - Schema v3
-- Ejecuta este archivo en Supabase SQL Editor.
-- Crea staff_rh, redefine nuevos_ingresos para acceso al portal
-- y deja soporte para activacion, reset de contrasena y auditoria basica.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- STAFF RH
-- ------------------------------------------------------------

create table if not exists public.staff_rh (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  email text not null unique,
  password_hash text,
  password_reset_token text unique,
  password_reset_expira_at timestamptz,
  rol text not null default 'Admin' check (rol in ('Admin', 'Direccion')),
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo')),
  aprobado_por uuid references public.staff_rh(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists idx_staff_rh_email on public.staff_rh(email);
create index if not exists idx_staff_rh_status on public.staff_rh(status);
create unique index if not exists idx_staff_rh_reset_token on public.staff_rh(password_reset_token);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_staff_rh_updated_at on public.staff_rh;
create trigger trg_staff_rh_updated_at
before update on public.staff_rh
for each row
execute function public.set_updated_at();

-- Admin bootstrap inicial.
-- Ajusta nombre o email si no corresponde.
insert into public.staff_rh (nombre_completo, email, rol, status, approved_at)
values (
  'Estefania Saldivar',
  'estefania.saldivar@areya.com.mx',
  'Admin',
  'Activo',
  now()
)
on conflict (email) do update
set
  nombre_completo = excluded.nombre_completo,
  rol = excluded.rol,
  status = excluded.status;

update public.staff_rh
set password_hash = coalesce(password_hash, 'Chapis123')
where email = 'estefania.saldivar@areya.com.mx';

alter table public.staff_rh
  add column if not exists approved_at timestamptz,
  add column if not exists password_reset_token text,
  add column if not exists password_reset_expira_at timestamptz;

-- ------------------------------------------------------------
-- EMPLEADOS
-- ------------------------------------------------------------
-- Estas columnas soportan el flujo:
-- Pendiente -> Onboarding -> Activo -> Offboarding -> Inactivo

alter table public.empleados
  add column if not exists onboarding_configurado boolean not null default false,
  add column if not exists onboarding_configurado_at timestamptz,
  add column if not exists tipo_salida text,
  add column if not exists subcategoria_salida text,
  add column if not exists comentarios_baja text,
  add column if not exists elegible_recontratacion boolean;

update public.empleados
set status = 'Pendiente'
where status is null;

alter table public.empleados
  alter column status set default 'Pendiente';

-- ------------------------------------------------------------
-- NUEVOS INGRESOS / ACCESO PORTAL
-- ------------------------------------------------------------
-- Si ya existe una tabla previa, la completa con las nuevas columnas.

create table if not exists public.nuevos_ingresos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null unique references public.empleados(id) on delete cascade,
  nombre text not null,
  email_corporativo text unique,
  contrasena text,
  password_creada boolean not null default false,
  token_activacion text unique,
  token_expira_at timestamptz,
  token_usado_at timestamptz,
  password_reset_token text unique,
  password_reset_expira_at timestamptz,
  invitacion_enviada_at timestamptz,
  password_actualizada_at timestamptz,
  ultimo_acceso_at timestamptz,
  status text not null default 'pendiente' check (status in ('pendiente', 'configurado', 'activo', 'bloqueado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nuevos_ingresos
  add column if not exists empleado_id uuid references public.empleados(id) on delete cascade,
  add column if not exists nombre text,
  add column if not exists email_corporativo text,
  add column if not exists contrasena text,
  add column if not exists password_creada boolean not null default false,
  add column if not exists token_activacion text,
  add column if not exists token_expira_at timestamptz,
  add column if not exists token_usado_at timestamptz,
  add column if not exists password_reset_token text,
  add column if not exists password_reset_expira_at timestamptz,
  add column if not exists invitacion_enviada_at timestamptz,
  add column if not exists password_actualizada_at timestamptz,
  add column if not exists ultimo_acceso_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nuevos_ingresos_status_check'
  ) then
    alter table public.nuevos_ingresos
      add constraint nuevos_ingresos_status_check
      check (status in ('pendiente', 'configurado', 'activo', 'bloqueado'));
  end if;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists idx_nuevos_ingresos_empleado_id on public.nuevos_ingresos(empleado_id);
create unique index if not exists idx_nuevos_ingresos_email on public.nuevos_ingresos(email_corporativo);
create unique index if not exists idx_nuevos_ingresos_token_activacion on public.nuevos_ingresos(token_activacion);
create unique index if not exists idx_nuevos_ingresos_reset_token on public.nuevos_ingresos(password_reset_token);

drop trigger if exists trg_nuevos_ingresos_updated_at on public.nuevos_ingresos;
create trigger trg_nuevos_ingresos_updated_at
before update on public.nuevos_ingresos
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- ENTREVISTAS DE SALIDA
-- ------------------------------------------------------------

alter table public.entrevistas_salida
  add column if not exists rrhh_completado boolean not null default false,
  add column if not exists rrhh_completed_at timestamptz,
  add column if not exists submitted_at timestamptz default now(),
  add column if not exists tipo_salida text,
  add column if not exists subcategoria_salida text,
  add column if not exists razon_rrhh text,
  add column if not exists comentarios_rrhh text,
  add column if not exists fecha_termino date,
  add column if not exists elegible_recontratacion boolean;

-- ------------------------------------------------------------
-- HISTORIAL DE MOVIMIENTOS
-- ------------------------------------------------------------

create table if not exists public.empleado_movimientos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  actor_tipo text not null check (actor_tipo in ('staff_rh', 'sistema', 'empleado')),
  actor_id uuid,
  actor_email text,
  movimiento text not null,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_empleado_movimientos_empleado on public.empleado_movimientos(empleado_id, created_at desc);

-- ------------------------------------------------------------
-- NOTAS
-- ------------------------------------------------------------
-- 1. "Dominio" en correos se refiere al dominio del remitente, por ejemplo:
--    noreply@areya.com.mx
--    Para enviar desde Resend/Mailgun/etc necesitas verificar ese dominio.
-- 2. El portal ya usa https://areya-red.vercel.app/portal como URL publica.
-- 3. La columna "contrasena" hoy permite compatibilidad con el frontend actual.
--    En el siguiente paso la movemos a hash real con validacion backend.
