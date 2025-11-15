-- Create activity_swipes table to track user responses to activity recommendations
CREATE TABLE public.activity_swipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES public.activities(id),
  response TEXT NOT NULL CHECK (response IN ('accept', 'reject')),
  suggested_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  matched_at TIMESTAMP WITH TIME ZONE,
  calendar_event_created BOOLEAN DEFAULT false,
  UNIQUE(user_id, friend_id, activity_id, suggested_time)
);

-- Enable RLS
ALTER TABLE public.activity_swipes ENABLE ROW LEVEL SECURITY;

-- Users can view their own swipes
CREATE POLICY "Users can view their own swipes"
ON public.activity_swipes
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create their own swipes
CREATE POLICY "Users can create their own swipes"
ON public.activity_swipes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own swipes
CREATE POLICY "Users can update their own swipes"
ON public.activity_swipes
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster match detection
CREATE INDEX idx_activity_swipes_match ON public.activity_swipes(friend_id, user_id, activity_id, suggested_time, response) WHERE response = 'accept';

-- Function to check for matches
CREATE OR REPLACE FUNCTION public.check_activity_match(
  p_user_id UUID,
  p_friend_id UUID,
  p_activity_id UUID,
  p_suggested_time TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_exists BOOLEAN;
BEGIN
  -- Check if both users have accepted
  SELECT EXISTS(
    SELECT 1
    FROM activity_swipes
    WHERE user_id = p_friend_id
      AND friend_id = p_user_id
      AND activity_id = p_activity_id
      AND suggested_time = p_suggested_time
      AND response = 'accept'
  ) INTO v_match_exists;
  
  RETURN v_match_exists;
END;
$$;