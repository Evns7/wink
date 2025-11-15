import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SwipeableActivityCard } from "@/components/SwipeableActivityCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";

interface Friend {
  id: string;
  email: string;
}

interface Activity {
  id: string;
  name: string;
  category: string;
  address: string;
  price_level: number;
  distance: number;
  match_score?: number;
}

interface ActivitySuggestion {
  activity: Activity;
  friendId: string;
  friendEmail: string;
  suggestedTime: string;
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

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      // Get user's friends
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (!friendships || friendships.length === 0) {
        toast.error("You need friends to make plans! Add some friends first.");
        return;
      }

      // Extract friend IDs
      const friendIds = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      // Analyze availability with friends
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // Next 7 days

      const { data: availabilityData, error: availabilityError } = await supabase.functions.invoke(
        'analyze-group-availability',
        {
          body: {
            friendIds: friendIds.slice(0, 3), // Limit to 3 friends for now
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );

      if (availabilityError) throw availabilityError;

      const freeBlocks = availabilityData.freeBlocks || [];
      if (freeBlocks.length === 0) {
        toast.info("No common free time found with friends in the next week.");
        return;
      }

      // Get activity recommendations for each free block
      const allSuggestions: ActivitySuggestion[] = [];

      for (const block of freeBlocks.slice(0, 5)) { // Take first 5 time blocks
        const { data: recommendationData, error: recommendationError } = await supabase.functions.invoke(
          'smart-activity-recommendations',
          {
            body: {
              freeBlock: block,
              weather: { temp: 20, condition: 'clear' }, // Mock weather for now
            },
          }
        );

        if (recommendationError) {
          console.error('Error getting recommendations:', recommendationError);
          continue;
        }

        const activities = recommendationData.recommendations || [];
        
        // Create suggestions with each friend for this time block
        const blockSuggestions = activities.slice(0, 2).flatMap((activity: Activity) => 
          friendIds.slice(0, 2).map((friendId: string) => ({
            activity,
            friendId,
            friendEmail: `Friend ${friendId.substring(0, 8)}`, // Placeholder
            suggestedTime: block.start,
          }))
        );

        allSuggestions.push(...blockSuggestions);
      }

      if (allSuggestions.length === 0) {
        toast.info("No activity suggestions available right now.");
        return;
      }

      setSuggestions(allSuggestions);
      setCurrentIndex(0);
      toast.success(`Found ${allSuggestions.length} activity suggestions!`);
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
                  <Calendar className="w-4 h-4 mr-2" />
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
