import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ShoppingBag, Utensils, Dumbbell, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    homeAddress: "",
    food: 5,
    shopping: 5,
    sports: 5,
    studying: 5,
    budgetMin: 0,
    budgetMax: 50,
    wakeTime: "07:00",
    sleepTime: "23:00",
  });

  const categories = [
    { key: "food", label: "Food & Dining", icon: Utensils, color: "category-food" },
    { key: "shopping", label: "Shopping", icon: ShoppingBag, color: "category-shopping" },
    { key: "sports", label: "Sports & Outdoor", icon: Dumbbell, color: "category-sports" },
    { key: "studying", label: "Studying", icon: BookOpen, color: "category-studying" },
  ];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else navigate("/dashboard");
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-afternoon flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl glass border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            {step === 1 && "Welcome to Wink! 👋"}
            {step === 2 && "What Do You Enjoy?"}
            {step === 3 && "Daily Schedule & Budget"}
          </CardTitle>
          <CardDescription className="text-base">
            {step === 1 && "Let's set up your profile so we can give you the best recommendations"}
            {step === 2 && "Rate your interest in these categories (0-10)"}
            {step === 3 && "Help us understand your daily routine and spending"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-lg">Home Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City, Country"
                  value={preferences.homeAddress}
                  onChange={(e) => setPreferences({ ...preferences, homeAddress: e.target.value })}
                  className="h-12 text-base rounded-xl"
                />
                <p className="text-sm text-muted-foreground">
                  We'll use this to calculate travel times to activities
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <div className="space-y-6">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-${category.color}/10 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 text-${category.color}`} />
                      </div>
                      <Label className="text-lg flex-1">{category.label}</Label>
                      <span className="text-2xl font-bold text-primary w-12 text-right">
                        {preferences[category.key as keyof typeof preferences]}
                      </span>
                    </div>
                    <Slider
                      value={[preferences[category.key as keyof typeof preferences] as number]}
                      onValueChange={(value) => setPreferences({ ...preferences, [category.key]: value[0] })}
                      max={10}
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
            >
              {step < 3 ? (
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
