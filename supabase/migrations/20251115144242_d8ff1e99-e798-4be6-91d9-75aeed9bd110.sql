-- Friendships table for social connections
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policies for friendships
CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of"
ON public.friendships FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Activity invitations table
CREATE TABLE public.activity_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES public.activities(id),
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  suggested_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their invitations"
ON public.activity_invitations FOR SELECT
USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can create invitations"
ON public.activity_invitations FOR INSERT
WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Invitees can update invitation status"
ON public.activity_invitations FOR UPDATE
USING (auth.uid() = invitee_id);

-- Scheduled activities table (links calendar events to activities)
CREATE TABLE public.scheduled_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id UUID REFERENCES public.activities(id),
  calendar_event_id UUID REFERENCES public.calendar_events(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their scheduled activities"
ON public.scheduled_activities FOR ALL
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);
CREATE INDEX idx_activity_invitations_invitee ON public.activity_invitations(invitee_id);
CREATE INDEX idx_scheduled_activities_user ON public.scheduled_activities(user_id);

-- Trigger for friendships updated_at
CREATE TRIGGER update_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();