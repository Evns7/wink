import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SwipeableActivityCard } from "@/components/SwipeableActivityCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useQuery } from "@tanstack/react-query";

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

export default function MakePlans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
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

  const { refetch: refetchSuggestions } = useQuery({
    queryKey: ['activity-suggestions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (!friendships || friendships.length === 0) {
        throw new Error('No friends found');
      }

      const friendIds = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const { data: availabilityData, error: availabilityError } = await supabase.functions.invoke(
        'analyze-group-availability',
        {
          body: {
            friendIds: friendIds.slice(0, 3),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );

      if (availabilityError) throw availabilityError;

      const freeBlocks = availabilityData.freeBlocks || [];
      if (freeBlocks.length === 0) {
        throw new Error('No common free time found');
      }

      const allSuggestions: ActivitySuggestion[] = [];

      for (const block of freeBlocks.slice(0, 5)) {
        const { data: recommendationData, error: recommendationError } = await supabase.functions.invoke(
          'smart-activity-recommendations',
          {
            body: {
              freeBlock: block,
              friendIds: friendIds.slice(0, 3),
              weather: { temp: 15, isRaining: false },
            },
          }
        );

        if (recommendationError) {
          console.error('Error getting recommendations:', recommendationError);
          continue;
        }

        const activities = recommendationData.recommendations || [];
        
        const blockSuggestions = activities.slice(0, 2).flatMap((activity: Activity) => 
          friendIds.slice(0, 2).map((friendId: string) => ({
            activity,
            friendId,
            friendEmail: `Friend ${friendId.substring(0, 8)}`,
            suggestedTime: block.start,
            context: {
              score_breakdown: activity.score_breakdown,
              total_score: activity.totalScore,
              weather_conditions: { temp: 15, isRaining: false },
              time_block: { start: block.start, end: block.end },
              ai_reasoning: activity.ai_reasoning,
              insider_tip: activity.insider_tip,
            },
          }))
        );

        allSuggestions.push(...blockSuggestions);
      }

      if (allSuggestions.length === 0) {
        throw new Error('No activity suggestions available');
      }

      return allSuggestions;
    },
    enabled: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const result = await refetchSuggestions();
      
      if (result.error) {
        if (result.error.message === 'No friends found') {
          toast.error("You need friends to make plans! Add some friends first.");
        } else if (result.error.message === 'No common free time found') {
          toast.info("No common free time found with friends in the next week.");
        } else if (result.error.message === 'No activity suggestions available') {
          toast.info("No activity suggestions available right now.");
        } else {
          toast.error("Failed to generate suggestions");
        }
        return;
      }

      if (result.data) {
        setSuggestions(result.data);
        setCurrentIndex(0);
        toast.success(`Found ${result.data.length} activity suggestions!`);
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error("Failed to generate suggestions");
    } finally {
      setIsGenerating(false);
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
