import { supabase } from "@/integrations/supabase/client";

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  is_all_day: boolean;
}

export interface TimeBlock {
  start: Date;
  end: Date;
  type: 'busy' | 'free' | 'overlap';
  eventTitle?: string;
}

export interface DaySchedule {
  date: Date;
  userBlocks: TimeBlock[];
  friendBlocks?: TimeBlock[];
  overlapBlocks: TimeBlock[];
}

class CalendarService {
  /**
   * Fetch user's calendar events for a date range
   */
  async getUserEvents(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time');

    if (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Fetch friend's calendar events (requires friendship)
   */
  async getFriendEvents(friendId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', friendId)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time');

    if (error) {
      console.error('Error fetching friend events:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Convert events to busy time blocks for a specific day
   */
  private eventsToBlocks(events: CalendarEvent[], date: Date): TimeBlock[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return events
      .filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        return eventStart < dayEnd && eventEnd > dayStart;
      })
      .map(event => ({
        start: new Date(event.start_time),
        end: new Date(event.end_time),
        type: 'busy' as const,
        eventTitle: event.title,
      }));
  }

  /**
   * Calculate free time blocks for a day (assuming 6 AM to 11 PM working hours)
   */
  private calculateFreeBlocks(busyBlocks: TimeBlock[], date: Date): TimeBlock[] {
    const dayStart = new Date(date);
    dayStart.setHours(6, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 0, 0, 0);

    if (busyBlocks.length === 0) {
      return [{
        start: dayStart,
        end: dayEnd,
        type: 'free',
      }];
    }

    const sortedBusy = [...busyBlocks].sort((a, b) => a.start.getTime() - b.start.getTime());
    const freeBlocks: TimeBlock[] = [];

    // Check for free time before first event
    if (sortedBusy[0].start > dayStart) {
      freeBlocks.push({
        start: dayStart,
        end: sortedBusy[0].start,
        type: 'free',
      });
    }

    // Check for free time between events
    for (let i = 0; i < sortedBusy.length - 1; i++) {
      const currentEnd = sortedBusy[i].end;
      const nextStart = sortedBusy[i + 1].start;
      if (nextStart > currentEnd) {
        freeBlocks.push({
          start: currentEnd,
          end: nextStart,
          type: 'free',
        });
      }
    }

    // Check for free time after last event
    const lastBusy = sortedBusy[sortedBusy.length - 1];
    if (lastBusy.end < dayEnd) {
      freeBlocks.push({
        start: lastBusy.end,
        end: dayEnd,
        type: 'free',
      });
    }

    return freeBlocks;
  }

  /**
   * Find overlapping free time between user and friend
   */
  private findOverlaps(userFree: TimeBlock[], friendFree: TimeBlock[]): TimeBlock[] {
    const overlaps: TimeBlock[] = [];

    for (const userBlock of userFree) {
      for (const friendBlock of friendFree) {
        const overlapStart = new Date(Math.max(userBlock.start.getTime(), friendBlock.start.getTime()));
        const overlapEnd = new Date(Math.min(userBlock.end.getTime(), friendBlock.end.getTime()));

        // Check if there's actual overlap (at least 30 minutes)
        const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60);
        if (overlapMinutes >= 30) {
          overlaps.push({
            start: overlapStart,
            end: overlapEnd,
            type: 'overlap',
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Compare calendars for a date range and return daily schedules
   */
  async compareCalendars(
    userId: string,
    friendId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<DaySchedule[]> {
    // Fetch events
    const userEvents = await this.getUserEvents(userId, startDate, endDate);
    const friendEvents = friendId ? await this.getFriendEvents(friendId, startDate, endDate) : [];

    const schedules: DaySchedule[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      
      // Get events for this day
      const dayUserEvents = userEvents.filter(e => 
        new Date(e.start_time).toISOString().split('T')[0] === dateKey
      );
      const dayFriendEvents = friendEvents.filter(e => 
        new Date(e.start_time).toISOString().split('T')[0] === dateKey
      );

      // Convert to blocks
      const userBusyBlocks = this.eventsToBlocks(dayUserEvents, currentDate);
      const userFreeBlocks = this.calculateFreeBlocks(userBusyBlocks, currentDate);

      let friendBusyBlocks: TimeBlock[] = [];
      let friendFreeBlocks: TimeBlock[] = [];
      let overlapBlocks: TimeBlock[] = [];

      if (friendId && dayFriendEvents.length >= 0) {
        friendBusyBlocks = this.eventsToBlocks(dayFriendEvents, currentDate);
        friendFreeBlocks = this.calculateFreeBlocks(friendBusyBlocks, currentDate);
        overlapBlocks = this.findOverlaps(userFreeBlocks, friendFreeBlocks);
      }

      schedules.push({
        date: new Date(currentDate),
        userBlocks: [...userBusyBlocks, ...userFreeBlocks],
        friendBlocks: friendId ? [...friendBusyBlocks, ...friendFreeBlocks] : undefined,
        overlapBlocks,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedules;
  }
}

export const calendarService = new CalendarService();
