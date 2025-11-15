import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, MapPin, LogOut } from "lucide-react";
import ActivityCard from "@/components/ActivityCard";
import WeatherWidget from "@/components/WeatherWidget";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeOfDay, setTimeOfDay] = useState<'sunrise' | 'afternoon' | 'sunset' | 'night'>('afternoon');
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);

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
    setLoading(false);
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
      const redirectUri = `${window.location.origin}/auth`;
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
        body: { action: 'get_auth_url', redirectUri }
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
            <div className="space-y-3">
              {/* Mock calendar events */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">9:00 AM</div>
                  <div className="text-sm font-medium">10:30 AM</div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Team Meeting</div>
                  <div className="text-sm text-muted-foreground">Conference Room A</div>
                </div>
                <div className="w-2 h-full bg-primary rounded-full"></div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-accent/10 border-2 border-accent/30">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">10:30 AM</div>
                  <div className="text-sm font-medium">2:00 PM</div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-accent">⏰ Free Time - 3.5 hours</div>
                  <div className="text-sm text-muted-foreground">Perfect for activities!</div>
                </div>
                <Sparkles className="w-6 h-6 text-accent" />
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">2:00 PM</div>
                  <div className="text-sm font-medium">4:00 PM</div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Client Presentation</div>
                  <div className="text-sm text-muted-foreground">Zoom Call</div>
                </div>
                <div className="w-2 h-full bg-category-shopping rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Activities */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Perfect for Your 3.5 Hour Window</h2>
            <Button className="rounded-xl">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Wildcard Ideas
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
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
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 rounded-xl">
                <Sparkles className="w-6 h-6" />
                <span>Surprise Me</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
