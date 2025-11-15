import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Heart, X, MapPin, DollarSign, Clock, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface SwipeableActivityCardProps {
  activity: Activity;
  friendName: string;
  suggestedTime: string;
  onSwipe: (direction: "left" | "right") => void;
  midpoint?: { lat: number; lng: number } | null;
}

export const SwipeableActivityCard = ({
  activity,
  friendName,
  suggestedTime,
  onSwipe,
  midpoint,
}: SwipeableActivityCardProps) => {
  const [exitX, setExitX] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  
  const displayScore = activity.totalScore || activity.match_score || 0;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      setExitX(info.offset.x > 0 ? 200 : -200);
      onSwipe(info.offset.x > 0 ? "right" : "left");
    }
  };

  const getPriceDisplay = (level: number) => {
    return "$".repeat(Math.max(1, Math.min(level, 4)));
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      style={{
        x,
        rotate,
        opacity,
        position: "absolute",
        width: "100%",
        maxWidth: "400px",
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={exitX !== 0 ? { x: exitX } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="cursor-grab active:cursor-grabbing"
    >
      <Card className="overflow-hidden bg-card border-2 border-border shadow-lg">
        <div className="relative h-64 bg-gradient-to-br from-primary/20 to-secondary/20 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl">{getCategoryEmoji(activity.category)}</div>
          
          {/* Circular Score Indicator */}
          <div className="relative w-20 h-20">
            <svg className="transform -rotate-90 w-20 h-20">
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - displayScore / 100)}`}
                className="text-primary transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-foreground">{Math.round(displayScore)}</span>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Friend info at top */}
          <div className="flex items-center gap-2 pb-3 border-b">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {friendName[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Plan with {friendName}</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{activity.name}</h2>
            <Badge variant="secondary" className="mb-3">
              {activity.category}
            </Badge>
            
            {/* Insider Tip Badge */}
            {activity.insider_tip && (
              <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/50 mb-3">
                <Sparkles className="w-3 h-3 mr-1" />
                Insider Tip
              </Badge>
            )}
          </div>

          {/* Score Breakdown Badges */}
          {activity.score_breakdown && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                ❤️ {activity.score_breakdown.preference}/30
              </Badge>
              <Badge variant="outline" className="text-xs">
                ⏰ {activity.score_breakdown.time_fit}/20
              </Badge>
              <Badge variant="outline" className="text-xs">
                ☀️ {activity.score_breakdown.weather}/15
              </Badge>
              <Badge variant="outline" className="text-xs">
                💰 {activity.score_breakdown.budget}/15
              </Badge>
              <Badge variant="outline" className="text-xs">
                📍 {activity.score_breakdown.proximity}/10
              </Badge>
              <Badge variant="outline" className="text-xs">
                ⏱️ {activity.score_breakdown.duration}/10
              </Badge>
            </div>
          )}

          <div className="space-y-2 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{formatTime(suggestedTime)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{activity.address}</span>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">{getPriceDisplay(activity.price_level || 1)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">📍 {activity.distance?.toFixed(1)} km away</span>
            </div>
          </div>

          {/* AI Reasoning Section */}
          {(activity.ai_reasoning || activity.insider_tip) && (
            <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                <Sparkles className="w-4 h-4" />
                AI Insights
                {aiOpen ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {activity.ai_reasoning && (
                  <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/10">
                    {activity.ai_reasoning}
                  </p>
                )}
                {activity.insider_tip && (
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                    💡 {activity.insider_tip}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Suggested with <span className="font-semibold text-foreground">{friendName}</span>
            </p>
          </div>
        </div>

        {/* Swipe indicators */}
        <motion.div
          className="absolute top-1/2 left-8 -translate-y-1/2"
          style={{ opacity: useTransform(x, [0, -100], [0, 1]) }}
        >
          <div className="bg-destructive text-destructive-foreground p-4 rounded-full">
            <X className="w-8 h-8" />
          </div>
        </motion.div>

        <motion.div
          className="absolute top-1/2 right-8 -translate-y-1/2"
          style={{ opacity: useTransform(x, [0, 100], [0, 1]) }}
        >
          <div className="bg-primary text-primary-foreground p-4 rounded-full">
            <Heart className="w-8 h-8" />
          </div>
        </motion.div>
      </Card>
    </motion.div>
  );
};

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    restaurant: "🍽️",
    cafe: "☕",
    bar: "🍺",
    museum: "🎨",
    park: "🌳",
    cinema: "🎬",
    theater: "🎭",
    sports: "⚽",
    shopping: "🛍️",
    entertainment: "🎪",
  };
  return emojiMap[category.toLowerCase()] || "📍";
}
