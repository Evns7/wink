# Calendar Comparison Feature

## Overview
The Calendar Comparison feature allows users to view their calendar alongside a friend's calendar to find overlapping free time slots. This is a core feature of the Wink app that helps friends coordinate activities.

## Architecture

### Components

#### 1. CalendarService (`src/services/calendarService.ts`)
The core service handling all calendar comparison logic:

**Key Methods:**
- `getUserEvents(userId, startDate, endDate)` - Fetch user's calendar events
- `getFriendEvents(friendId, startDate, endDate)` - Fetch friend's calendar events (requires friendship)
- `compareCalendars(userId, friendId, startDate, endDate)` - Compare calendars and return daily schedules with overlaps

**Data Structures:**
```typescript
interface TimeBlock {
  start: Date;
  end: Date;
  type: 'busy' | 'free' | 'overlap';
  eventTitle?: string;
}

interface DaySchedule {
  date: Date;
  userBlocks: TimeBlock[];
  friendBlocks?: TimeBlock[];
  overlapBlocks: TimeBlock[];
}
```

**Algorithm:**
1. Fetch events for both users in date range
2. For each day:
   - Convert events to busy time blocks
   - Calculate free time blocks (6 AM - 11 PM)
   - Find overlapping free time (minimum 30 minutes)
3. Return day-by-day schedule with visual indicators

#### 2. FriendSelector (`src/components/calendar/FriendSelector.tsx`)
Dropdown component for selecting a friend to compare calendars with:

**Features:**
- Search functionality for friends
- Visual indication of selected friend
- Clear selection button
- Loading states

#### 3. CalendarComparison (`src/components/calendar/CalendarComparison.tsx`)
Week view component displaying both calendars side by side:

**Features:**
- Week navigation (previous/next/today)
- Color-coded time blocks:
  - **Blue**: Busy times
  - **Gray**: Free times
  - **Green with ring**: Overlapping free time (both free)
- Two-layer layout per day:
  - Your Schedule (top)
  - Friend's Schedule (bottom)
  - Available Together (highlighted)

#### 4. Calendar Page (`src/pages/Calendar.tsx`)
Main calendar page with tabs:
- **Month View**: Traditional month calendar
- **Compare with Friend**: Calendar comparison feature

## Database Schema

### RLS Policies
```sql
-- Users can view friends' calendar events
CREATE POLICY "Users can view friends calendar events"
ON calendar_events FOR SELECT
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
```

## Security

### Permission Rules
1. **Friendship Required**: Can only view a friend's calendar if:
   - Both users have an accepted friendship
   - RLS policies enforce this at database level

2. **Privacy**:
   - Event details are shown for your own events
   - Friend's events only show busy/free status by default
   - Can be extended to show more details with explicit permission

## Usage Example

```typescript
import { calendarService } from '@/services/calendarService';

// Compare calendars for the next week
const startDate = new Date();
const endDate = new Date();
endDate.setDate(endDate.getDate() + 7);

const schedules = await calendarService.compareCalendars(
  currentUserId,
  friendId,
  startDate,
  endDate
);

// Find all overlapping free time
const overlaps = schedules.flatMap(day => day.overlapBlocks);
console.log(`Found ${overlaps.length} overlapping free time slots`);
```

## User Flow

1. **Navigate to Calendar** → Click "Calendar" in nav
2. **Switch to Compare Tab** → Click "Compare with Friend" tab
3. **Select a Friend** → Click dropdown and choose friend
4. **View Comparison** → See week view with:
   - Your calendar at top of each day
   - Friend's calendar below
   - Green-highlighted overlaps
5. **Navigate Weeks** → Use arrows or "Today" button
6. **Plan Activities** → Note overlapping free times for planning

## Performance Optimizations

1. **Efficient Queries**: Only fetch events in date range
2. **Client-side Processing**: Free/busy calculation done in browser
3. **Caching**: Calendar data cached per friend selection
4. **Lazy Loading**: Friend calendars only loaded when selected

## Future Enhancements

1. **Group Comparison**: Compare 3+ calendars simultaneously
2. **Smart Suggestions**: Auto-suggest best meeting times
3. **Calendar Sync**: Two-way sync with external calendars
4. **Privacy Settings**: Let users control what friends can see
5. **Recurring Events**: Better handling of recurring calendar items
6. **Time Zone Support**: Handle friends in different time zones
7. **Export**: Export overlapping times to ICS format

## Testing

To test the feature:

1. Create two user accounts
2. Add each other as friends and accept
3. Add calendar events to both accounts
4. Switch to Compare tab
5. Select the friend
6. Verify overlapping free time is highlighted

## Troubleshooting

**No friend's calendar showing:**
- Check friendship is accepted
- Verify RLS policies are active
- Check console for errors

**Overlaps not detected:**
- Ensure events are in the date range being viewed
- Check minimum 30-minute overlap requirement
- Verify time zone consistency

**Permission errors:**
- Confirm users are friends
- Check database RLS policies
- Verify JWT authentication
