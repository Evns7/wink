-- Add nickname column to profiles table
ALTER TABLE public.profiles ADD COLUMN nickname TEXT;

-- Add a comment to explain the column
COMMENT ON COLUMN public.profiles.nickname IS 'User chosen display name shown to friends';