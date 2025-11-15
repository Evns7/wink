import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Heart, X, MapPin, DollarSign, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Activity {
  id: string;
  name: string;
  category: string;
  address: string;
  price_level: number;
  distance: number;
  match_score?: number;
}

interface SwipeableActivityCardProps {
  activity: Activity;
  friendName: string;
  suggestedTime: string;
  onSwipe: (direction: "left" | "right") => void;
}

export const SwipeableActivityCard = ({
  activity,
  friendName,
  suggestedTime,
  onSwipe,
}: SwipeableActivityCardProps) => {
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

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
        <div className="relative h-64 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <div className="text-6xl">{getCategoryEmoji(activity.category)}</div>
          {activity.match_score && (
            <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
              {Math.round(activity.match_score)}% Match
            </Badge>
          )}
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-2">{activity.name}</h3>
            <Badge variant="secondary" className="mb-3">
              {activity.category}
            </Badge>
          </div>

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
