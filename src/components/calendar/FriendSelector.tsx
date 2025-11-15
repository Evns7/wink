import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Users, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Friend {
  id: string;
  email: string;
  nickname: string;
}

interface FriendSelectorProps {
  selectedFriendId: string | null;
  onSelectFriend: (friendId: string | null) => void;
}

export const FriendSelector = ({ selectedFriendId, onSelectFriend }: FriendSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (!friendships) {
        setFriends([]);
        return;
      }

      // Get friend IDs
      const friendIds = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      // Fetch friend emails and nicknames
      const friendsDataPromises = friendIds.map(async (id) => {
        const { data } = await supabase.functions.invoke('get-user-email', {
          body: { userId: id }
        });
        return {
          id,
          email: data?.email || `Friend ${id.substring(0, 8)}`,
          nickname: data?.nickname || data?.email?.split('@')[0] || 'Friend',
        };
      });

      const friendsData = await Promise.all(friendsDataPromises);
      setFriends(friendsData);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedFriend = friends.find(f => f.id === selectedFriendId);

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectFriend(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {selectedFriend ? (
              <>
                <span className="truncate">{selectedFriend.nickname}</span>
                <Badge variant="secondary" className="ml-2">Comparing</Badge>
              </>
            ) : (
              <span className="text-muted-foreground">Select a friend to compare</span>
            )}
          </div>
          {selectedFriend ? (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={handleClearSelection}
            />
          ) : (
            <Users className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search friends..." />
          <CommandEmpty>
            {loading ? "Loading friends..." : "No friends found."}
          </CommandEmpty>
          <CommandGroup>
            {friends.map((friend) => (
              <CommandItem
                key={friend.id}
                value={friend.id}
                onSelect={() => {
                  onSelectFriend(friend.id === selectedFriendId ? null : friend.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${
                    selectedFriendId === friend.id ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Avatar className="h-6 w-6 mr-2">
                  <AvatarFallback className="text-xs">
                    {friend.nickname.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="truncate font-medium">{friend.nickname}</span>
                  <span className="text-xs text-muted-foreground truncate">{friend.email}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
