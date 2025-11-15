import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SwipeableActivityCard } from "@/components/SwipeableActivityCard";
import { FriendSelector } from "@/components/calendar/FriendSelector";
import { TimeBlockSelector } from "@/components/calendar/TimeBlockSelector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, MapPin, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { calculateMidpoint } from "@/services/locationService";
import { generateMapsPinUrl } from "@/lib/mapsUtils";

interface Activity {
  id: string;
  name: string;
  category: string;
  address: string;
  price_level: number;
  distance: number;
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
  friendId: string;
  friendEmail: string;
  suggestedTime: string;
  context?: {
    score_breakdown?: any;
    total_score?: number;
    weather_conditions?: any;
    time_block?: any;
    ai_reasoning?: string | null;
    insider_tip?: string | null;
  };
}

interface TimeBlock {
  start: string;
  end: string;
  duration: number;
}

export default function MakePlans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock | null>(null);
  const [loadingTimeBlocks, setLoadingTimeBlocks] = useState(false);
  const [midpoint, setMidpoint] = useState<{ lat: number; lng: number } | null>(null);
  const [friendName, setFriendName] = useState<string>("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  // Fetch time blocks when friend is selected
  useEffect(() => {
    if (selectedFriendId) {
      fetchTimeBlocks();
      fetchFriendDetails();
    } else {
      setTimeBlocks([]);
      setSelectedTimeBlock(null);
      setMidpoint(null);
      setFriendName("");
    }
  }, [selectedFriendId]);

  // Calculate midpoint when both user and friend locations are available
  useEffect(() => {
    if (selectedFriendId && selectedTimeBlock) {
      calculateMidpointLocation();
    }
  }, [selectedFriendId, selectedTimeBlock]);

  const fetchFriendDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', selectedFriendId)
        .single();
      
      if (error) throw error;
      setFriendName(data?.nickname || 'Friend');
    } catch (error) {
      console.error('Error fetching friend details:', error);
    }
  };

  const fetchTimeBlocks = async () => {
    if (!selectedFriendId) return;
    
    setLoadingTimeBlocks(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const { data, error } = await supabase.functions.invoke(
        'analyze-group-availability',
        {
          body: {
            friendIds: [selectedFriendId],
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );

      if (error) throw error;

      const freeBlocks = data.freeBlocks || [];
      setTimeBlocks(freeBlocks);

      if (freeBlocks.length === 0) {
        toast.info("No overlapping free time found", {
          description: "Try selecting a different friend or check your calendar.",
        });
      }
    } catch (error) {
      console.error('Error fetching time blocks:', error);
      toast.error("Failed to fetch available times");
    } finally {
      setLoadingTimeBlocks(false);
    }
  };

  const calculateMidpointLocation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [userProfile, friendProfile] = await Promise.all([
        supabase.from('profiles').select('home_lat, home_lng').eq('id', user.id).single(),
        supabase.from('profiles').select('home_lat, home_lng').eq('id', selectedFriendId).single(),
      ]);

      if (userProfile.data?.home_lat && userProfile.data?.home_lng &&
          friendProfile.data?.home_lat && friendProfile.data?.home_lng) {
        const midpointCoords = calculateMidpoint(
          userProfile.data.home_lat,
          userProfile.data.home_lng,
          friendProfile.data.home_lat,
          friendProfile.data.home_lng
        );
        setMidpoint(midpointCoords);
      }
    } catch (error) {
      console.error('Error calculating midpoint:', error);
    }
  };

  const generateSuggestions = async () => {
    if (isGenerating || !selectedFriendId || !selectedTimeBlock) return;

    setIsGenerating(true);
    setLoading(true);
    setSuggestions([]);
    setCurrentIndex(0);

    try {
      const { data, error } = await supabase.functions.invoke(
        'smart-activity-recommendations',
        {
          body: {
            freeBlock: selectedTimeBlock,
            friendId: selectedFriendId,
            weather: { temp: 15, isRaining: false },
          },
        }
      );

      if (error) throw error;

      const recommendations = data.recommendations || [];
      
      // Limit to 5 recommendations
      const limitedRecommendations = recommendations.slice(0, 5);

      const newSuggestions: ActivitySuggestion[] = limitedRecommendations.map((rec: any) => ({
        activity: {
          id: rec.id,
          name: rec.name,
          category: rec.category,
          address: rec.address || 'Address not available',
          price_level: rec.price_level || 2,
          distance: rec.distance || 0,
          match_score: rec.match_score,
          totalScore: rec.total_score || rec.match_score,
          score_breakdown: rec.score_breakdown,
          ai_reasoning: rec.ai_reasoning,
          insider_tip: rec.insider_tip,
        },
        friendId: selectedFriendId,
        friendEmail: 'friend',
        suggestedTime: selectedTimeBlock.start,
        context: {
          score_breakdown: rec.score_breakdown,
          total_score: rec.total_score || rec.match_score,
          weather_conditions: { temp: 15, isRaining: false },
          time_block: selectedTimeBlock,
          ai_reasoning: rec.ai_reasoning,
          insider_tip: rec.insider_tip,
        },
      }));

      setSuggestions(newSuggestions);

      if (newSuggestions.length === 0) {
        toast.info("No recommendations found", {
          description: "Try selecting a different time slot.",
        });
      } else {
        toast.success(`Found ${newSuggestions.length} great activities!`);
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
    setLoading(true);

    try {
      const response = direction === "right" ? "accept" : "reject";
      
      const { data, error } = await supabase.functions.invoke('handle-activity-swipe', {
        body: {
          friendId: suggestion.friendId,
          activityId: suggestion.activity.id,
          response,
          suggestedTime: suggestion.suggestedTime,
          context: suggestion.context,
        },
      });

      if (error) throw error;

      if (data.isMatch) {
        toast.success("🎉 It's a match! Calendar event created!", {
          description: `You and your friend will do ${suggestion.activity.name}`,
        });
      } else if (response === "accept") {
        toast.info("👍 Waiting for your friend to swipe...");
      }

      // Move to next card
      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error handling swipe:', error);
      toast.error("Failed to record your response");
    } finally {
      setLoading(false);
    }
  };

  const currentSuggestion = suggestions[currentIndex];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Make Plans</h1>
          <p className="text-muted-foreground">Swipe right to accept, left to pass</p>
        </div>

        {suggestions.length === 0 ? (
          <Card className="p-12 text-center space-y-6">
            <Sparkles className="w-16 h-16 mx-auto text-primary" />
            <div>
              <h2 className="text-2xl font-semibold mb-2">Ready to make plans?</h2>
              <p className="text-muted-foreground mb-6">
                We'll find common free time with your friends and suggest activities you'll both love
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
                  Finding suggestions...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
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
                You've reviewed all suggestions. Check your calendar for confirmed plans!
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
                  Finding more...
                </>
              ) : (
                "Get More Suggestions"
              )}
            </Button>
          </Card>
        ) : (
          <div className="relative" style={{ height: "600px" }}>
            {suggestions.slice(currentIndex, currentIndex + 3).map((suggestion, index) => (
              <div
                key={`${suggestion.activity.id}-${suggestion.friendId}-${index}`}
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
                  friendName={suggestion.friendEmail}
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
              Pass
            </Button>
            <Button
              size="lg"
              onClick={() => handleSwipe("right")}
              disabled={loading}
              className="w-32"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept"}
            </Button>
          </div>
        )}

        <div className="text-center mt-6 text-sm text-muted-foreground">
          {currentIndex + 1} / {suggestions.length}
        </div>
      </div>
    </div>
  );
}
