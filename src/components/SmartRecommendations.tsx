import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, Clock, DollarSign, Calendar, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Activity {
  id: string;
  name: string;
  category: string;
  matchScore: number;
  matchFactors: any;
  travelTimeMinutes: number;
  isPerfectMatch: boolean;
  address: string;
  price_level: number;
}

export const SmartRecommendations = () => {
  const [recommendations, setRecommendations] = useState<Activity[]>([]);
  const [freeBlocks, setFreeBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    analyzeAvailability();
  }, []);

  const analyzeAvailability = async () => {
    setLoading(true);
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const { data, error } = await supabase.functions.invoke('analyze-group-availability', {
        body: { startDate, endDate, friendIds: [] }
      });

      if (error) throw error;
      
      setFreeBlocks(data.freeBlocks || []);
      if (data.freeBlocks && data.freeBlocks.length > 0) {
        setSelectedBlock(data.freeBlocks[0]);
        getRecommendations(data.freeBlocks[0]);
      }
    } catch (error) {
      console.error('Error analyzing availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async (block: any) => {
    setLoading(true);
    try {
      // Get weather (mock for now)
      const weather = { temp: 20, isRaining: false };

      const { data, error } = await supabase.functions.invoke('smart-activity-recommendations', {
        body: { freeBlock: block, friendIds: [], weather }
      });

      if (error) throw error;
      
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast({
        variant: "destructive",
        title: "Failed to load recommendations",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const scheduleActivity = async (activity: Activity) => {
    if (!selectedBlock) return;

    try {
      const startTime = new Date(selectedBlock.start);
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours

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

      toast({
        title: "🎉 Activity scheduled!",
        description: `${activity.name} added to your calendar`,
      });

      // Refresh availability
      analyzeAvailability();
    } catch (error) {
      console.error('Error scheduling:', error);
      toast({
        variant: "destructive",
        title: "Failed to schedule",
        description: "Please try connecting your calendar first.",
      });
    }
  };

  const getPriceDisplay = (level: number) => {
    return '$'.repeat(level || 2);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Recommendations
        </CardTitle>
        <CardDescription>
          AI-powered activity suggestions based on your free time and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Finding perfect activities...</p>
          </div>
        )}

        {!loading && freeBlocks.length === 0 && (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No free time blocks found. Your schedule is fully booked!
            </p>
          </div>
        )}

        {!loading && freeBlocks.length > 0 && selectedBlock && (
          <>
            {/* Free Time Block Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {freeBlocks.slice(0, 5).map((block, index) => (
                <Button
                  key={index}
                  variant={selectedBlock === block ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedBlock(block);
                    getRecommendations(block);
                  }}
                  className="rounded-full whitespace-nowrap"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {new Date(block.start).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric'
                  })}
                </Button>
              ))}
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              {recommendations.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-card/50 rounded-xl space-y-3 hover-scale"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{activity.name}</h4>
                        {activity.isPerfectMatch && (
                          <Badge variant="default" className="rounded-full">
                            <Zap className="h-3 w-3 mr-1" />
                            Perfect Match
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {activity.category}
                      </p>
                      
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {activity.travelTimeMinutes} min away
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {getPriceDisplay(activity.price_level)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {activity.matchScore}% match
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => scheduleActivity(activity)}
                      className="rounded-full"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Add to Calendar
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};