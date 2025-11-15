import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, ArrowLeft, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Friend {
  id: string;
  email: string;
}

interface Activity {
  id: string;
  name: string;
  category: string;
  address: string;
  distance: number;
  price_level: number;
}

interface FreeBlock {
  start: string;
  end: string;
  duration: number;
}

const MakePlans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [freeBlocks, setFreeBlocks] = useState<FreeBlock[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [step, setStep] = useState<'select-friend' | 'loading' | 'swipe'>('select-friend');

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: friendships, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        friend_id
      `)
      .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friends:', error);
      setLoading(false);
      return;
    }

    // Get friend IDs and fetch their emails
    const friendIds = friendships?.map(f => 
      f.user_id === session.user.id ? f.friend_id : f.user_id
    ) || [];

    if (friendIds.length === 0) {
      toast({
        title: "No friends yet",
        description: "Add friends to start making plans together!",
      });
      setLoading(false);
      return;
    }

    // For now, we'll use friend IDs as placeholders
    // In production, you'd fetch actual profile data
    const friendsList = friendIds.map(id => ({ id, email: `friend-${id.slice(0, 8)}` }));
    setFriends(friendsList);
    setLoading(false);
  };

  const handleSelectFriend = async (friend: Friend) => {
    setSelectedFriend(friend);
    setStep('loading');

    try {
      // Get overlapping free time
      const { data: { session } } = await supabase.auth.getSession();
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: availabilityData, error: availError } = await supabase.functions.invoke(
        'analyze-group-availability',
        {
          body: {
            friendIds: [friend.id],
            startDate,
            endDate,
          }
        }
      );

      if (availError) throw availError;

      setFreeBlocks(availabilityData.freeBlocks || []);

      // Get activity recommendations for the first free block
      if (availabilityData.freeBlocks && availabilityData.freeBlocks.length > 0) {
        const firstBlock = availabilityData.freeBlocks[0];
        
        const { data: recommendationsData, error: recError } = await supabase.functions.invoke(
          'smart-activity-recommendations',
          {
            body: {
              startTime: firstBlock.start,
              friendIds: [friend.id],
              weather: { temp: 20, condition: 'clear' }, // Mock weather
            }
          }
        );

        if (recError) throw recError;

        setActivities(recommendationsData.activities || []);
        setStep('swipe');
      } else {
        toast({
          title: "No free time found",
          description: "You and your friend don't have overlapping free time in the next 7 days.",
        });
        setStep('select-friend');
      }
    } catch (error) {
      console.error('Error finding matches:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find matching activities. Please try again.",
      });
      setStep('select-friend');
    }
  };

  const handleSwipe = async (accepted: boolean) => {
    if (!selectedFriend || currentActivityIndex >= activities.length) return;

    const activity = activities[currentActivityIndex];

    if (accepted) {
      // Create activity invitation
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('activity_invitations')
        .insert({
          inviter_id: session!.user.id,
          invitee_id: selectedFriend.id,
          activity_id: activity.id,
          suggested_time: freeBlocks[0]?.start,
          status: 'pending',
        });

      if (error) {
        console.error('Error creating invitation:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not send activity invitation.",
        });
      } else {
        toast({
          title: "Invitation sent!",
          description: `${activity.name} has been suggested to your friend.`,
        });
      }
    }

    // Move to next activity
    if (currentActivityIndex < activities.length - 1) {
      setCurrentActivityIndex(currentActivityIndex + 1);
    } else {
      toast({
        title: "All activities reviewed!",
        description: "Check back later to see if your friend accepted any suggestions.",
      });
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-wink flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-wink p-8 relative">
      {/* Back button */}
      <Button
        onClick={() => navigate('/dashboard')}
        variant="ghost"
        className="absolute top-8 left-8 text-white hover:bg-white/20"
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back
      </Button>

      {/* Title */}
      <div className="text-center pt-20 mb-12">
        <h1 className="text-6xl font-display italic text-white mb-4">make plans</h1>
        <p className="text-white/80 text-lg">Find the perfect activity with your friends</p>
      </div>

      {/* Friend Selection */}
      {step === 'select-friend' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-2xl text-white text-center mb-8">Who do you want to hang out with?</h2>
          <div className="grid gap-4">
            {friends.map((friend) => (
              <Card
                key={friend.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSelectFriend(friend)}
              >
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">Friend</p>
                    <p className="text-sm text-muted-foreground">{friend.email}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-white text-2xl mb-4">Finding perfect activities...</div>
          <div className="text-white/60">Analyzing schedules and preferences</div>
        </div>
      )}

      {/* Swipe Cards */}
      {step === 'swipe' && activities.length > 0 && currentActivityIndex < activities.length && (
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentActivityIndex}
              initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateY: 10 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <div className="text-6xl">🎯</div>
                </div>
                <div className="p-8">
                  <h3 className="text-3xl font-bold mb-2">{activities[currentActivityIndex].name}</h3>
                  <p className="text-muted-foreground mb-4 capitalize">
                    {activities[currentActivityIndex].category}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    📍 {activities[currentActivityIndex].address}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    💰 {'$'.repeat(activities[currentActivityIndex].price_level || 1)}
                  </p>
                  {freeBlocks[0] && (
                    <p className="text-sm text-muted-foreground mt-4">
                      🕐 Available: {new Date(freeBlocks[0].start).toLocaleString()}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Swipe buttons */}
          <div className="flex justify-center gap-8 mt-12">
            <Button
              onClick={() => handleSwipe(false)}
              size="lg"
              variant="outline"
              className="w-20 h-20 rounded-full bg-white hover:bg-red-50 border-red-200"
            >
              <X className="h-10 w-10 text-red-500" />
            </Button>
            <Button
              onClick={() => handleSwipe(true)}
              size="lg"
              className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90"
            >
              <Heart className="h-10 w-10 text-white" />
            </Button>
          </div>

          <p className="text-center text-white/60 mt-8">
            {activities.length - currentActivityIndex - 1} more activities to review
          </p>
        </div>
      )}
    </div>
  );
};

export default MakePlans;
