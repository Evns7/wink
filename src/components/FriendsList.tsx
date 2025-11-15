import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, UserPlus, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export const FriendsList = () => {
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('Fetching friends for user:', user.id);

    // Get accepted friendships
    const { data: friendships, error: friendsError } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (friendsError) {
      console.error('Error fetching friends:', friendsError);
    } else {
      console.log('Found friends:', friendships);
    }

    setFriends(friendships || []);

    // Get pending requests (where current user is the friend_id - incoming requests)
    const { data: pending, error: pendingError } = await supabase
      .from('friendships')
      .select('*')
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Error fetching pending requests:', pendingError);
    } else {
      console.log('Found pending requests:', pending);
    }

    setPendingRequests(pending || []);
  };

  const sendFriendRequest = async () => {
    if (!searchEmail.trim()) return;
    
    setLoading(true);
    try {
      console.log('Sending friend request to:', searchEmail);

      // Call edge function to find user by email and create friendship
      const { data, error } = await supabase.functions.invoke('find-user-by-email', {
        body: { email: searchEmail.trim() }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        console.error('API error:', data.error);
        toast({
          variant: "destructive",
          title: "Failed to send request",
          description: data.error,
        });
        return;
      }

      console.log('Friend request created:', data);

      toast({
        title: "Friend request sent!",
        description: `Request sent to ${searchEmail}`,
      });
      setSearchEmail("");
      
      // Refresh the friends list to show updated state
      fetchFriends();
    } catch (error) {
      console.error('Error sending request:', error);
      toast({
        variant: "destructive",
        title: "Failed to send request",
        description: "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, accept: boolean) => {
    try {
      console.log(`${accept ? 'Accepting' : 'Rejecting'} friend request:`, requestId);

      const { error } = await supabase
        .from('friendships')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', requestId);

      if (error) {
        console.error('Error updating friendship:', error);
        throw error;
      }

      console.log('Friendship updated successfully');

      toast({
        title: accept ? "Friend request accepted!" : "Request declined",
        description: accept ? "You can now see each other's calendars" : undefined,
      });

      // Refresh to show updated lists
      fetchFriends();
    } catch (error) {
      console.error('Error handling request:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update friend request",
      });
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Friends & Connections
        </CardTitle>
        <CardDescription>
          Connect with friends to find time together
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Friend */}
        <div className="flex gap-2">
          <Input
            placeholder="Friend's email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
            className="rounded-xl"
          />
          <Button 
            onClick={sendFriendRequest} 
            disabled={loading || !searchEmail.trim()}
            className="rounded-xl"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Pending Requests</h4>
            {pendingRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 bg-card/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">Friend request</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRequest(request.id, true)}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRequest(request.id, false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Friends List */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Your Friends ({friends.length})</h4>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No friends yet. Start by sending a request!
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((friendship) => (
                <motion.div
                  key={friendship.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-3 bg-card/50 rounded-xl hover-scale"
                >
                  <Avatar>
                    <AvatarFallback>👤</AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1">Friend</span>
                  <Button size="sm" variant="outline" className="rounded-full">
                    View Calendar
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};