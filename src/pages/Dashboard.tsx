import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import WeatherWidget from "@/components/WeatherWidget";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profileData || !profileData.home_lat || !profileData.home_lng) {
      navigate('/onboarding');
      return;
    }

    setProfile(profileData);
    setLoading(false);
  };

  const handleMakePlans = () => {
    navigate('/make-plans');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-wink flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="min-h-screen bg-gradient-wink p-8 relative overflow-hidden">
      {/* Top left - My Profile button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-8 left-8"
      >
        <Button
          onClick={() => navigate('/profile')}
          className="bg-white text-primary font-display italic text-xl px-8 py-6 rounded-full hover:bg-white/90 shadow-lg"
        >
          my profile
        </Button>
      </motion.div>

      {/* Top right - Wink logo */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-8 right-8"
      >
        <h1 className="text-5xl font-display italic text-white">wink</h1>
      </motion.div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto pt-32 grid grid-cols-12 gap-6">
        {/* Left column */}
        <div className="col-span-3 space-y-6">
          {/* Make Plans button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Button
              onClick={handleMakePlans}
              className="w-full h-40 bg-transparent border-4 border-white/40 text-white hover:bg-white/10 rounded-3xl"
            >
              <span className="text-6xl font-bold tracking-wider uppercase" style={{ 
                WebkitTextStroke: '2px rgba(255,255,255,0.6)',
                WebkitTextFillColor: 'transparent'
              }}>
                MAKE<br/>PLANS
              </span>
            </Button>
          </motion.div>

          {/* To-do card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-6 pb-12 relative shadow-xl"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)' }}
          >
            <h3 className="text-3xl font-display italic text-primary mb-4">to-do</h3>
            <div className="space-y-2 text-gray-600">
              <p className="text-sm">• Check friend schedules</p>
              <p className="text-sm">• Update preferences</p>
              <p className="text-sm">• Review activity matches</p>
            </div>
          </motion.div>
        </div>

        {/* Center column - Schedule cards */}
        <div className="col-span-6 space-y-6">
          {/* Today */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h3 className="text-white text-center text-sm tracking-widest uppercase">TODAY</h3>
            <div className="bg-white rounded-3xl p-8 shadow-xl min-h-[300px]">
              <p className="text-gray-400 text-center mt-20">Your schedule for today</p>
            </div>
          </motion.div>

          {/* Tomorrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <h3 className="text-white text-center text-sm tracking-widest uppercase">TOMORROW</h3>
            <div className="bg-white rounded-3xl p-8 shadow-xl min-h-[300px]">
              <p className="text-gray-400 text-center mt-20">Your schedule for tomorrow</p>
            </div>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="col-span-3 space-y-6">
          {/* Location badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-400/60 backdrop-blur-sm rounded-full px-8 py-4 text-center"
          >
            <h3 className="text-white text-xl tracking-widest uppercase">
              {profile?.home_address?.split(',')[0] || 'LONDON'}
            </h3>
          </motion.div>

          {/* Weather widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <WeatherWidget />
          </motion.div>

          {/* Quote */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="pt-8"
          >
            <p className="text-white text-4xl font-display italic leading-tight">
              "The only failure is not to try"
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
