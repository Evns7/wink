import { Calendar, MapPin, Users, Lock, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  event_type: 'private' | 'open';
  status: 'upcoming' | 'completed' | 'canceled';
  user_id: string;
  created_at: string;
  attendee_count?: number;
  user_is_attending?: boolean;
}

interface EventCardProps {
  event: Event;
  isOwner: boolean;
  onJoin?: (eventId: string) => void;
  onLeave?: (eventId: string) => void;
  onViewDetails?: (eventId: string) => void;
}

export const EventCard = ({ event, isOwner, onJoin, onLeave, onViewDetails }: EventCardProps) => {
  const isPast = new Date(event.event_date) < new Date();
  const statusColors = {
    upcoming: "bg-green-500/10 text-green-500",
    completed: "bg-blue-500/10 text-blue-500",
    canceled: "bg-red-500/10 text-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="glass hover-scale overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {event.event_type === 'private' ? (
                  <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <CardTitle className="text-lg truncate">{event.title}</CardTitle>
              </div>
              {event.description && (
                <CardDescription className="line-clamp-2">
                  {event.description}
                </CardDescription>
              )}
            </div>
            <Badge className={statusColors[event.status]}>
              {event.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>{format(new Date(event.event_date), "PPP 'at' p")}</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {event.attendee_count !== undefined && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>{event.attendee_count} attending</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(event.id)}
                className="flex-1 rounded-full"
              >
                View Details
              </Button>
            )}

            {!isOwner && !isPast && event.status === 'upcoming' && (
              <>
                {event.user_is_attending ? (
                  onLeave && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onLeave(event.id)}
                      className="flex-1 rounded-full"
                    >
                      Leave Event
                    </Button>
                  )
                ) : (
                  onJoin && (
                    <Button
                      size="sm"
                      onClick={() => onJoin(event.id)}
                      className="flex-1 rounded-full"
                    >
                      Join Event
                    </Button>
                  )
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
