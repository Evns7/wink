import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Sun, CloudRain, Wind, Thermometer } from "lucide-react";

const WeatherWidget = () => {
  // Mock weather data
  const weather = {
    temp: 72,
    condition: "Partly Cloudy",
    humidity: 65,
    wind: 8,
    icon: "partly-cloudy",
  };

  const getWeatherIcon = () => {
    switch (weather.icon) {
      case "sunny":
        return <Sun className="w-12 h-12 text-yellow-400" />;
      case "rainy":
        return <CloudRain className="w-12 h-12 text-blue-400" />;
      case "cloudy":
        return <Cloud className="w-12 h-12 text-gray-400" />;
      default:
        return <Cloud className="w-12 h-12 text-primary" />;
    }
  };

  return (
    <Card className="glass border-2">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getWeatherIcon()}
            <div>
              <div className="text-4xl font-bold">{weather.temp}°F</div>
              <div className="text-lg text-muted-foreground">{weather.condition}</div>
            </div>
          </div>

          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Humidity</div>
                <div className="font-semibold">{weather.humidity}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Wind</div>
                <div className="font-semibold">{weather.wind} mph</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-primary/10 text-sm">
          <span className="font-semibold text-primary">☀️ Great weather for outdoor activities!</span>
          {" "}Try a walk in the park or outdoor dining.
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherWidget;
