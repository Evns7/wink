import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string | null;
  location: string | null;
}

const Calendar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => {
    checkAuthAndFetchEvents();
  }, []);

  const checkAuthAndFetchEvents = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    // Check if calendar is connected
    const { data: calendarData } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    setCalendarConnected(!!calendarData);

    // Fetch calendar events
    await fetchCalendarEvents();
  };

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      toast({
        variant: "destructive",
        title: "Could not load events",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-calendar-events');

      if (error) throw error;

      await fetchCalendarEvents();
      
      toast({
        title: "Calendar Synced!",
        description: "Your events have been updated.",
      });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Could not sync calendar events.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
        body: { action: 'get_auth_url' }
      });

      if (error) throw error;
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Could not connect to Google Calendar.",
      });
    }
  };

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Group events by day
  const eventsByDay: { [key: number]: CalendarEvent[] } = {};
  events.forEach(event => {
    const eventDate = parseISO(event.start_time);
    if (eventDate.getMonth() === currentDate.getMonth() && 
        eventDate.getFullYear() === currentDate.getFullYear()) {
      const day = eventDate.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <Header />
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Calendar</h1>
            <p className="text-lg text-muted-foreground">Manage your schedule and find free time</p>
          </div>
          <div className="flex gap-3">
            {!calendarConnected ? (
              <Button onClick={handleConnectCalendar} className="rounded-xl">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            ) : (
              <Button 
                onClick={handleSyncCalendar} 
                disabled={syncing}
                className="rounded-xl"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Calendar'}
              </Button>
            )}
          </div>
        </div>

        {!calendarConnected && (
          <Card className="glass mb-8 border-accent/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-accent" />
                <h3 className="text-xl font-semibold mb-2">Connect Your Calendar</h3>
                <p className="text-muted-foreground mb-4">
                  Sync your Google Calendar to see your events and find free time for activities
                </p>
                <Button onClick={handleConnectCalendar} className="rounded-xl">
                  Connect Google Calendar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar Card */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={previousMonth} className="rounded-xl">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-xl">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                <div key={`empty-${index}`} className="h-24 rounded-xl" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const isToday = 
                  day === new Date().getDate() &&
                  currentDate.getMonth() === new Date().getMonth() &&
                  currentDate.getFullYear() === new Date().getFullYear();
                const dayEvents = eventsByDay[day] || [];

                return (
                  <div
                    key={day}
                    className={`h-24 rounded-xl p-2 border-2 transition-smooth hover:scale-105 cursor-pointer ${
                      isToday
                        ? "bg-primary/10 border-primary"
                        : dayEvents.length > 0
                        ? "bg-card border-border"
                        : "bg-muted/30 border-transparent"
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${isToday ? "text-primary" : ""}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-1 rounded bg-primary/10 text-primary truncate"
                          title={event.title}
                        >
                          {format(parseISO(event.start_time), 'HH:mm')}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading events...</div>
          ) : events.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-8 text-center text-muted-foreground">
                {calendarConnected 
                  ? "No upcoming events. Sync your calendar to see your schedule."
                  : "Connect your calendar to see your upcoming events."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {events
                .filter(event => new Date(event.start_time) >= new Date())
                .slice(0, 6)
                .map((event) => {
                  const eventDate = parseISO(event.start_time);
                  return (
                    <Card key={event.id} className="glass">
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-2xl font-bold text-primary">
                            {format(eventDate, 'd')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(eventDate, 'MMM')}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{event.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(eventDate, 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                          </p>
                          {event.location && (
                            <p className="text-sm text-muted-foreground mt-1">{event.location}</p>
                          )}
                        </div>
                        <Badge className="bg-primary/10 text-primary">
                          Scheduled
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>

        {/* Free Time Analysis */}
        {events.length > 0 && (
          <Card className="glass mt-8">
            <CardHeader>
              <CardTitle>Free Time Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-muted-foreground">
                  Based on your calendar, you have free time slots available for activities.
                  Check the dashboard for personalized recommendations!
                </p>
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  className="mt-4 rounded-xl"
                >
                  View Recommendations
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Calendar;
