import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cloud, Sun, CloudRain, Wind, Droplets, MapPin, Loader2, AlertCircle } from "lucide-react";
import { weatherService, CurrentWeather } from "@/services/weatherService";
import { motion } from "framer-motion";

interface HourlyForecast {
  time: string;
  temp_c: number;
  temp_f: number;
  condition: {
    text: string;
    icon: string;
  };
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useCelsius, setUseCelsius] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to get user's location weather first
      const weatherData = await weatherService.getWeatherForUserLocation();
      setWeather(weatherData);
      
      // Load today's forecast
      const forecastData = await weatherService.getForecastForUserLocation(1);
      const todayForecast = forecastData.forecast.forecastday[0];
      
      // Get current hour
      const currentHour = new Date().getHours();
      
      // Filter hourly data to show remaining hours of today (next 8 hours or until end of day)
      const remainingHours = todayForecast.hour
        .filter((hour: any) => {
          const hourTime = new Date(hour.time).getHours();
          return hourTime >= currentHour;
        })
        .slice(0, 8);
      
      setHourlyForecast(remainingHours);
    } catch (err) {
      console.error('Weather error:', err);
      
      // Fallback to default city if geolocation fails
      try {
        const weatherData = await weatherService.getCurrentWeatherByCity('London');
        setWeather(weatherData);
        
        const forecastData = await weatherService.getForecastByCity('London', 1);
        const todayForecast = forecastData.forecast.forecastday[0];
        const currentHour = new Date().getHours();
        
        const remainingHours = todayForecast.hour
          .filter((hour: any) => {
            const hourTime = new Date(hour.time).getHours();
            return hourTime >= currentHour;
          })
          .slice(0, 8);
        
        setHourlyForecast(remainingHours);
      } catch (fallbackErr) {
        setError('Unable to load weather data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('sunny') || lowerCondition.includes('clear')) {
      return <Sun className="w-12 h-12 text-yellow-400" />;
    } else if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
      return <CloudRain className="w-12 h-12 text-blue-400" />;
    } else if (lowerCondition.includes('cloud') || lowerCondition.includes('overcast')) {
      return <Cloud className="w-12 h-12 text-gray-400" />;
    } else {
      return <Cloud className="w-12 h-12 text-primary" />;
    }
  };

  const getActivitySuggestion = (temp: number, condition: string) => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('rain')) {
      return {
        emoji: '☔',
        text: 'Rainy day perfect for indoor activities!',
        suggestion: 'Try a museum visit or cozy cafe.'
      };
    } else if (temp > 25) {
      return {
        emoji: '☀️',
        text: 'Great weather for outdoor activities!',
        suggestion: 'Perfect for parks or outdoor dining.'
      };
    } else if (temp < 10) {
      return {
        emoji: '🧥',
        text: 'Bundle up for outdoor adventures!',
        suggestion: 'Great for winter sports or hot drinks.'
      };
    } else {
      return {
        emoji: '🌤️',
        text: 'Pleasant weather today!',
        suggestion: 'Ideal for a walk or outdoor lunch.'
      };
    }
  };

  if (loading) {
    return (
      <Card className="glass border-2">
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card className="glass border-2">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <div>
              <p className="font-semibold">Weather Unavailable</p>
              <p className="text-sm text-muted-foreground">{error || 'Failed to load weather data'}</p>
            </div>
          </div>
          <Button onClick={loadWeather} variant="outline" className="mt-4 rounded-xl">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const temp = useCelsius ? weather.current.temp_c : weather.current.temp_f;
  const feelsLike = useCelsius ? weather.current.feelslike_c : weather.current.feelslike_f;
  const activitySuggestion = getActivitySuggestion(weather.current.temp_c, weather.current.condition.text);

  return (
    <Card className="glass border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {weather.location.name}, {weather.location.country}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUseCelsius(!useCelsius)}
            className="rounded-full"
          >
            {useCelsius ? '°C' : '°F'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Weather */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              {getWeatherIcon(weather.current.condition.text)}
              <img 
                src={`https:${weather.current.condition.icon}`} 
                alt={weather.current.condition.text}
                className="absolute inset-0 w-12 h-12 opacity-0 hover:opacity-100 transition-opacity"
              />
            </div>
            <div>
              <div className="text-5xl font-bold">{Math.round(temp)}°{useCelsius ? 'C' : 'F'}</div>
              <div className="text-lg text-muted-foreground">{weather.current.condition.text}</div>
              <div className="text-sm text-muted-foreground">
                Feels like {Math.round(feelsLike)}°{useCelsius ? 'C' : 'F'}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-xs text-muted-foreground">Humidity</div>
                <div className="font-semibold">{weather.current.humidity}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-xs text-muted-foreground">Wind</div>
                <div className="font-semibold">{Math.round(weather.current.wind_kph)} km/h</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Activity Suggestion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="p-3 rounded-xl bg-primary/10"
        >
          <p className="text-sm">
            <span className="font-semibold text-primary">
              {activitySuggestion.emoji} {activitySuggestion.text}
            </span>
            {" "}{activitySuggestion.suggestion}
          </p>
        </motion.div>

        {/* Today's Hourly Forecast */}
        {hourlyForecast.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="space-y-3"
          >
            <h4 className="text-sm font-semibold text-muted-foreground">Today's Forecast</h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {hourlyForecast.map((hour, index) => {
                const hourTime = new Date(hour.time);
                const timeString = hourTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric',
                  hour12: true 
                });
                
                return (
                  <motion.div
                    key={hour.time}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass p-3 rounded-lg text-center min-w-[80px] flex-shrink-0"
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {timeString}
                    </p>
                    <div className="flex justify-center mb-2">
                      <img 
                        src={hour.condition.icon} 
                        alt={hour.condition.text}
                        className="w-8 h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {useCelsius ? Math.round(hour.temp_c) : Math.round(hour.temp_f)}°
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {hour.condition.text}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Refresh Button */}
        <Button
          onClick={loadWeather}
          variant="outline"
          size="sm"
          className="w-full rounded-xl"
        >
          Refresh Weather
        </Button>
      </CardContent>
    </Card>
  );
};

export default WeatherWidget;
