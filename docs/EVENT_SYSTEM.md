# Event System Documentation

## Overview

The event system allows users to create, manage, and join events with two distinct visibility types: **Private** and **Open** events.

## Event Types

### 1. Private Events
- **Visibility**: Only visible to the event creator and manually selected friends
- **Who can join**: Only users specifically invited by the creator
- **Use case**: Birthday parties, small gatherings, exclusive meetups

### 2. Open Events
- **Visibility**: Automatically visible to all of the user's friends
- **Who can join**: Any friend can view and join without invitation
- **Use case**: Public meetups, community events, large gatherings

## Database Schema

### `events` Table

```sql
CREATE TABLE public.events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,              -- Event creator
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  event_type TEXT NOT NULL,           -- 'private' or 'open'
  status TEXT NOT NULL,               -- 'upcoming', 'completed', 'canceled'
  allowed_friend_ids UUID[],          -- For private events only
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### `event_attendees` Table

```sql
CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL,               -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(event_id, user_id)
);
```

## Row Level Security (RLS) Policies

### Events Visibility

Users can view events if ANY of these conditions are true:
1. They are the event creator
2. The event is **open** AND they are friends with the creator
3. The event is **private** AND their user ID is in `allowed_friend_ids`

### Attendee Management

- Users can join any event they can view
- Users can update their own attendance status
- Users can leave events they've joined
- Event creators are automatically added as attendees

## Frontend Components

### `CreateEventDialog`
**Location**: `src/components/events/CreateEventDialog.tsx`

Dialog component for creating new events with:
- Event details form (title, description, date, location)
- Private/Open toggle switch
- Friend selection UI (for private events)
- Form validation and error handling

**Props**:
```typescript
interface CreateEventDialogProps {
  friends: Friend[];           // List of user's friends
  onEventCreated: () => void;  // Callback after event creation
}
```

### `EventCard`
**Location**: `src/components/events/EventCard.tsx`

Display component for individual events showing:
- Event type indicator (lock icon for private, globe for open)
- Event details (title, description, date, location)
- Status badge (upcoming, completed, canceled)
- Attendee count
- Action buttons (Join/Leave/View Details)

**Props**:
```typescript
interface EventCardProps {
  event: Event;
  isOwner: boolean;
  onJoin?: (eventId: string) => void;
  onLeave?: (eventId: string) => void;
  onViewDetails?: (eventId: string) => void;
}
```

### `EventsList`
**Location**: `src/components/events/EventsList.tsx`

Main container component that:
- Fetches and displays all visible events
- Separates "My Events" from "Invited" events using tabs
- Handles join/leave functionality
- Integrates CreateEventDialog
- Auto-refreshes on event actions

## Usage Examples

### Creating an Open Event

```typescript
// In CreateEventDialog component
const eventData = {
  user_id: currentUser.id,
  title: "Weekend BBQ",
  description: "Join us for a fun BBQ!",
  event_date: "2025-11-20T14:00:00Z",
  location: "Central Park",
  event_type: 'open',           // Visible to all friends
  allowed_friend_ids: [],       // Empty for open events
  status: 'upcoming',
};

await supabase.from('events').insert(eventData);
```

### Creating a Private Event

```typescript
const eventData = {
  user_id: currentUser.id,
  title: "Birthday Party",
  description: "My 30th birthday celebration",
  event_date: "2025-12-05T19:00:00Z",
  location: "My Place",
  event_type: 'private',        // Only visible to invited friends
  allowed_friend_ids: [         // Specific friends invited
    'friend-uuid-1',
    'friend-uuid-2',
    'friend-uuid-3'
  ],
  status: 'upcoming',
};

await supabase.from('events').insert(eventData);
```

### Fetching Events for Current User

```typescript
// Query automatically respects RLS policies
const { data: events } = await supabase
  .from('events')
  .select('*')
  .order('event_date', { ascending: true });

// Returns:
// - All events created by the user
// - Open events from friends
// - Private events where user is in allowed_friend_ids
```

### Joining an Event

```typescript
const { error } = await supabase
  .from('event_attendees')
  .insert({
    event_id: eventId,
    user_id: currentUser.id,
    status: 'accepted',
  });
```

### Leaving an Event

```typescript
const { error } = await supabase
  .from('event_attendees')
  .delete()
  .eq('event_id', eventId)
  .eq('user_id', currentUser.id);
```

### Fetching Event Attendees

```typescript
const { data: attendees } = await supabase
  .from('event_attendees')
  .select(`
    *,
    user:user_id (
      email
    )
  `)
  .eq('event_id', eventId)
  .eq('status', 'accepted');
```

## Security Features

### Backend Security
- All database operations protected by RLS policies
- Users can only modify events they created
- Visibility automatically enforced at database level
- SQL injection protection via parameterized queries

### Frontend Validation
- Form validation before submission
- Date must be in the future
- Private events require at least one invited friend
- Duplicate attendance prevention

## Best Practices

1. **Always check authentication** before event operations
2. **Validate event_type** matches the allowed_friend_ids logic
3. **Use transactions** when creating events with attendees
4. **Add indexes** on frequently queried columns (user_id, event_date)
5. **Handle timezone conversions** properly for event_date
6. **Provide clear error messages** to users
7. **Refresh event lists** after mutations

## Performance Considerations

### Indexes
The following indexes are created for optimal performance:
- `idx_events_user_id` on `events(user_id)`
- `idx_events_event_type` on `events(event_type)`
- `idx_events_event_date` on `events(event_date)`
- `idx_events_status` on `events(status)`
- `idx_event_attendees_event_id` on `event_attendees(event_id)`
- `idx_event_attendees_user_id` on `event_attendees(user_id)`

### Query Optimization
- Use `.select('*')` with specific filters instead of fetching all data
- Combine queries when possible (e.g., fetch events with attendees in one query)
- Cache friend lists to avoid repeated lookups

## Future Enhancements

Potential features to add:
- Event invitations system with accept/decline
- Event reminders and notifications
- Recurring events
- Event categories/tags
- Photo uploads for events
- Event comments/discussion
- Event capacity limits
- RSVP deadline
- Event analytics (view count, popular events)
- Event sharing to external platforms

## Troubleshooting

### Events not visible to friends
- Check friendship status is 'accepted'
- Verify event_type is set correctly
- For private events, ensure friend ID is in allowed_friend_ids array
- Check RLS policies are enabled

### Cannot join event
- Verify user can view the event (visibility rules)
- Check if already attending (unique constraint on event_id + user_id)
- Ensure event status is 'upcoming'

### Permission errors
- Confirm user is authenticated
- Check RLS policies allow the operation
- Verify user_id matches authenticated user
