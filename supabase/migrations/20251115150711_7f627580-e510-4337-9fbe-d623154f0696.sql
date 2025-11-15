-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('private', 'open')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'canceled')),
  allowed_friend_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_attendees table
CREATE TABLE public.event_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events table

-- Users can view events they created
CREATE POLICY "Users can view their own events"
ON public.events
FOR SELECT
USING (auth.uid() = user_id);

-- Users can view open events created by their friends
CREATE POLICY "Users can view open events from friends"
ON public.events
FOR SELECT
USING (
  event_type = 'open' 
  AND EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (
      (user_id = events.user_id AND friend_id = auth.uid())
      OR (friend_id = events.user_id AND user_id = auth.uid())
    )
    AND status = 'accepted'
  )
);

-- Users can view private events where they're invited
CREATE POLICY "Users can view private events they're invited to"
ON public.events
FOR SELECT
USING (
  event_type = 'private'
  AND auth.uid() = ANY(allowed_friend_ids)
);

-- Users can create their own events
CREATE POLICY "Users can create their own events"
ON public.events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own events
CREATE POLICY "Users can update their own events"
ON public.events
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own events
CREATE POLICY "Users can delete their own events"
ON public.events
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for event_attendees table

-- Users can view attendees for events they can see
CREATE POLICY "Users can view attendees for visible events"
ON public.event_attendees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_attendees.event_id
    AND (
      -- Event creator
      events.user_id = auth.uid()
      -- Open event from friend
      OR (
        events.event_type = 'open'
        AND EXISTS (
          SELECT 1 FROM public.friendships
          WHERE (
            (user_id = events.user_id AND friend_id = auth.uid())
            OR (friend_id = events.user_id AND user_id = auth.uid())
          )
          AND status = 'accepted'
        )
      )
      -- Private event where user is invited
      OR (
        events.event_type = 'private'
        AND auth.uid() = ANY(events.allowed_friend_ids)
      )
    )
  )
);

-- Users can join events they can see
CREATE POLICY "Users can join visible events"
ON public.event_attendees
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_attendees.event_id
    AND (
      -- Event creator
      events.user_id = auth.uid()
      -- Open event from friend
      OR (
        events.event_type = 'open'
        AND EXISTS (
          SELECT 1 FROM public.friendships
          WHERE (
            (user_id = events.user_id AND friend_id = auth.uid())
            OR (friend_id = events.user_id AND user_id = auth.uid())
          )
          AND status = 'accepted'
        )
      )
      -- Private event where user is invited
      OR (
        events.event_type = 'private'
        AND auth.uid() = ANY(events.allowed_friend_ids)
      )
    )
  )
);

-- Users can update their own attendance status
CREATE POLICY "Users can update their own attendance"
ON public.event_attendees
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can remove themselves from events
CREATE POLICY "Users can leave events"
ON public.event_attendees
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_event_type ON public.events(event_type);
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_event_attendees_event_id ON public.event_attendees(event_id);
CREATE INDEX idx_event_attendees_user_id ON public.event_attendees(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();