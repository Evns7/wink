import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, DollarSign, Cloud, Plus } from "lucide-react";

interface Activity {
  id: number;
  title: string;
  category: string;
  duration: number;
  travelTime: number;
  price: number;
  weatherMatch: number;
  description: string;
  image: string;
}

interface ActivityCardProps {
  activity: Activity;
}

const ActivityCard = ({ activity }: ActivityCardProps) => {
  const categoryColors = {
    food: "bg-category-food",
    shopping: "bg-category-shopping",
    sports: "bg-category-sports",
    studying: "bg-category-studying",
  };

  const categoryColor = categoryColors[activity.category as keyof typeof categoryColors] || "bg-primary";

  return (
    <Card className="glass hover:scale-105 transition-smooth overflow-hidden group">
      {/* Category Image/Emoji */}
      <div className={`h-32 ${categoryColor}/10 flex items-center justify-center text-6xl border-b border-border`}>
        {activity.image}
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl leading-tight">{activity.title}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {activity.category}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{activity.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Activity Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{activity.duration} min</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{activity.travelTime} min away</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span>${activity.price}</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-muted-foreground" />
            <span>{Math.round(activity.weatherMatch * 100)}% match</span>
          </div>
        </div>

        {/* Total Time Badge */}
        <div className="p-3 rounded-xl bg-accent/10 text-center">
          <div className="text-sm text-muted-foreground">Total Time Needed</div>
          <div className="text-lg font-bold text-accent">
            {activity.duration + activity.travelTime * 2} minutes
          </div>
          <div className="text-xs text-muted-foreground">Including round-trip travel</div>
        </div>

        {/* Action Button */}
        <Button className="w-full rounded-xl" size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Add to Calendar
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActivityCard;
