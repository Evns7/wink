-- Add RLS policy for viewing friends' calendar events
CREATE POLICY "Users can view friends calendar events"
ON public.calendar_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships
    WHERE friendships.status = 'accepted'
      AND (
        (friendships.user_id = auth.uid() AND friendships.friend_id = calendar_events.user_id)
        OR
        (friendships.friend_id = auth.uid() AND friendships.user_id = calendar_events.user_id)
      )
  )
);

-- Create a view for easy friend calendar access
CREATE OR REPLACE VIEW public.friend_calendar_view AS
SELECT 
  ce.id,
  ce.user_id,
  ce.title,
  ce.start_time,
  ce.end_time,
  ce.location,
  ce.is_all_day,
  CASE 
    WHEN ce.user_id = auth.uid() THEN 'own'
    ELSE 'friend'
  END as calendar_type
FROM calendar_events ce
WHERE 
  ce.user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = ce.user_id)
        OR
        (f.friend_id = auth.uid() AND f.user_id = ce.user_id)
      )
  );