import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, MapPin, Clock, DollarSign, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    // Fetch preferences
    const { data: prefsData } = await supabase
      .from("preferences")
      .select("*")
      .eq("user_id", user.id);

    setPreferences(prefsData || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Header />
      
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-8">
            <Avatar className="h-20 w-20 border-4 border-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl font-bold">
                U
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">Your Profile</h1>
              <p className="text-muted-foreground">Manage your account settings and preferences</p>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Location
                </CardTitle>
                <CardDescription>Your home base for activity recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Home Address</Label>
                    <Input 
                      value={profile?.home_address || "Not set"} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  {profile?.home_lat && profile?.home_lng && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Latitude</Label>
                        <Input value={profile.home_lat} disabled className="mt-1" />
                      </div>
                      <div>
                        <Label>Longitude</Label>
                        <Input value={profile.home_lng} disabled className="mt-1" />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Schedule Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Schedule
                </CardTitle>
                <CardDescription>Your daily routine preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Wake Time</Label>
                    <Input 
                      value={profile?.wake_time || "Not set"} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Sleep Time</Label>
                    <Input 
                      value={profile?.sleep_time || "Not set"} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Budget
                </CardTitle>
                <CardDescription>Your spending preferences for activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Minimum Budget</Label>
                    <Input 
                      value={profile?.budget_min ? `$${profile.budget_min}` : "Not set"} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Maximum Budget</Label>
                    <Input 
                      value={profile?.budget_max ? `$${profile.budget_max}` : "Not set"} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Activity Preferences
                </CardTitle>
                <CardDescription>Your favorite types of activities</CardDescription>
              </CardHeader>
              <CardContent>
                {preferences.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {preferences.map((pref) => (
                      <div
                        key={pref.id}
                        className="px-4 py-2 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        {pref.category} ({pref.score}/5)
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No preferences set</p>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Actions */}
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate("/onboarding")}
                className="flex-1"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Update Preferences
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
