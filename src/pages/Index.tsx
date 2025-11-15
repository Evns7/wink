import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Cloud, Users, Sparkles, ArrowRight, Zap, Heart } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  useEffect(() => {
    if (heroRef.current) {
      gsap.from(".hero-title", {
        duration: 1,
        y: 50,
        opacity: 0,
        ease: "power3.out",
        delay: 0.2,
      });
      
      gsap.from(".hero-subtitle", {
        duration: 1,
        y: 30,
        opacity: 0,
        ease: "power3.out",
        delay: 0.4,
      });

      gsap.from(".hero-buttons", {
        duration: 1,
        y: 30,
        opacity: 0,
        ease: "power3.out",
        delay: 0.6,
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="fixed inset-0 bg-[var(--gradient-mesh)] opacity-50" style={{ zIndex: 1 }} />

      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="relative z-50 container mx-auto px-6 py-6 flex justify-between items-center"
      >
        <Link to="/" className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <span className="font-bold text-2xl bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Wink
          </span>
        </Link>
        <div className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button asChild className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Link to="/auth">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.nav>

      <motion.div
        ref={heroRef}
        style={{ opacity, scale }}
        className="relative z-10 min-h-[90vh] flex items-center justify-center px-6 text-center"
      >
        <div className="max-w-5xl mx-auto space-y-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
            <span className="text-6xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Wink
            </span>
          </motion.div>
          
          <h1 className="hero-title text-5xl md:text-7xl lg:text-8xl font-black text-foreground mb-6 leading-tight">
            Turn Free Moments Into
            <span className="block mt-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Meaningful Experiences
            </span>
          </h1>
          
          <p className="hero-subtitle text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
            Your AI-powered companion for discovering activities that perfectly match your schedule, 
            mood, and location. Life's too short for boring moments.
          </p>

          <motion.div
            className="hero-buttons flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Button 
              size="lg" 
              asChild 
              className="text-lg px-10 py-7 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-2xl shadow-primary/50 group"
            >
              <Link to="/auth">
                Get Started Free
                <Zap className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              asChild 
              className="text-lg px-10 py-7 border-2 hover:bg-muted/50"
            >
              <Link to="#features">
                See How It Works
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-16 flex items-center justify-center gap-8 text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-accent" />
              <span>Free to start</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span>AI-powered</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-20 max-w-3xl mx-auto"
          >
            <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border border-primary/20 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
              <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
                Wink was born from the spirit of Movember and its message about men&apos;s mental health and the silent epidemic of loneliness. We realised that most of us want to make plans, but life, schedules and invisible barriers get in the way. Wink makes it effortless to see when friends are free, discover things you can enjoy together, and turn good intentions into real moments. It&apos;s a small push—a wink—that helps people connect more often and with less friction.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        id="features"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="relative z-10 py-32 px-6"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-black mb-6">
              Why Choose <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Wink</span>?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Calendar, title: "Smart Scheduling", description: "AI analyzes your calendar to find perfect time slots." },
              { icon: Cloud, title: "Weather-Aware", description: "Real-time weather integration for perfect outings." },
              { icon: Users, title: "Friend Matching", description: "Connect with friends effortlessly." },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className="glass p-10 rounded-2xl"
              >
                <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-primary to-accent mb-6">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <footer className="relative z-10 py-12 px-6 border-t">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 Wink. Making every moment meaningful.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
