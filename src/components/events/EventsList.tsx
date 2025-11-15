import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EventCard } from "./EventCard";
import { CreateEventDialog } from "./CreateEventDialog";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  event_type: 'private' | 'open';
  status: 'upcoming' | 'completed' | 'canceled';
  user_id: string;
  created_at: string;
}

interface EventWithAttendance extends Event {
  attendee_count: number;
  user_is_attending: boolean;
}

export const EventsList = () => {
  const [myEvents, setMyEvents] = useState<EventWithAttendance[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<EventWithAttendance[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    setFriends(data || []);
  };

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Fetching events for user:', user.id);

      // Fetch all visible events
      const { data: rawEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        throw eventsError;
      }

      // Cast to proper type
      const events = (rawEvents || []) as Event[];
      
      console.log('Found events:', events);

      // Fetch attendance data for all events
      const eventIds = events?.map(e => e.id) || [];
      
      const { data: attendees, error: attendeesError } = await supabase
        .from('event_attendees')
        .select('event_id, user_id, status')
        .in('event_id', eventIds);

      if (attendeesError) {
        console.error('Error fetching attendees:', attendeesError);
      }

      // Process events with attendance info
      const eventsWithAttendance: EventWithAttendance[] = (events || []).map(event => {
        const eventAttendees = attendees?.filter(a => a.event_id === event.id && a.status === 'accepted') || [];
        const userAttendee = attendees?.find(a => a.event_id === event.id && a.user_id === user.id);
        
        return {
          ...event,
          attendee_count: eventAttendees.length,
          user_is_attending: userAttendee?.status === 'accepted',
        };
      });

      // Split into my events and invited events
      const mine = eventsWithAttendance.filter(e => e.user_id === user.id);
      const invited = eventsWithAttendance.filter(e => e.user_id !== user.id);

      console.log('My events:', mine);
      console.log('Invited to events:', invited);

      setMyEvents(mine);
      setInvitedEvents(invited);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        variant: "destructive",
        title: "Failed to load events",
        description: "Please try refreshing the page.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Joining event:', eventId);

      const { error } = await supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          user_id: user.id,
          status: 'accepted',
        });

      if (error) {
        console.error('Error joining event:', error);
        throw error;
      }

      toast({
        title: "Joined event!",
        description: "You've successfully joined the event.",
      });

      fetchEvents();
    } catch (error) {
      console.error('Error joining event:', error);
      toast({
        variant: "destructive",
        title: "Failed to join event",
        description: "Please try again.",
      });
    }
  };

  const handleLeaveEvent = async (eventId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Leaving event:', eventId);

      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving event:', error);
        throw error;
      }

      toast({
        title: "Left event",
        description: "You've left the event.",
      });

      fetchEvents();
    } catch (error) {
      console.error('Error leaving event:', error);
      toast({
        variant: "destructive",
        title: "Failed to leave event",
        description: "Please try again.",
      });
    }
  };

  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading events...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Events</CardTitle>
          </div>
          <CreateEventDialog friends={friends} onEventCreated={fetchEvents} />
        </div>
        <CardDescription>
          Create and manage your events
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="my-events" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-events">
              My Events ({myEvents.length})
            </TabsTrigger>
            <TabsTrigger value="invited">
              Invited ({invitedEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-events" className="space-y-4 mt-4">
            {myEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No events yet. Create your first event!
              </p>
            ) : (
              <div className="grid gap-4">
                {myEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isOwner={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invited" className="space-y-4 mt-4">
            {invitedEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No invitations yet. Your friends will invite you to events!
              </p>
            ) : (
              <div className="grid gap-4">
                {invitedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isOwner={false}
                    onJoin={handleJoinEvent}
                    onLeave={handleLeaveEvent}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
