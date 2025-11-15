import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, MapPin, LogOut } from "lucide-react";
import ActivityCard from "@/components/ActivityCard";
import WeatherWidget from "@/components/WeatherWidget";
import { FriendsList } from "@/components/FriendsList";
import { EventsList } from "@/components/events/EventsList";
import { SmartRecommendations } from "@/components/SmartRecommendations";
import { WildcardRecommendations } from "@/components/WildcardRecommendations";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeOfDay, setTimeOfDay] = useState<'sunrise' | 'afternoon' | 'sunset' | 'night'>('afternoon');
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) setTimeOfDay('sunrise');
    else if (hour >= 10 && hour < 17) setTimeOfDay('afternoon');
    else if (hour >= 17 && hour < 20) setTimeOfDay('sunset');
    else setTimeOfDay('night');

    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profileData || !profileData.home_lat || !profileData.home_lng) {
      navigate('/onboarding');
      return;
    }

    setProfile(profileData);

    const { data: calendarData } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    setCalendarConnected(!!calendarData);

    await fetchActivities(profileData.home_lat, profileData.home_lng);
    await fetchTodayEvents();
    setLoading(false);
  };

  const fetchTodayEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      setTodayEvents(data || []);
    } catch (error) {
      console.error('Error fetching today events:', error);
    }
  };

  const fetchActivities = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-nearby-activities', {
        body: { lat, lng, radius: 1000 }
      });

      if (error) throw error;

      setActivities(data.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        variant: "destructive",
        title: "Could not load activities",
        description: "Trying with a smaller search area. Please wait...",
      });
      setActivities([]); // Clear activities on error
    } finally {
      setLoading(false);
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

  const handleSyncCalendar = async () => {
    try {
      const { error } = await supabase.functions.invoke('sync-calendar-events');

      if (error) throw error;

      // Refetch today's events after sync
      await fetchTodayEvents();

      toast({
        title: "Calendar Synced!",
        description: "Your events have been updated from Google Calendar.",
      });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Could not sync calendar events.",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{greeting()}! ✨</h1>
          <p className="text-xl text-muted-foreground">Here's what's perfect for your free time today</p>
        </div>

        {/* Weather Widget */}
        <div className="mb-8">
          <WeatherWidget />
        </div>

        {/* Smart Recommendations - Main Feature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <SmartRecommendations />
        </motion.div>

        {/* Friends List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <FriendsList />
        </motion.div>

        {/* Events List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <EventsList />
        </motion.div>

        {/* Today's Schedule Preview */}
        <Card className="glass mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              Today's Schedule
            </CardTitle>
            <Link to="/calendar">
              <Button variant="ghost" className="rounded-xl">View Full Calendar</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todayEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {calendarConnected ? "No events scheduled for today" : "Connect your calendar to see today's schedule"}
              </p>
            ) : (
              <div className="space-y-3">
                {todayEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                    <div className="text-center min-w-[80px]">
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                      <div className="text-sm font-medium">
                        {new Date(event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{event.title}</div>
                      {event.location && (
                        <div className="text-sm text-muted-foreground">{event.location}</div>
                      )}
                    </div>
                    <div className="w-2 h-12 bg-primary rounded-full"></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended Activities */}
        <div className="mb-8">
          {activities.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Nearby Activities</h2>
                <Link to="/make-plans">
                  <Button className="rounded-xl">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Make Plans with Friends
                  </Button>
                </Link>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.slice(0, 6).map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 rounded-xl">
                <MapPin className="w-6 h-6" />
                <span>Find Nearby</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 rounded-xl">
                <Calendar className="w-6 h-6" />
                <span>Next Free Slot</span>
              </Button>
              <WildcardRecommendations />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
