import { Link, useNavigate, useLocation } from "react-router-dom";
import { Home, User, LogOut, Calendar, Sparkles, Clock, Bell } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "./ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { timezoneService, TimezoneInfo } from "@/services/timezoneService";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [timezone, setTimezone] = useState<TimezoneInfo | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [notificationCount, setNotificationCount] = useState(0);

  // Detect timezone on mount
  useEffect(() => {
    const detectTz = async () => {
      const tz = await timezoneService.detectTimezone();
      setTimezone(tz);
    };
    detectTz();
    fetchNotificationCount();
    setupRealtimeSubscription();
  }, []);

  const fetchNotificationCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('activity_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('invitee_id', user.id)
        .eq('status', 'pending');

      if (!error && count !== null) {
        setNotificationCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_invitations',
        },
        () => {
          fetchNotificationCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Update time every minute
  useEffect(() => {
    if (!timezone) return;

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }));
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timezone]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out successfully",
      description: "See you soon!",
    });
    navigate("/");
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs = [];

    if (path === "/dashboard") {
      crumbs.push({ label: "Dashboard", path: "/dashboard", active: true });
    } else if (path === "/make-plans") {
      crumbs.push({ label: "Dashboard", path: "/dashboard", active: false });
      crumbs.push({ label: "Make Plans", path: "/make-plans", active: true });
    } else if (path === "/calendar") {
      crumbs.push({ label: "Dashboard", path: "/dashboard", active: false });
      crumbs.push({ label: "Calendar", path: "/calendar", active: true });
    } else if (path === "/profile") {
      crumbs.push({ label: "Dashboard", path: "/dashboard", active: false });
      crumbs.push({ label: "Profile", path: "/profile", active: true });
    } else if (path === "/notifications") {
      crumbs.push({ label: "Dashboard", path: "/dashboard", active: false });
      crumbs.push({ label: "Notifications", path: "/notifications", active: true });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (location.pathname === "/" || location.pathname === "/auth" || location.pathname === "/onboarding") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 transition-transform hover:scale-105">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Wink
            </span>
          </Link>

          {/* Timezone and Time Display */}
          {timezone && currentTime && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">{currentTime}</span>
                <span className="text-[10px] text-muted-foreground">
                  {timezone.timezone.split('/')[1]?.replace('_', ' ') || timezone.timezone} ({timezone.abbreviation})
                </span>
              </div>
            </div>
          )}

          {breadcrumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard" className="flex items-center gap-1">
                      <Home className="h-4 w-4" />
                      Home
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.active ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.path}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </div>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" asChild>
            <Link to="/make-plans">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Make Plans</span>
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" asChild>
            <Link to="/calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    U
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/notifications" className="cursor-pointer">
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Notifications</span>
                  {notificationCount > 0 && (
                    <Badge variant="default" className="ml-auto h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {notificationCount}
                    </Badge>
                  )}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
};
