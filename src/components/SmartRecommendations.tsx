import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sparkles, MapPin, Clock, DollarSign, Calendar, Zap, ChevronDown, ChevronUp, Filter, TrendingUp, Heart, Cloud, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

interface Activity {
  id: string;
  name: string;
  description?: string;
  category: string;
  matchScore: number;
  matchFactors: {
    preference: number;
    time_fit: number;
    weather: number;
    budget: number;
    proximity: number;
    popularity?: number;
    duration?: number;
  };
  travelTimeMinutes?: number;
  distance?: number;
  isPerfectMatch: boolean;
  address?: string;
  location?: string;
  price_level?: number;
  price?: string;
  priceRange?: string;
  date?: string;
  time?: string;
  url?: string;
  link?: string;
  google_maps_link?: string;
  lat?: number;
  lng?: number;
  source?: string;
  popularity?: string;
}

export const SmartRecommendations = () => {
  const [recommendations, setRecommendations] = useState<Activity[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<Activity[]>([]);
  const [freeBlocks, setFreeBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [maxDistance, setMaxDistance] = useState<number>(5);
  
  const { toast } = useToast();

  useEffect(() => {
    analyzeAvailability();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [recommendations, priceFilter, categoryFilter, maxDistance]);

  const applyFilters = () => {
    let filtered = [...recommendations];

    // Price filter
    if (priceFilter !== "all") {
      const priceLevel = parseInt(priceFilter);
      filtered = filtered.filter(a => (a.price_level) === priceLevel);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(a => 
        a.category.toLowerCase().includes(categoryFilter.toLowerCase())
      );
    }

    // Distance filter - only apply if distance is available
    filtered = filtered.filter(a => !a.distance || a.distance <= maxDistance);

    setFilteredRecommendations(filtered);
  };

  const analyzeAvailability = async () => {
    setLoading(true);
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
      const weather = { temp: 20, isRaining: false };

      const { data, error } = await supabase.functions.invoke('smart-activity-recommendations', {
        body: { freeBlock: block, friendIds: [], weather, refresh: true }
      });

      if (error) throw error;
      
      console.log('Received live recommendations:', data);
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

      analyzeAvailability();
    } catch (error) {
      console.error('Error scheduling:', error);
      toast({
        variant: "destructive",
        title: "Failed to schedule",
        description: "Could not save the activity. Please try again.",
      });
    }
  };

  const getPriceDisplay = (level?: number) => {
    if (!level || level === 0) return 'Free';
    return '$'.repeat(level);
  };

  const getMatchColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 50) return "text-yellow-500";
    return "text-muted-foreground";
  };

  const getFactorLabel = (key: string) => {
    const labels: Record<string, string> = {
      preference: "Your Interests",
      time_fit: "Perfect Timing",
      weather: "Weather Match",
      budget: "Budget Fit",
      proximity: "Close By",
      popularity: "Popularity",
      duration: "Time Available"
    };
    return labels[key] || key;
  };

  const getFactorIcon = (key: string) => {
    const icons: Record<string, any> = {
      preference: Heart,
      time_fit: Clock,
      weather: Cloud,
      budget: DollarSign,
      proximity: Navigation,
      duration: TrendingUp
    };
    const Icon = icons[key] || Sparkles;
    return <Icon className="h-3 w-3" />;
  };

  const getFactorMaxScore = (key: string) => {
    const maxScores: Record<string, number> = {
      preference: 30,
      time_fit: 20,
      weather: 15,
      budget: 15,
      proximity: 10,
      popularity: 10,
      duration: 10
    };
    return maxScores[key] || 10;
  };

  const categories = Array.from(new Set(recommendations.map(r => r.category)));

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Sparkles className="h-5 w-5 text-primary" />
              Live Event Recommendations
            </CardTitle>
            <CardDescription className="font-sans">
              Real events from Eventbrite scraped live - updates every refresh
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-full"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 p-4 bg-muted/30 rounded-xl"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price Level</label>
                  <Select value={priceFilter} onValueChange={setPriceFilter}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="All prices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All prices</SelectItem>
                      <SelectItem value="1">$ (Budget)</SelectItem>
                      <SelectItem value="2">$$ (Moderate)</SelectItem>
                      <SelectItem value="3">$$$ (Upscale)</SelectItem>
                      <SelectItem value="4">$$$$ (Premium)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Max Distance</label>
                  <span className="text-sm text-muted-foreground">{maxDistance} km</span>
                </div>
                <Slider
                  value={[maxDistance]}
                  onValueChange={(value) => setMaxDistance(value[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              No free time blocks found. Connect your calendar to get personalized recommendations!
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

            {/* Results summary */}
            {filteredRecommendations.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredRecommendations.length} of {recommendations.length} recommendations
              </div>
            )}

            {/* Recommendations */}
            <div className="space-y-3">
              {filteredRecommendations.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-card/50 rounded-xl space-y-3 hover:bg-card/70 transition-colors border border-border/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-serif font-bold text-lg">{activity.name}</h4>
                        {activity.isPerfectMatch && (
                          <Badge variant="default" className="rounded-full bg-green-500">
                            <Zap className="h-3 w-3 mr-1" />
                            Perfect
                          </Badge>
                        )}
                        {activity.source === 'live_eventbrite' && (
                          <Badge variant="secondary" className="rounded-full text-xs">
                            Live
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 font-sans">
                        {activity.category} • {activity.date ? new Date(activity.date).toLocaleDateString() : 'Date TBA'} {activity.time && `at ${activity.time}`}
                      </p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 font-sans">
                          {activity.description}
                        </p>
                      )}
                      
                      {/* Match Score - Prominent */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Match Score</span>
                          <span className={`text-2xl font-bold ${getMatchColor(activity.matchScore)}`}>
                            {activity.matchScore}%
                          </span>
                        </div>
                        <Progress value={activity.matchScore} className="h-2" />
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-sans">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {activity.location || activity.address || 'Location TBA'}
                        </span>
                        {activity.priceRange && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {activity.priceRange}
                          </span>
                        )}
                        {activity.popularity && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {activity.popularity} demand
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {(activity.url || activity.link) && (
                          <a 
                            href={activity.url || activity.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-sans"
                          >
                            View event details →
                          </a>
                        )}
                        {activity.google_maps_link && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(activity.google_maps_link, '_blank')}
                            className="text-xs"
                          >
                            <Navigation className="h-3 w-3 mr-1" />
                            View on Map
                          </Button>
                        )}
                      </div>

                      {/* Why recommended? - Expandable */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedActivity(
                          expandedActivity === activity.id ? null : activity.id
                        )}
                        className="mt-2 text-xs rounded-full"
                      >
                        Why recommended?
                        {expandedActivity === activity.id ? 
                          <ChevronUp className="h-3 w-3 ml-1" /> : 
                          <ChevronDown className="h-3 w-3 ml-1" />
                        }
                      </Button>

                      <AnimatePresence>
                        {expandedActivity === activity.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-2 p-3 bg-muted/20 rounded-lg"
                          >
                            <p className="text-xs font-medium mb-2">Score Breakdown:</p>
                            {Object.entries(activity.matchFactors).map(([key, value]) => (
                              <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1">
                                    {getFactorIcon(key)}
                                    {getFactorLabel(key)}
                                  </span>
                                  <span className="font-medium">
                                    {value}/{getFactorMaxScore(key)}
                                  </span>
                                </div>
                                <Progress 
                                  value={(value / getFactorMaxScore(key)) * 100} 
                                  className="h-1" 
                                />
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => scheduleActivity(activity)}
                      className="rounded-full shrink-0"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Add to Calendar
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredRecommendations.length === 0 && recommendations.length > 0 && (
              <div className="text-center py-8">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No activities match your current filters. Try adjusting them!
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
