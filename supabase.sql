-- Run this whole file once in Supabase → SQL Editor → New query → Run

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  camp text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.progress_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  volunteer_id uuid default auth.uid() references public.profiles(id),
  session_date date not null default current_date,
  subject text not null check (subject in ('english','math')),
  topic text not null,
  level int not null check (level between 1 and 5),
  understanding int check (understanding between 1 and 5),
  notes text,
  next_steps text,
  created_at timestamptz default now()
);

create index if not exists logs_student_idx on public.progress_logs(student_id, session_date desc);

-- Auto-create a profile whenever a volunteer signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Row Level Security: only logged-in volunteers can touch data
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.progress_logs enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());

create policy "students read" on public.students for select to authenticated using (true);
create policy "students add" on public.students for insert to authenticated with check (true);
create policy "students edit" on public.students for update to authenticated using (true);

create policy "logs read" on public.progress_logs for select to authenticated using (true);
create policy "logs add" on public.progress_logs for insert to authenticated with check (volunteer_id = auth.uid());
create policy "logs edit own" on public.progress_logs for update to authenticated using (volunteer_id = auth.uid());
create policy "logs delete own" on public.progress_logs for delete to authenticated using (volunteer_id = auth.uid());
