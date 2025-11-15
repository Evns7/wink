import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Users } from "lucide-react";
import { Header } from "@/components/Header";

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Mock events
  const events: { [key: number]: any[] } = {
    5: [{ title: "Team Meeting", time: "9:00 AM", color: "primary" }],
    12: [
      { title: "Coffee Break", time: "2:00 PM", color: "category-food" },
      { title: "Gym Session", time: "6:00 PM", color: "category-sports" }
    ],
    18: [{ title: "Study Group", time: "4:00 PM", color: "category-studying" }],
    25: [{ title: "Shopping", time: "11:00 AM", color: "category-shopping" }],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <Header />
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Calendar</h1>
            <p className="text-lg text-muted-foreground">Manage your schedule and find free time</p>
          </div>
          <div className="flex gap-3">
            <Button className="rounded-xl">
              <Users className="w-4 h-4 mr-2" />
              View Friends
            </Button>
          </div>
        </div>

        {/* Calendar Card */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={previousMonth} className="rounded-xl">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-xl">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                <div key={`empty-${index}`} className="h-24 rounded-xl" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const isToday = 
                  day === new Date().getDate() &&
                  currentDate.getMonth() === new Date().getMonth() &&
                  currentDate.getFullYear() === new Date().getFullYear();
                const dayEvents = events[day] || [];

                return (
                  <div
                    key={day}
                    className={`h-24 rounded-xl p-2 border-2 transition-smooth hover:scale-105 cursor-pointer ${
                      isToday
                        ? "bg-primary/10 border-primary"
                        : dayEvents.length > 0
                        ? "bg-card border-border"
                        : "bg-muted/30 border-transparent"
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${isToday ? "text-primary" : ""}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-1 rounded bg-${event.color}/10 text-${event.color} truncate`}
                        >
                          {event.time}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(events)
              .flatMap(([day, dayEvents]) =>
                dayEvents.map((event) => ({ day: parseInt(day), ...event }))
              )
              .slice(0, 4)
              .map((event, idx) => (
                <Card key={idx} className="glass">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-2xl font-bold text-primary">{event.day}</div>
                      <div className="text-sm text-muted-foreground">
                        {monthNames[currentDate.getMonth()].slice(0, 3)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">{event.time}</p>
                    </div>
                    <Badge className={`bg-${event.color}/10 text-${event.color}`}>
                      Scheduled
                    </Badge>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>

        {/* Free Time Analysis */}
        <Card className="glass mt-8">
          <CardHeader>
            <CardTitle>This Week's Free Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-accent/10">
                <div>
                  <div className="font-semibold text-lg">Today</div>
                  <div className="text-sm text-muted-foreground">3 available slots</div>
                </div>
                <Badge className="text-lg px-4 py-2 bg-accent">8.5 hours</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                <div>
                  <div className="font-semibold text-lg">Tomorrow</div>
                  <div className="text-sm text-muted-foreground">2 available slots</div>
                </div>
                <Badge className="text-lg px-4 py-2">6 hours</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                <div>
                  <div className="font-semibold text-lg">This Week</div>
                  <div className="text-sm text-muted-foreground">15 available slots</div>
                </div>
                <Badge className="text-lg px-4 py-2">42 hours</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Calendar;
