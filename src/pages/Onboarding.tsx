import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ShoppingBag, Utensils, Dumbbell, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    homeAddress: "",
    nickname: "",
    hobbyScores: {} as { [key: string]: number },
    budgetMin: 0,
    budgetMax: 50,
    wakeTime: "07:00",
    sleepTime: "23:00",
  });

  const hobbyOptions = [
    { id: "shopping", label: "Shopping", icon: "🛍️" },
    { id: "cafe", label: "Cafe Hopping", icon: "☕" },
    { id: "sports", label: "Sports", icon: "⚽" },
    { id: "studying", label: "Studying", icon: "📚" },
    { id: "music", label: "Music", icon: "🎵" },
    { id: "concerts", label: "Concerts", icon: "🎤" },
    { id: "parties", label: "Parties", icon: "🎉" },
    { id: "hiking", label: "Hiking", icon: "🥾" },
    { id: "food", label: "Food & Dining", icon: "🍽️" },
    { id: "movies", label: "Movies", icon: "🎬" },
    { id: "arts", label: "Arts & Culture", icon: "🎨" },
    { id: "gaming", label: "Gaming", icon: "🎮" },
    { id: "fitness", label: "Fitness", icon: "💪" },
    { id: "photography", label: "Photography", icon: "📸" },
    { id: "cooking", label: "Cooking", icon: "👨‍🍳" },
  ];
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth');
      else setUserId(session.user.id);
    });
  }, [navigate]);

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Location not supported",
        description: "Your browser doesn't support geolocation.",
      });
      return;
    }

    setGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      
      // Reverse geocode to get address
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      const address = data.display_name || `${latitude}, ${longitude}`;

      setPreferences(prev => ({ ...prev, homeAddress: address }));
      toast({
        title: "Location detected",
        description: "Your current location has been set.",
      });
    } catch (error) {
      console.error('Location error:', error);
      toast({
        variant: "destructive",
        title: "Location access denied",
        description: "Please enter your address manually.",
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const geocodeAddress = async (address: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await response.json();
      if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      let coords = null;
      if (preferences.homeAddress) {
        coords = await geocodeAddress(preferences.homeAddress);
        if (!coords) {
          toast({
            variant: "destructive",
            title: "Address not found",
            description: "Please try a different address.",
          });
          setLoading(false);
          return;
        }
      }

          const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          nickname: preferences.nickname.trim() || null,
          home_address: preferences.homeAddress,
          home_lat: coords?.lat,
          home_lng: coords?.lng,
          budget_min: preferences.budgetMin,
          budget_max: preferences.budgetMax,
          wake_time: preferences.wakeTime,
          sleep_time: preferences.sleepTime,
        });

      if (profileError) throw profileError;

      // Save hobby scores (1-5 scale)
      const prefsToSave = hobbyOptions.map(hobby => ({
        user_id: userId,
        category: hobby.id,
        score: preferences.hobbyScores[hobby.id] || 0,
      }));

      const { error: prefsError } = await supabase
        .from('preferences')
        .upsert(prefsToSave, { onConflict: 'user_id,category' });

      if (prefsError) throw prefsError;

      toast({
        title: "Profile Created!",
        description: "Your preferences have been saved.",
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save your preferences.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateHobbyScore = (hobbyId: string, score: number) => {
    setPreferences(prev => ({
      ...prev,
      hobbyScores: {
        ...prev.hobbyScores,
        [hobbyId]: score,
      },
    }));
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl glass border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            {step === 1 && "Welcome to Wink! 👋"}
            {step === 2 && "Rate Your Activity Preferences"}
            {step === 3 && "Daily Schedule & Budget"}
          </CardTitle>
          <CardDescription className="text-base">
            {step === 1 && "Let's set up your profile so we can give you the best recommendations"}
            {step === 2 && "Rate each activity from 1-5 (1 = not interested, 5 = love it!)"}
            {step === 3 && "Help us understand your daily routine and spending"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-lg">Display Name</Label>
                <Input
                  id="nickname"
                  placeholder="How should friends see you?"
                  value={preferences.nickname}
                  onChange={(e) => setPreferences({ ...preferences, nickname: e.target.value })}
                  className="h-12 text-base rounded-xl"
                  maxLength={50}
                />
                <p className="text-sm text-muted-foreground">
                  This is what your friends will see in activity suggestions and friend requests
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-lg">Home Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    placeholder="123 Main St, City, Country"
                    value={preferences.homeAddress}
                    onChange={(e) => setPreferences({ ...preferences, homeAddress: e.target.value })}
                    className="h-12 text-base rounded-xl flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    className="h-12 px-6 rounded-xl"
                  >
                    {gettingLocation ? "Getting..." : "📍 Use Current"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  We'll use this to calculate travel times and suggest nearby activities
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Hobbies Selection */}
          {step === 2 && (
            <div className="space-y-6">
              {hobbyOptions.map((hobby) => {
                const score = preferences.hobbyScores[hobby.id] || 0;
                return (
                  <div key={hobby.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{hobby.icon}</span>
                        <Label className="text-base font-medium">{hobby.label}</Label>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground min-w-[3rem] text-right">
                        {score === 0 ? "Not rated" : `${score}/5`}
                      </span>
                    </div>
                    <Slider
                      value={[score]}
                      onValueChange={(values) => updateHobbyScore(hobby.id, values[0])}
                      min={0}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: Schedule & Budget */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wake">Wake Up Time</Label>
                  <Input
                    id="wake"
                    type="time"
                    value={preferences.wakeTime}
                    onChange={(e) => setPreferences({ ...preferences, wakeTime: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleep">Sleep Time</Label>
                  <Input
                    id="sleep"
                    type="time"
                    value={preferences.sleepTime}
                    onChange={(e) => setPreferences({ ...preferences, sleepTime: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-lg">Budget Range (per activity)</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">$0</span>
                  <Slider
                    value={[preferences.budgetMin, preferences.budgetMax]}
                    onValueChange={(value) => setPreferences({ ...preferences, budgetMin: value[0], budgetMax: value[1] })}
                    max={200}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium">$200</span>
                </div>
                <p className="text-center text-lg font-semibold text-primary">
                  ${preferences.budgetMin} - ${preferences.budgetMax}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-12 rounded-xl text-base"
              >
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="flex-1 h-12 rounded-xl text-base"
              disabled={loading}
            >
              {loading ? "Saving..." : step < 3 ? (
                <>Next <ArrowRight className="ml-2 w-4 h-4" /></>
              ) : (
                "Get Started!"
              )}
            </Button>
          </div>

          {/* Progress Indicator */}
          <div className="flex gap-2 justify-center pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-smooth ${
                  i === step ? "w-8 bg-primary" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
