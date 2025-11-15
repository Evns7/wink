import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, DollarSign, Heart, X, Calendar, Sparkles } from "lucide-react";
import { generateMapsSearchUrl } from "@/lib/mapsUtils";

interface NotificationCardProps {
  invitation: {
    id: string;
    inviter_id: string;
    invitee_id: string;
    activity_id: string;
    suggested_time: string;
    message: string | null;
    status: string;
    created_at: string;
    inviter?: {
      nickname: string;
      email: string;
    };
    invitee?: {
      nickname: string;
      email: string;
    };
    activity?: {
      id: string;
      name: string;
      category: string;
      address: string;
      price_level: number;
      lat: number;
      lng: number;
    };
  };
  currentUserId: string;
  onAccept?: (invitationId: string) => void;
  onDecline?: (invitationId: string) => void;
  onCancel?: (invitationId: string) => void;
  onAddToCalendar?: (invitation: any) => void;
}

export const NotificationCard = ({
  invitation,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
  onAddToCalendar,
}: NotificationCardProps) => {
  const isInviter = invitation.inviter_id === currentUserId;
  const otherUser = isInviter ? invitation.invitee : invitation.inviter;
  const activity = invitation.activity;

  if (!activity) return null;

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

  const getPriceDisplay = (level: number) => {
    return "$".repeat(Math.max(1, Math.min(level, 4)));
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      restaurant: "🍽️",
      cafe: "☕",
      bar: "🍺",
      park: "🌳",
      museum: "🎨",
      cinema: "🎬",
      theatre: "🎭",
      sports: "⚽",
      shopping: "🛍️",
      entertainment: "🎪",
    };
    return emojiMap[category.toLowerCase()] || "📍";
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        {/* Header with user and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {otherUser?.nickname?.[0]?.toUpperCase() || otherUser?.email?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground">
                {otherUser?.nickname || otherUser?.email?.split('@')[0] || 'Friend'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isInviter ? 'Waiting for response' : 'Invited you'}
              </p>
            </div>
          </div>
          <Badge
            variant={
              invitation.status === 'matched'
                ? 'default'
                : invitation.status === 'pending'
                ? 'secondary'
                : 'outline'
            }
            className="text-xs"
          >
            {invitation.status === 'matched' && <Sparkles className="h-3 w-3 mr-1" />}
            {invitation.status === 'matched' ? 'Matched!' : invitation.status}
          </Badge>
        </div>

        {/* Activity details */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{getCategoryEmoji(activity.category)}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-foreground">{activity.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{activity.category}</p>
            </div>
          </div>

          {/* Time and location */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{formatTime(invitation.suggested_time)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground line-clamp-1">{activity.address}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{getPriceDisplay(activity.price_level || 2)}</span>
            </div>
          </div>

          {invitation.message && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-foreground italic">"{invitation.message}"</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          {invitation.status === 'pending' && !isInviter && (
            <>
              <Button
                onClick={() => onAccept?.(invitation.id)}
                className="flex-1"
                size="sm"
              >
                <Heart className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                onClick={() => onDecline?.(invitation.id)}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </>
          )}

          {invitation.status === 'pending' && isInviter && (
            <Button
              onClick={() => onCancel?.(invitation.id)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              Cancel Invitation
            </Button>
          )}

          {invitation.status === 'matched' && (
            <>
              <Button
                onClick={() => onAddToCalendar?.(invitation)}
                className="flex-1"
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Add to Calendar
              </Button>
              <Button
                onClick={() => {
                  const searchTerm = activity.name || activity.category;
                  window.open(generateMapsSearchUrl(searchTerm, activity.lat, activity.lng), '_blank');
                }}
                variant="outline"
                size="sm"
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
