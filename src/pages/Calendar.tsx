import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FriendSelector } from "@/components/calendar/FriendSelector";
import { CalendarComparison } from "@/components/calendar/CalendarComparison";

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
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const handleMakePlansWithBlocks = (blocks: any[]) => {
    // Navigate to make plans page - the page will handle loading recommendations
    toast({
      title: "Navigating to Make Plans",
      description: `Found ${blocks.length} time blocks where you're both free`,
    });
    navigate('/make-plans');
  };

  useEffect(() => {
    checkAuthAndFetchEvents();
  }, []);

  const checkAuthAndFetchEvents = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: calendarData } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    setCalendarConnected(!!calendarData);
    await fetchCalendarEvents();
  };

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Only fetch current user's calendar events
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
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
      toast({ title: "Calendar Synced!", description: "Your events have been updated." });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not sync calendar events." });
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
      toast({ variant: "destructive", title: "Connection Failed", description: "Could not connect to Google Calendar." });
    }
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const eventsByDay: { [key: number]: CalendarEvent[] } = {};
  events.forEach(event => {
    const eventDate = parseISO(event.start_time);
    if (eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear()) {
      const day = eventDate.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <Header />
      <div className="container mx-auto p-8">
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
              <Button onClick={handleSyncCalendar} disabled={syncing} className="rounded-xl">
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

        <Tabs defaultValue="month" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto">
            <TabsTrigger value="month">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Month View
            </TabsTrigger>
            <TabsTrigger value="compare">
              <Users className="w-4 h-4 mr-2" />
              Compare with Friend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compare" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Compare Calendars</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select a friend to view their calendar and find overlapping free time
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <FriendSelector selectedFriendId={selectedFriendId} onSelectFriend={setSelectedFriendId} />
                <CalendarComparison 
                  selectedFriendId={selectedFriendId} 
                  onMakePlansWithBlocks={handleMakePlansWithBlocks}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="month">
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
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                    <div key={`empty-${index}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, index) => {
                    const day = index + 1;
                    const dayEvents = eventsByDay[day] || [];
                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                    return (
                      <div key={day} className={`aspect-square p-2 rounded-xl border transition-all hover:border-primary/50 ${isToday ? "bg-primary/10 border-primary" : "bg-card/50 border-border/50"}`}>
                        <div className="text-sm font-semibold mb-1">{day}</div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div key={event.id} className="text-xs p-1 bg-primary/20 text-foreground rounded" title={event.title}>
                              <div className="font-semibold truncate">{event.title}</div>
                              <div className="text-xs opacity-70">{format(parseISO(event.start_time), 'HH:mm')}</div>
                            </div>
                          ))}
                          {dayEvents.length > 2 && <div className="text-xs text-muted-foreground">+{dayEvents.length - 2} more</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="glass mt-8">
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events.filter(event => new Date(event.start_time) >= new Date()).slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex flex-col items-center justify-center">
                          <div className="text-xs font-semibold">{format(parseISO(event.start_time), 'MMM')}</div>
                          <div className="text-lg font-bold">{format(parseISO(event.start_time), 'd')}</div>
                        </div>
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                        </p>
                        {event.location && <p className="text-sm text-muted-foreground mt-1">📍 {event.location}</p>}
                      </div>
                    </div>
                  ))}
                  {events.filter(event => new Date(event.start_time) >= new Date()).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No upcoming events</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Calendar;
