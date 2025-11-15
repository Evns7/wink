import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles, Users, Cloud } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const Index = () => {
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

  return (
    <div className={`min-h-screen ${gradientClass} transition-smooth`}>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Sparkles className="w-12 h-12 text-primary" />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Wink
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Turn your free moments into
            <span className="text-primary"> meaningful moments</span>
          </p>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Intelligent scheduling meets personalized recommendations. 
            Wink analyzes your calendar, weather, and preferences to suggest 
            the perfect activities for your free time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8 py-6 rounded-2xl shadow-lg hover:shadow-xl transition-smooth">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-2xl glass">
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Feature 1 */}
          <div className="glass rounded-3xl p-8 space-y-4 hover:scale-105 transition-smooth">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Smart Scheduling</h3>
            <p className="text-muted-foreground">
              Automatically detects free time in your calendar and suggests activities that fit perfectly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass rounded-3xl p-8 space-y-4 hover:scale-105 transition-smooth">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Cloud className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-2xl font-bold">Weather-Aware</h3>
            <p className="text-muted-foreground">
              Get recommendations that match the weather—indoor activities for rainy days, outdoor for sunshine.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass rounded-3xl p-8 space-y-4 hover:scale-105 transition-smooth">
            <div className="w-14 h-14 rounded-2xl bg-category-sports/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-category-sports" />
            </div>
            <h3 className="text-2xl font-bold">Friend Matching</h3>
            <p className="text-muted-foreground">
              Sync calendars with friends to find shared free time and plan activities together.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          
          <div className="space-y-6">
            {[
              { num: "1", title: "Connect Your Calendar", desc: "Link your Google Calendar to automatically sync your schedule" },
              { num: "2", title: "Set Your Preferences", desc: "Tell us what you enjoy—food, sports, shopping, or studying" },
              { num: "3", title: "Get Smart Suggestions", desc: "Receive personalized activity recommendations for your free time" },
              { num: "4", title: "Make Plans Happen", desc: "One-tap to add activities to your calendar and invite friends" }
            ].map((step) => (
              <div key={step.num} className="glass rounded-2xl p-6 flex items-start gap-6">
                <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-3xl mx-auto glass rounded-3xl p-12 text-center space-y-6">
          <h2 className="text-4xl font-bold">Ready to make the most of your time?</h2>
          <p className="text-xl text-muted-foreground">
            Join thousands discovering meaningful activities every day
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-lg px-8 py-6 rounded-2xl shadow-lg">
              Start Your Journey <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
