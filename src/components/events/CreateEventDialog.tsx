import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar, MapPin, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
}

interface CreateEventDialogProps {
  friends: Friend[];
  onEventCreated: () => void;
}

export const CreateEventDialog = ({ friends, onEventCreated }: CreateEventDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    location: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const eventData = {
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        event_date: new Date(formData.event_date).toISOString(),
        location: formData.location,
        event_type: isPrivate ? 'private' : 'open',
        allowed_friend_ids: isPrivate ? selectedFriends : [],
        status: 'upcoming',
      };

      console.log('Creating event:', eventData);

      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        throw error;
      }

      console.log('Event created:', data);

      // Automatically add creator as attendee with accepted status
      const { error: attendeeError } = await supabase
        .from('event_attendees')
        .insert({
          event_id: data.id,
          user_id: user.id,
          status: 'accepted',
        });

      if (attendeeError) {
        console.error('Error adding creator as attendee:', attendeeError);
      }

      toast({
        title: "Event created!",
        description: `Your ${isPrivate ? 'private' : 'open'} event has been created.`,
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        event_date: "",
        location: "",
      });
      setSelectedFriends([]);
      setIsPrivate(false);
      setOpen(false);
      onEventCreated();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        variant: "destructive",
        title: "Failed to create event",
        description: "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const getFriendId = (friendship: Friend, userId: string) => {
    return friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Create a private or open event for your friends
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Summer BBQ Party"
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Join us for a fun BBQ in the park!"
              className="rounded-xl min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event_date">Date & Time *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="event_date"
                type="datetime-local"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                required
                className="rounded-xl pl-10"
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Hyde Park, London"
                className="rounded-xl pl-10"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="private-event">Private Event</Label>
                <p className="text-sm text-muted-foreground">
                  {isPrivate
                    ? "Only selected friends can see and join"
                    : "All your friends can see and join"}
                </p>
              </div>
              <Switch
                id="private-event"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            {isPrivate && (
              <div className="space-y-2">
                <Label>Select Friends to Invite</Label>
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You don't have any friends yet. Add friends to invite them to private events.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-xl p-3">
                    {friends.map((friendship) => {
                      if (!currentUserId) return null;
                      
                      const friendId = getFriendId(friendship, currentUserId);
                      
                      return (
                        <div key={friendship.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`friend-${friendship.id}`}
                            checked={selectedFriends.includes(friendId)}
                            onChange={() => toggleFriendSelection(friendId)}
                            className="rounded"
                          />
                          <Label
                            htmlFor={`friend-${friendship.id}`}
                            className="cursor-pointer flex-1"
                          >
                            Friend
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl"
            >
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
