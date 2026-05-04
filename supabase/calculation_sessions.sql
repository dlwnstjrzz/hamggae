create table if not exists public.calculation_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    source_data jsonb not null default '[]'::jsonb,
    calculator_state jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists calculation_sessions_user_id_idx
    on public.calculation_sessions (user_id, updated_at desc);

create or replace function public.set_calculation_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists calculation_sessions_set_updated_at on public.calculation_sessions;

create trigger calculation_sessions_set_updated_at
before update on public.calculation_sessions
for each row
execute function public.set_calculation_sessions_updated_at();

alter table public.calculation_sessions enable row level security;

drop policy if exists "Users can read own calculation sessions" on public.calculation_sessions;
create policy "Users can read own calculation sessions"
on public.calculation_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own calculation sessions" on public.calculation_sessions;
create policy "Users can insert own calculation sessions"
on public.calculation_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own calculation sessions" on public.calculation_sessions;
create policy "Users can update own calculation sessions"
on public.calculation_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own calculation sessions" on public.calculation_sessions;
create policy "Users can delete own calculation sessions"
on public.calculation_sessions
for delete
using (auth.uid() = user_id);
