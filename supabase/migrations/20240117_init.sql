-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: automations
create table public.automations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null default auth.uid(),
    name text not null,
    status text not null default 'draft' check (status in ('draft', 'published', 'paused')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: automation_versions
create table public.automation_versions (
    id uuid primary key default uuid_generate_v4(),
    automation_id uuid references public.automations(id) on delete cascade not null,
    version int not null,
    is_published boolean default false,
    nodes jsonb default '[]'::jsonb,
    edges jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: automation_drafts
create table public.automation_drafts (
    id uuid primary key default uuid_generate_v4(),
    automation_id uuid references public.automations(id) on delete cascade not null unique,
    user_id uuid not null default auth.uid(),
    nodes jsonb default '[]'::jsonb,
    edges jsonb default '[]'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: contacts
create table public.contacts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null default auth.uid(),
    ig_user_id text,
    username text,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: contact_tags
create table public.contact_tags (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null default auth.uid(),
    contact_id uuid references public.contacts(id) on delete cascade not null,
    tag text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(contact_id, tag)
);

-- Table: automation_executions
create table public.automation_executions (
    id uuid primary key default uuid_generate_v4(),
    automation_id uuid references public.automations(id) on delete cascade,
    version_id uuid references public.automation_versions(id),
    user_id uuid not null default auth.uid(),
    contact_id uuid references public.contacts(id) on delete cascade,
    current_node_id text,
    status text not null check (status in ('running', 'waiting', 'finished', 'failed')),
    context jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: automation_jobs
create table public.automation_jobs (
    id uuid primary key default uuid_generate_v4(),
    execution_id uuid references public.automation_executions(id) on delete cascade not null,
    run_at timestamp with time zone not null,
    status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
    payload jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: node_metrics
create table public.node_metrics (
    id uuid primary key default uuid_generate_v4(),
    automation_id uuid references public.automations(id) on delete cascade,
    version_id uuid references public.automation_versions(id),
    node_id text not null,
    sent int default 0,
    read int default 0,
    clicked int default 0,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(version_id, node_id)
);

-- Settings for RLS
alter table public.automations enable row level security;
alter table public.automation_versions enable row level security;
alter table public.automation_drafts enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_tags enable row level security;
alter table public.automation_executions enable row level security;
alter table public.automation_jobs enable row level security;
alter table public.node_metrics enable row level security;

-- Policies
create policy "Users can view their own automations" on public.automations for all using (auth.uid() = user_id);
create policy "Users can view their own automation versions" on public.automation_versions for all using (exists (select 1 from public.automations a where a.id = automation_versions.automation_id and a.user_id = auth.uid()));
create policy "Users can view their own drafts" on public.automation_drafts for all using (auth.uid() = user_id);
create policy "Users can view their own contacts" on public.contacts for all using (auth.uid() = user_id);
create policy "Users can view their own contact tags" on public.contact_tags for all using (auth.uid() = user_id);
create policy "Users can view their own executions" on public.automation_executions for all using (auth.uid() = user_id);
create policy "Users can view their own jobs" on public.automation_jobs for all using (exists (select 1 from public.automation_executions e where e.id = automation_jobs.execution_id and e.user_id = auth.uid()));
create policy "Users can view their own metrics" on public.node_metrics for all using (exists (select 1 from public.automations a where a.id = node_metrics.automation_id and a.user_id = auth.uid()));

-- Functions needed?
-- Simple RLS is usually enough if user_id is on rows or parent rows.
