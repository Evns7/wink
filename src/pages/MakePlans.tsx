import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SwipeableActivityCard } from "@/components/SwipeableActivityCard";
import { FriendSelector } from "@/components/FriendSelector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Calendar as CalendarIcon, X, Send } from "lucide-react";
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
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<any[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<any | null>(null);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (selectedFriendIds.length > 0) {
      fetchAvailableTimeSlots();
    } else {
      setAvailableTimeSlots([]);
      setSelectedTimeSlot(null);
    }
  }, [selectedFriendIds]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchAvailableTimeSlots = async () => {
    setLoadingTimeSlots(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const { data, error } = await supabase.functions.invoke(
        'analyze-group-availability',
        {
          body: {
            friendIds: selectedFriendIds,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );

      if (error) throw error;

      const freeBlocks = data.freeBlocks || [];
      setAvailableTimeSlots(freeBlocks.slice(0, 10)); // Show top 10 slots
      
      if (freeBlocks.length > 0) {
        setSelectedTimeSlot(freeBlocks[0]); // Auto-select first slot
      }
    } catch (error) {
      console.error('Error fetching time slots:', error);
      toast.error("Failed to fetch available time slots");
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const generateSuggestions = async () => {
    if (isGenerating) return;

    if (!selectedTimeSlot && selectedFriendIds.length > 0) {
      toast.error("Please select a time slot first");
      return;
    }

    setIsGenerating(true);
    setLoading(true);
    setSuggestions([]);
    setAcceptedActivities([]);
    setCurrentIndex(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let freeBlock;
      
      if (selectedTimeSlot) {
        // Use selected time slot
        freeBlock = selectedTimeSlot;
      } else {
        // No friends selected, find user's own availability
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);

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
        
        freeBlock = freeBlocks[0];
      }

      // Get recommendations for the time block
      const { data, error } = await supabase.functions.invoke(
        'smart-activity-recommendations',
        {
          body: {
            freeBlock: freeBlock,
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
        suggestedTime: freeBlock.start,
        context: {
          score_breakdown: rec.score_breakdown,
          total_score: rec.total_score || rec.match_score,
          time_block: freeBlock,
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
      
      // Send notifications to selected friends
      if (selectedFriendIds.length > 0) {
        await sendInvitations(suggestion);
      }
      
      toast.success("Activity saved!", {
        description: selectedFriendIds.length > 0 
          ? `Invitations sent to ${selectedFriendIds.length} friend(s)!`
          : acceptedActivities.length + 1 >= 3 
          ? "You can now add them to your calendar!" 
          : `${suggestion.activity.name} added`,
      });
    }

    setCurrentIndex(prev => prev + 1);
  };

  const sendInvitations = async (suggestion: ActivitySuggestion) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const friendId of selectedFriendIds) {
        await supabase.from('notifications').insert({
          user_id: friendId,
          sender_id: user.id,
          activity_id: suggestion.activity.id,
          activity_name: suggestion.activity.name,
          activity_address: suggestion.activity.address,
          activity_time: suggestion.suggestedTime,
        });
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
    }
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

  const formatTimeSlot = (slot: any) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    
    return {
      date: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      duration: `${duration}h`,
      isToday: start.toDateString() === new Date().toDateString(),
      isTomorrow: start.toDateString() === new Date(Date.now() + 86400000).toDateString(),
    };
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

        {/* Friend Selector */}
        <div className="mb-6">
          <FriendSelector
            selectedFriendIds={selectedFriendIds}
            onSelectionChange={setSelectedFriendIds}
          />
        </div>

        {/* Time Slot Selection */}
        {selectedFriendIds.length > 0 && (
          <Card className="p-4 mb-6 bg-card border-border">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Select a Time Slot</h3>
            </div>
            
            {loadingTimeSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Finding free time...</span>
              </div>
            ) : availableTimeSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No mutual free time found in the next 7 days
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableTimeSlots.map((slot, index) => {
                  const formatted = formatTimeSlot(slot);
                  const isSelected = selectedTimeSlot === slot;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground">{formatted.date}</span>
                            {formatted.isToday && (
                              <Badge variant="secondary" className="text-xs">Today</Badge>
                            )}
                            {formatted.isTomorrow && (
                              <Badge variant="secondary" className="text-xs">Tomorrow</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{formatted.time}</p>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {formatted.duration}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Accepted activities banner */}
        {acceptedActivities.length > 0 && (
          <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">{acceptedActivities.length} saved</span>
                {selectedFriendIds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    • {selectedFriendIds.length} friend(s) invited
                  </span>
                )}
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
