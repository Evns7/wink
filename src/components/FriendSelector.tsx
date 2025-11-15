import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Loader2 } from "lucide-react";

interface Friend {
  id: string;
  friendId: string;
  friendEmail: string;
  friendNickname: string;
}

interface FriendSelectorProps {
  selectedFriendIds: string[];
  onSelectionChange: (friendIds: string[]) => void;
}

export const FriendSelector = ({ selectedFriendIds, onSelectionChange }: FriendSelectorProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendsWithDetails = await Promise.all(
        (friendships || []).map(async (friendship) => {
          const friendId = friendship.user_id === user.id ? friendship.friend_id : friendship.user_id;
          
          const { data } = await supabase.functions.invoke('get-user-email', {
            body: { userId: friendId }
          });

          return {
            id: friendship.id,
            friendId,
            friendEmail: data?.email || 'Unknown User',
            friendNickname: data?.nickname || data?.email?.split('@')[0] || 'Friend',
          };
        })
      );

      setFriends(friendsWithDetails);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    if (selectedFriendIds.includes(friendId)) {
      onSelectionChange(selectedFriendIds.filter(id => id !== friendId));
    } else {
      onSelectionChange([...selectedFriendIds, friendId]);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading friends...</span>
        </div>
      </Card>
    );
  }

  if (friends.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="text-center space-y-2">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No friends yet. Add friends to invite them to activities!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Invite Friends</h3>
        {selectedFriendIds.length > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">
            {selectedFriendIds.length} selected
          </span>
        )}
      </div>
      
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {friends.map((friend) => (
          <div
            key={friend.friendId}
            onClick={() => toggleFriend(friend.friendId)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
          >
            <Checkbox
              checked={selectedFriendIds.includes(friend.friendId)}
              onCheckedChange={() => toggleFriend(friend.friendId)}
              className="pointer-events-none"
            />
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {friend.friendNickname.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {friend.friendNickname}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {friend.friendEmail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
