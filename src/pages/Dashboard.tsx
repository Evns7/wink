import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cloud, Sun, CloudRain, Wind, MapPin, Calendar, Sparkles } from "lucide-react";
import ActivityCard from "@/components/ActivityCard";
import WeatherWidget from "@/components/WeatherWidget";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const [timeOfDay, setTimeOfDay] = useState<'sunrise' | 'afternoon' | 'sunset' | 'night'>('afternoon');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) setTimeOfDay('sunrise');
    else if (hour >= 10 && hour < 17) setTimeOfDay('afternoon');
    else if (hour >= 17 && hour < 20) setTimeOfDay('sunset');
    else setTimeOfDay('night');
  }, []);

  const gradientClass = {
    sunrise: 'bg-gradient-sunrise',
    afternoon: 'bg-gradient-afternoon',
    sunset: 'bg-gradient-sunset',
    night: 'bg-gradient-night',
  }[timeOfDay];

  // Mock data for activities
  const activities = [
    {
      id: 1,
      title: "Coffee at The Daily Grind",
      category: "food",
      duration: 45,
      travelTime: 12,
      price: 15,
      weatherMatch: 0.9,
      description: "Cozy café with excellent espresso and pastries",
      image: "☕",
    },
    {
      id: 2,
      title: "Yoga Class at Zen Studio",
      category: "sports",
      duration: 60,
      travelTime: 20,
      price: 25,
      weatherMatch: 1.0,
      description: "Indoor yoga session perfect for any weather",
      image: "🧘",
    },
    {
      id: 3,
      title: "Browse Books at Chapter One",
      category: "studying",
      duration: 90,
      travelTime: 15,
      price: 0,
      weatherMatch: 1.0,
      description: "Large independent bookstore with café",
      image: "📚",
    },
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className={`min-h-screen ${gradientClass} transition-smooth`}>
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
