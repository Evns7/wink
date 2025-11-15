import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SwipeableActivityCard } from "@/components/SwipeableActivityCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Calendar as CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";

interface Activity {
  id: string;
  name: string;
  category: string;
  address: string;
  price_level: number;
  distance: number;
  lat: number;
  lng: number;
  match_score?: number;
  totalScore?: number;
  score_breakdown?: {
    preference: number;
    time_fit: number;
    weather: number;
    budget: number;
    proximity: number;
    duration: number;
  };
  ai_reasoning?: string | null;
  insider_tip?: string | null;
}

interface ActivitySuggestion {
  activity: Activity;
  suggestedTime: string;
  context?: any;
}

export default function MakePlans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [acceptedActivities, setAcceptedActivities] = useState<ActivitySuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const generateSuggestions = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setLoading(true);
    setSuggestions([]);
    setAcceptedActivities([]);
    setCurrentIndex(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      // Analyze user's availability
      const { data: availabilityData, error: availabilityError } = await supabase.functions.invoke(
        'analyze-group-availability',
        {
          body: {
            friendIds: [],
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );

      if (availabilityError) throw availabilityError;

      const freeBlocks = availabilityData.freeBlocks || [];
      if (freeBlocks.length === 0) {
        toast.info("No free time found", {
          description: "Your schedule is fully booked!",
        });
        return;
      }

      // Get recommendations for the first available time block
      const block = freeBlocks[0];
      
      const { data, error } = await supabase.functions.invoke(
        'smart-activity-recommendations',
        {
          body: {
            freeBlock: block,
            weather: { temp: 15, isRaining: false },
          },
        }
      );

      if (error) throw error;

      const recommendations = data.recommendations || [];
      const limitedRecommendations = recommendations.slice(0, 5);

      const newSuggestions: ActivitySuggestion[] = limitedRecommendations.map((rec: any) => ({
        activity: {
          id: rec.id,
          name: rec.name,
          category: rec.category,
          address: rec.address || 'Address not available',
          price_level: rec.price_level,
          distance: rec.distance || 0,
          lat: rec.lat,
          lng: rec.lng,
          match_score: rec.match_score,
          totalScore: rec.total_score || rec.match_score,
          score_breakdown: rec.score_breakdown,
          ai_reasoning: rec.ai_reasoning,
          insider_tip: rec.insider_tip,
        },
        suggestedTime: block.start,
        context: {
          score_breakdown: rec.score_breakdown,
          total_score: rec.total_score || rec.match_score,
          time_block: block,
        },
      }));

      setSuggestions(newSuggestions);

      if (newSuggestions.length === 0) {
        toast.info("No recommendations found");
      } else {
        toast.success(`Found ${newSuggestions.length} activities!`);
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error("Failed to generate suggestions");
    } finally {
      setIsGenerating(false);
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: "left" | "right") => {
    if (currentIndex >= suggestions.length) return;

    const suggestion = suggestions[currentIndex];

    if (direction === "right") {
      setAcceptedActivities(prev => [...prev, suggestion]);
      toast.success("Activity saved!", {
        description: acceptedActivities.length + 1 >= 3 
          ? "You can now add them to your calendar!" 
          : `${suggestion.activity.name} added`,
      });
    }

    setCurrentIndex(prev => prev + 1);
  };

  const addToCalendar = async () => {
    if (acceptedActivities.length === 0) return;

    setLoading(true);
    try {
      for (const activity of acceptedActivities) {
        const { error } = await supabase.functions.invoke('create-calendar-event', {
          body: {
            activityName: activity.activity.name,
            activityAddress: activity.activity.address,
            startTime: activity.suggestedTime,
            duration: 120,
          },
        });

        if (error) {
          console.error('Error adding to calendar:', error);
        }
      }

      toast.success("Added to calendar!", {
        description: `${acceptedActivities.length} activities scheduled`,
      });

      setAcceptedActivities([]);
      setSuggestions([]);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error adding to calendar:', error);
      toast.error("Failed to add to calendar");
    } finally {
      setLoading(false);
    }
  };

  const currentSuggestion = suggestions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Discover Activities</h1>
          <p className="text-muted-foreground">Swipe right to save, left to pass</p>
        </div>

        {/* Accepted activities banner */}
        {acceptedActivities.length > 0 && (
          <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">{acceptedActivities.length} saved</span>
              </div>
              {acceptedActivities.length >= 3 && (
                <Button
                  onClick={addToCalendar}
                  disabled={loading}
                  size="sm"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Add to Calendar
                </Button>
              )}
            </div>
          </Card>
        )}

        {suggestions.length === 0 ? (
          <Card className="p-12 text-center space-y-6">
            <Sparkles className="w-16 h-16 mx-auto text-primary" />
            <div>
              <h2 className="text-2xl font-semibold mb-2">Ready to discover?</h2>
              <p className="text-muted-foreground mb-6">
                Get personalized activities based on your free time and preferences
              </p>
            </div>
            <Button
              size="lg"
              onClick={generateSuggestions}
              disabled={isGenerating}
              className="w-full max-w-xs mx-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finding activities...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 w-4 mr-2" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </Card>
        ) : currentIndex >= suggestions.length ? (
          <Card className="p-12 text-center space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">All done!</h2>
              <p className="text-muted-foreground mb-6">
                {acceptedActivities.length > 0
                  ? `You've saved ${acceptedActivities.length} activities`
                  : "You've reviewed all suggestions"}
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {acceptedActivities.length >= 3 && (
                <Button
                  size="lg"
                  onClick={addToCalendar}
                  disabled={loading}
                >
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Add {acceptedActivities.length} to Calendar
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onClick={generateSuggestions}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding more...
                  </>
                ) : (
                  "Get More"
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="relative" style={{ height: "600px" }}>
            {suggestions.slice(currentIndex, currentIndex + 3).map((suggestion, index) => (
              <div
                key={`${suggestion.activity.id}-${index}`}
                style={{
                  position: "absolute",
                  width: "100%",
                  zIndex: 3 - index,
                  scale: 1 - index * 0.05,
                  opacity: index === 0 ? 1 : 0.5,
                  pointerEvents: index === 0 ? "auto" : "none",
                }}
              >
                <SwipeableActivityCard
                  activity={suggestion.activity}
                  friendName="You"
                  suggestedTime={suggestion.suggestedTime}
                  onSwipe={handleSwipe}
                />
              </div>
            ))}
          </div>
        )}

        {currentSuggestion && (
          <div className="flex justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSwipe("left")}
              disabled={loading}
              className="w-32"
            >
              <X className="h-5 w-5 mr-2" />
              Pass
            </Button>
            <Button
              size="lg"
              onClick={() => handleSwipe("right")}
              disabled={loading}
              className="w-32"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="text-center mt-6 text-sm text-muted-foreground">
            {currentIndex + 1} / {suggestions.length}
          </div>
        )}
      </div>
    </div>
  );
}
