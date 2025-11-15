/**
 * Event Service Usage Examples
 * 
 * This file demonstrates how to use the event system in your application.
 * All examples assume you have imported supabase client and are authenticated.
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// CREATING EVENTS
// ============================================================================

/**
 * Example 1: Create an open event (visible to all friends)
 */
export async function createOpenEvent() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: user.id,
      title: 'Weekend Hiking Trip',
      description: 'Join us for a scenic hike in the mountains!',
      event_date: new Date('2025-11-25T09:00:00').toISOString(),
      location: 'Mountain Trail, North Ridge',
      event_type: 'open',  // All friends can see
      allowed_friend_ids: [],  // Not used for open events
      status: 'upcoming'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }

  console.log('Created open event:', data);
  
  // Add creator as attendee
  await supabase.from('event_attendees').insert({
    event_id: data.id,
    user_id: user.id,
    status: 'accepted'
  });

  return data;
}

/**
 * Example 2: Create a private event (only for selected friends)
 */
export async function createPrivateEvent(friendIds: string[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: user.id,
      title: 'Birthday Dinner',
      description: 'Intimate birthday celebration with close friends',
      event_date: new Date('2025-12-01T19:00:00').toISOString(),
      location: 'The Italian Restaurant, Downtown',
      event_type: 'private',  // Only selected friends can see
      allowed_friend_ids: friendIds,  // Specific friend IDs
      status: 'upcoming'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating private event:', error);
    return null;
  }

  console.log('Created private event:', data);

  // Add creator as attendee
  await supabase.from('event_attendees').insert({
    event_id: data.id,
    user_id: user.id,
    status: 'accepted'
  });

  return data;
}

// ============================================================================
// FETCHING EVENTS
// ============================================================================

/**
 * Example 3: Fetch all events visible to current user
 * (RLS automatically filters based on permissions)
 */
export async function fetchMyVisibleEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'upcoming')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  console.log('Visible events:', data);
  return data;
}

/**
 * Example 4: Fetch events created by current user
 */
export async function fetchMyCreatedEvents() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching my events:', error);
    return [];
  }

  console.log('My events:', data);
  return data;
}

/**
 * Example 5: Fetch events I'm invited to (not my own)
 */
export async function fetchInvitedEvents() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .neq('user_id', user.id)
    .eq('status', 'upcoming')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching invited events:', error);
    return [];
  }

  console.log('Invited to events:', data);
  return data;
}

/**
 * Example 6: Fetch event with attendees count
 */
export async function fetchEventWithAttendees(eventId: string) {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError) {
    console.error('Error fetching event:', eventError);
    return null;
  }

  const { data: attendees, error: attendeesError } = await supabase
    .from('event_attendees')
    .select('*, user_id')
    .eq('event_id', eventId)
    .eq('status', 'accepted');

  if (attendeesError) {
    console.error('Error fetching attendees:', attendeesError);
  }

  return {
    ...event,
    attendees: attendees || [],
    attendee_count: attendees?.length || 0
  };
}

// ============================================================================
// ATTENDING EVENTS
// ============================================================================

/**
 * Example 7: Join an event
 */
export async function joinEvent(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // First check if already attending
  const { data: existing } = await supabase
    .from('event_attendees')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    console.log('Already attending this event');
    return existing;
  }

  const { data, error } = await supabase
    .from('event_attendees')
    .insert({
      event_id: eventId,
      user_id: user.id,
      status: 'accepted'
    })
    .select()
    .single();

  if (error) {
    console.error('Error joining event:', error);
    return null;
  }

  console.log('Joined event:', data);
  return data;
}

/**
 * Example 8: Leave an event
 */
export async function leaveEvent(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error leaving event:', error);
    return false;
  }

  console.log('Left event successfully');
  return true;
}

/**
 * Example 9: Check if user is attending an event
 */
export async function isUserAttending(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('event_attendees')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.status === 'accepted';
}

// ============================================================================
// UPDATING EVENTS
// ============================================================================

/**
 * Example 10: Update event details (only creator can do this)
 */
export async function updateEvent(eventId: string, updates: Partial<{
  title: string;
  description: string;
  event_date: string;
  location: string;
  status: 'upcoming' | 'completed' | 'canceled';
}>) {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('Error updating event:', error);
    return null;
  }

  console.log('Updated event:', data);
  return data;
}

/**
 * Example 11: Add friends to private event
 */
export async function addFriendsToPrivateEvent(eventId: string, newFriendIds: string[]) {
  // First get current allowed_friend_ids
  const { data: event } = await supabase
    .from('events')
    .select('allowed_friend_ids')
    .eq('id', eventId)
    .single();

  if (!event) return null;

  const currentFriends = event.allowed_friend_ids || [];
  const updatedFriends = [...new Set([...currentFriends, ...newFriendIds])];

  const { data, error } = await supabase
    .from('events')
    .update({ allowed_friend_ids: updatedFriends })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('Error adding friends:', error);
    return null;
  }

  console.log('Added friends to event:', data);
  return data;
}

/**
 * Example 12: Remove friends from private event
 */
export async function removeFriendsFromPrivateEvent(eventId: string, friendIdsToRemove: string[]) {
  const { data: event } = await supabase
    .from('events')
    .select('allowed_friend_ids')
    .eq('id', eventId)
    .single();

  if (!event) return null;

  const currentFriends = event.allowed_friend_ids || [];
  const updatedFriends = currentFriends.filter(id => !friendIdsToRemove.includes(id));

  const { data, error } = await supabase
    .from('events')
    .update({ allowed_friend_ids: updatedFriends })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('Error removing friends:', error);
    return null;
  }

  console.log('Removed friends from event:', data);
  return data;
}

// ============================================================================
// DELETING EVENTS
// ============================================================================

/**
 * Example 13: Delete an event (only creator can do this)
 */
export async function deleteEvent(eventId: string) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('Error deleting event:', error);
    return false;
  }

  console.log('Deleted event successfully');
  // Note: event_attendees are automatically deleted due to CASCADE
  return true;
}

/**
 * Example 14: Cancel an event (marks as canceled but keeps data)
 */
export async function cancelEvent(eventId: string) {
  return await updateEvent(eventId, { status: 'canceled' });
}

// ============================================================================
// ADVANCED QUERIES
// ============================================================================

/**
 * Example 15: Get upcoming events with friend details
 */
export async function getUpcomingEventsWithDetails() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get events
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'upcoming')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true });

  if (!events) return [];

  // Get attendee counts for each event
  const eventsWithDetails = await Promise.all(
    events.map(async (event) => {
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('user_id, status')
        .eq('event_id', event.id)
        .eq('status', 'accepted');

      const isAttending = attendees?.some(a => a.user_id === user.id) || false;

      return {
        ...event,
        attendee_count: attendees?.length || 0,
        is_attending: isAttending,
        is_owner: event.user_id === user.id
      };
    })
  );

  return eventsWithDetails;
}

/**
 * Example 16: Get all attendees for an event
 */
export async function getEventAttendees(eventId: string) {
  const { data, error } = await supabase
    .from('event_attendees')
    .select('user_id, status, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching attendees:', error);
    return [];
  }

  return data;
}

/**
 * Example 17: Search events by title
 */
export async function searchEvents(searchTerm: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .ilike('title', `%${searchTerm}%`)
    .eq('status', 'upcoming')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error searching events:', error);
    return [];
  }

  return data;
}

/**
 * Example 18: Get events happening in date range
 */
export async function getEventsInDateRange(startDate: Date, endDate: Date) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', startDate.toISOString())
    .lte('event_date', endDate.toISOString())
    .eq('status', 'upcoming')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return data;
}
