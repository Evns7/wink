-- Remove foreign key constraints from profiles and preferences tables
-- Supabase recommends NOT using foreign keys to auth.users since it's a managed schema

-- Drop the foreign key constraint from profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Drop the foreign key constraint from preferences  
ALTER TABLE public.preferences DROP CONSTRAINT IF EXISTS preferences_user_id_fkey;

-- Drop the foreign key constraint from calendar_connections
ALTER TABLE public.calendar_connections DROP CONSTRAINT IF EXISTS calendar_connections_user_id_fkey;

-- Drop the foreign key constraint from calendar_events
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_user_id_fkey;

-- The tables will still work, but won't fail if a user is deleted from auth.users
-- RLS policies still enforce that users can only access their own data