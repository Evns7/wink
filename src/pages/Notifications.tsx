import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { NotificationTabs } from "@/components/notifications/NotificationTabs";
import { Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";

interface Invitation {
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
}

export default function Notifications() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    checkAuth();
    fetchInvitations();
    setupRealtimeSubscription();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(session.user.id);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('activity-invitations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_invitations',
        },
        (payload) => {
          console.log('Invitation change:', payload);
          fetchInvitations();
          
          if (payload.eventType === 'INSERT') {
            const newInvitation = payload.new as any;
            if (newInvitation.invitee_id === currentUserId && newInvitation.status === 'pending') {
              toast.success("New activity invitation!", {
                description: "Check your invitations tab",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all invitations where user is either inviter or invitee
      const { data, error } = await supabase
        .from('activity_invitations')
        .select(`
          *,
          activities (
            id,
            name,
            category,
            address,
            price_level,
            lat,
            lng
          )
        `)
        .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user details for each invitation
      const invitationsWithUsers = await Promise.all(
        (data || []).map(async (inv) => {
          const [inviterResult, inviteeResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('nickname, id')
              .eq('id', inv.inviter_id)
              .single(),
            supabase
              .from('profiles')
              .select('nickname, id')
              .eq('id', inv.invitee_id)
              .single(),
          ]);

          // Get emails from auth if needed
          const inviterEmail = inv.inviter_id;
          const inviteeEmail = inv.invitee_id;

          return {
            ...inv,
            activity: inv.activities,
            inviter: {
              nickname: inviterResult.data?.nickname || '',
              email: inviterEmail,
            },
            invitee: {
              nickname: inviteeResult.data?.nickname || '',
              email: inviteeEmail,
            },
          };
        })
      );

      setInvitations(invitationsWithUsers as Invitation[]);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    try {
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) return;

      // Update invitation status to accepted
      const { error: updateError } = await supabase
        .from('activity_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // Check for match using RPC
      const { data: isMatch, error: matchError } = await supabase
        .rpc('check_activity_match', {
          p_user_id: invitation.invitee_id,
          p_friend_id: invitation.inviter_id,
          p_activity_id: invitation.activity_id,
          p_suggested_time: invitation.suggested_time,
        });

      if (matchError) throw matchError;

      if (isMatch) {
        // Update both invitations to matched
        const { error: matchUpdateError } = await supabase
          .from('activity_invitations')
          .update({ status: 'matched' })
          .or(`inviter_id.eq.${invitation.inviter_id},inviter_id.eq.${invitation.invitee_id}`)
          .eq('activity_id', invitation.activity_id)
          .eq('suggested_time', invitation.suggested_time);

        if (matchUpdateError) throw matchUpdateError;

        toast.success("It's a match! 🎉", {
          description: "You both want to do this activity!",
        });
      } else {
        toast.success("Invitation accepted", {
          description: "Waiting for your friend to accept too",
        });
      }

      fetchInvitations();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error("Failed to accept invitation");
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('activity_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      toast.success("Invitation declined");
      fetchInvitations();
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast.error("Failed to decline invitation");
    }
  };

  const handleCancel = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('activity_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast.success("Invitation cancelled");
      fetchInvitations();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error("Failed to cancel invitation");
    }
  };

  const handleAddToCalendar = async (invitation: Invitation) => {
    try {
      if (!invitation.activity) return;

      const { error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          activityName: invitation.activity.name,
          activityAddress: invitation.activity.address,
          startTime: invitation.suggested_time,
          duration: 120, // 2 hours default
        },
      });

      if (error) throw error;

      toast.success("Added to calendar!", {
        description: "Event has been added to your calendar",
      });
    } catch (error) {
      console.error('Error adding to calendar:', error);
      toast.error("Failed to add to calendar");
    }
  };

  // Filter invitations by status and role
  const pendingInvitations = invitations.filter(
    inv => inv.status === 'pending' && inv.invitee_id === currentUserId
  );
  const myAccepts = invitations.filter(
    inv => (inv.status === 'pending' || inv.status === 'accepted') && inv.inviter_id === currentUserId
  );
  const matches = invitations.filter(inv => inv.status === 'matched');

  const EmptyState = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-muted-foreground">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Notifications</h1>
          <p className="text-muted-foreground">Manage your activity invitations and matches</p>
        </div>

        <NotificationTabs
          pendingCount={pendingInvitations.length}
          acceptsCount={myAccepts.length}
          matchesCount={matches.length}
        >
          {{
            invitations: (
              <div className="space-y-4">
                {pendingInvitations.length === 0 ? (
                  <EmptyState
                    icon={<Inbox className="h-16 w-16" />}
                    title="No pending invitations"
                    description="When friends invite you to activities, they'll appear here."
                  />
                ) : (
                  pendingInvitations.map(inv => (
                    <NotificationCard
                      key={inv.id}
                      invitation={inv}
                      currentUserId={currentUserId}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                    />
                  ))
                )}
              </div>
            ),
            accepts: (
              <div className="space-y-4">
                {myAccepts.length === 0 ? (
                  <EmptyState
                    icon={<Inbox className="h-16 w-16" />}
                    title="No pending accepts"
                    description="Activities you accept will appear here while waiting for your friend's response."
                  />
                ) : (
                  myAccepts.map(inv => (
                    <NotificationCard
                      key={inv.id}
                      invitation={inv}
                      currentUserId={currentUserId}
                      onCancel={handleCancel}
                    />
                  ))
                )}
              </div>
            ),
            matches: (
              <div className="space-y-4">
                {matches.length === 0 ? (
                  <EmptyState
                    icon={<Inbox className="h-16 w-16" />}
                    title="No matches yet"
                    description="When you and a friend both accept the same activity, it becomes a match!"
                  />
                ) : (
                  matches.map(inv => (
                    <NotificationCard
                      key={inv.id}
                      invitation={inv}
                      currentUserId={currentUserId}
                      onAddToCalendar={handleAddToCalendar}
                    />
                  ))
                )}
              </div>
            ),
          }}
        </NotificationTabs>
      </div>
    </div>
  );
}
