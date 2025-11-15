-- Drop the security definer view as it's not needed
-- We'll query calendar_events directly with RLS policies instead
DROP VIEW IF EXISTS public.friend_calendar_view;