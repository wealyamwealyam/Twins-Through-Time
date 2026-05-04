-- =============================================================================
-- Twins Through Time - Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- Users
create table if not exists users (
  id            uuid        primary key default gen_random_uuid(),
  username      text        unique not null,
  email         text        unique not null,
  password_hash text        not null,
  first_name    text,
  last_name     text,
  account_type  text        not null default 'community_member'
                            check (account_type in ('community_member', 'contributor', 'admin')),
  age           int,
  gender        text,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Refresh tokens
create table if not exists refresh_tokens (
  token      text        primary key,
  user_id    uuid        not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

-- Password reset tokens
create table if not exists reset_tokens (
  token      text        primary key,
  user_id    uuid        not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used       boolean     not null default false
);

-- Scrape jobs
create table if not exists scrape_jobs (
  id            uuid        primary key default gen_random_uuid(),
  url           text        not null,
  max_photos    int         not null default 50,
  status        text        not null default 'queued'
                check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  submitted_by  uuid        not null references users(id) on delete cascade,
  photo_count   int         not null default 0,
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table scrape_jobs
  add column if not exists error_message text;

-- Photos
create table if not exists photos (
  id                 uuid        primary key default gen_random_uuid(),
  scrape_job_id      uuid        references scrape_jobs(id) on delete set null,
  submitted_by       uuid        not null references users(id) on delete cascade,
  image_url          text        not null,
  status             text        not null default 'pending_review'
                     check (status in ('pending_review', 'reviewed', 'rejected')),
  is_duplicate       boolean     not null default false,
  duplicate_of_id    uuid        references photos(id) on delete set null,
  is_auto_extracted  boolean     not null default true,
  metadata_edited_by uuid        references users(id) on delete set null,
  metadata_edited_at timestamptz,
  name               text,
  regiment           text,
  age                text,
  date_taken         text,
  location           text,
  photographer       text,
  collection         text,
  photo_notes        text,
  tags               text[]      not null default '{}',
  license            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table photos
add column if not exists metadata jsonb not null default '{
  "First Name": "",
  "Middle Name or Initial": "",
  "Last Name": "",
  "Military Unit": "",
  "Regiment Number": "",
  "Regiment State": "",
  "Branch": "",
  "Company": "",
  "Age": 0,
  "Year Born": 0,
  "Transcript": "",
  "Confidence": 0.0,
  "Source": "",
  "Other": {}
}'::jsonb;

-- Account change requests
create table if not exists account_change_requests (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  current_account    text        not null,
  requesting_account text        not null
                     check (requesting_account in ('contributor', 'admin')),
  reason_message     text        not null,
  status             text        not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  admin_note         text,
  reviewed_by        uuid        references users(id) on delete set null,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Auto-update updated_at timestamps
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_users
  before update on users
  for each row execute function update_updated_at();

create trigger set_updated_at_scrape_jobs
  before update on scrape_jobs
  for each row execute function update_updated_at();

create trigger set_updated_at_photos
  before update on photos
  for each row execute function update_updated_at();

create trigger set_updated_at_account_change_requests
  before update on account_change_requests
  for each row execute function update_updated_at();
