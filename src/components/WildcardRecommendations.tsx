import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, DollarSign, Calendar, Clock, RefreshCw, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Activity {
  id: string;
  name: string;
  category: string;
  matchScore: number;
  travelTimeMinutes: number;
  distance: number;
  address: string;
  price_level: number;
}

interface WildcardRecommendationsProps {
  trigger?: React.ReactNode;
}

export const WildcardRecommendations = ({ trigger }: WildcardRecommendationsProps) => {
  const [open, setOpen] = useState(false);
  const [wildcardOptions, setWildcardOptions] = useState<Activity[]>([]);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      generateWildcards();
    }
  }, [open]);

  const generateWildcards = async () => {
    setLoading(true);
    try {
      // Get next available time slot
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: availabilityData, error: availError } = await supabase.functions.invoke('analyze-group-availability', {
        body: { startDate, endDate, friendIds: [] }
      });

      if (availError) throw availError;

      const freeBlocks = availabilityData.freeBlocks || [];
      if (freeBlocks.length === 0) {
        toast({
          variant: "destructive",
          title: "No free time found",
          description: "Connect your calendar to find available time slots.",
        });
        setLoading(false);
        return;
      }

      const nextBlock = freeBlocks[0];
      setScheduledTime(new Date(nextBlock.start));

      // Get recommendations for this time block
      const weather = { temp: 20, isRaining: false };

      const { data: recData, error: recError } = await supabase.functions.invoke('smart-activity-recommendations', {
        body: { freeBlock: nextBlock, friendIds: [], weather }
      });

      if (recError) throw recError;

      const recommendations = recData.recommendations || [];
      
      // Pick 3 random activities
      const shuffled = [...recommendations].sort(() => Math.random() - 0.5);
      setWildcardOptions(shuffled.slice(0, 3));

    } catch (error) {
      console.error('Error generating wildcards:', error);
      toast({
        variant: "destructive",
        title: "Failed to generate options",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const scheduleActivity = async (activity: Activity) => {
    if (!scheduledTime) return;

    try {
      const startTime = scheduledTime;
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          title: activity.name,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          location: activity.address,
          description: `${activity.category} • Match: ${activity.matchScore}%`,
          activityId: activity.id
        }
      });

      if (error) throw error;

      const syncedToGoogle = data?.syncedToGoogle;

      toast({
        title: "🎉 Activity scheduled!",
        description: syncedToGoogle 
          ? `${activity.name} added to your Google Calendar`
          : `${activity.name} saved to your plans (connect Google Calendar to sync)`,
      });

      setOpen(false);
    } catch (error) {
      console.error('Error scheduling:', error);
      toast({
        variant: "destructive",
        title: "Failed to schedule",
        description: "Could not save the activity. Please try again.",
      });
    }
  };

  const getPriceDisplay = (level: number) => {
    return '$'.repeat(level || 2);
  };

  const formatScheduledTime = () => {
    if (!scheduledTime) return "";
    return scheduledTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 rounded-xl">
            <Sparkles className="w-6 h-6" />
            <span>Surprise Me</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Wildcard Ideas
          </DialogTitle>
        </DialogHeader>

        {scheduledTime && (
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span>Scheduled for: <span className="font-semibold">{formatScheduledTime()}</span></span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={generateWildcards}
              disabled={loading}
              className="rounded-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Generating wildcard ideas...</p>
          </div>
        )}

        {!loading && wildcardOptions.length > 0 && (
          <div className="space-y-4">
            {wildcardOptions.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">{activity.name}</h3>
                        <Badge variant="secondary" className="mb-3">
                          {activity.category}
                        </Badge>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{activity.travelTimeMinutes} min away</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Navigation className="h-4 w-4" />
                            <span>{activity.distance.toFixed(1)} km</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span>{getPriceDisplay(activity.price_level)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Sparkles className="h-4 w-4" />
                            <span>{activity.matchScore}% match</span>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {activity.address}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => scheduleActivity(activity)}
                      className="w-full rounded-xl"
                      size="lg"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule for {formatScheduledTime()}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && wildcardOptions.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No recommendations available. Try connecting your calendar and setting your preferences.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
