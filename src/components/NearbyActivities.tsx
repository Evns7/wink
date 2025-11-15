import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Clock, DollarSign, Star, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  lat: number;
  lng: number;
  distance: number;
  travelTime: number;
  price: string;
  priceLevel: number;
  rating: number;
  matchScore: number;
  matchFactors: {
    preference: number;
    distance: number;
    rating: number;
  };
  imageUrl: string | null;
  source: string;
}

export const NearbyActivities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [budgetFilter, setBudgetFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      // Get user's location from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_lat, home_lng')
        .single();

      if (!profile?.home_lat || !profile?.home_lng) {
        toast({
          title: 'Location Required',
          description: 'Please set your location in settings first',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('nearby-activities-enhanced', {
        body: {
          lat: profile.home_lat,
          lng: profile.home_lng,
          radius: 5,
        },
      });

      if (error) throw error;

      setActivities(data.activities || []);
      setFilteredActivities(data.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load nearby activities',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    let filtered = [...activities];

    if (distanceFilter !== 'all') {
      const maxDistance = parseFloat(distanceFilter);
      filtered = filtered.filter(a => a.distance <= maxDistance);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => a.category.toLowerCase().includes(categoryFilter.toLowerCase()));
    }

    if (budgetFilter !== 'all') {
      if (budgetFilter === 'free') {
        filtered = filtered.filter(a => a.priceLevel === 0 || a.price.toLowerCase() === 'free');
      } else if (budgetFilter === 'low') {
        filtered = filtered.filter(a => a.priceLevel <= 1);
      } else if (budgetFilter === 'medium') {
        filtered = filtered.filter(a => a.priceLevel === 2);
      } else if (budgetFilter === 'high') {
        filtered = filtered.filter(a => a.priceLevel >= 3);
      }
    }

    setFilteredActivities(filtered);
  }, [distanceFilter, categoryFilter, budgetFilter, activities]);

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getPriceDisplay = (price: string, priceLevel: number) => {
    if (price.toLowerCase() === 'free' || priceLevel === 0) return 'Free';
    if (priceLevel === 1) return '$';
    if (priceLevel === 2) return '$$';
    if (priceLevel >= 3) return '$$$';
    return price;
  };

  const categories = Array.from(new Set(activities.map(a => a.category))).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Nearby Activities</h2>
        <Button onClick={fetchActivities} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={distanceFilter} onValueChange={setDistanceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Distance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Distances</SelectItem>
            <SelectItem value="1">Within 1 km</SelectItem>
            <SelectItem value="2">Within 2 km</SelectItem>
            <SelectItem value="5">Within 5 km</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={budgetFilter} onValueChange={setBudgetFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Budget" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Budgets</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="low">$ (Low)</SelectItem>
            <SelectItem value="medium">$$ (Medium)</SelectItem>
            <SelectItem value="high">$$$ (High)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No activities found. Try adjusting your filters.</p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredActivities.map((activity) => (
            <Card key={activity.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {activity.imageUrl && (
                <div className="h-48 w-full overflow-hidden">
                  <img
                    src={activity.imageUrl}
                    alt={activity.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg line-clamp-2">{activity.name}</h3>
                  <Badge className={`${getMatchColor(activity.matchScore)} text-white shrink-0`}>
                    {activity.matchScore}%
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {activity.description}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{activity.distance} km away</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>~{activity.travelTime} min walk</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{getPriceDisplay(activity.price, activity.priceLevel)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span>{activity.rating.toFixed(1)} / 5.0</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Badge variant="outline">{activity.category}</Badge>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`,
                      '_blank'
                    );
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Map
                </Button>

                {activity.matchScore >= 80 && (
                  <div className="text-xs text-muted-foreground italic">
                    Great match for your interests!
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
