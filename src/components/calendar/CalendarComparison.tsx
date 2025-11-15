import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calendarService, DaySchedule, TimeBlock } from "@/services/calendarService";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarComparisonProps {
  selectedFriendId: string | null;
}

export const CalendarComparison = ({ selectedFriendId }: CalendarComparisonProps) => {
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    return new Date(today.setDate(diff));
  });

  useEffect(() => {
    loadSchedules();
  }, [selectedFriendId, currentWeekStart]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const data = await calendarService.compareCalendars(
        user.id,
        selectedFriendId,
        currentWeekStart,
        weekEnd
      );

      setSchedules(data);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getBlockColor = (type: TimeBlock['type']) => {
    switch (type) {
      case 'busy':
        return 'bg-primary/20 border-primary/50';
      case 'free':
        return 'bg-muted/30 border-border';
      case 'overlap':
        return 'bg-green-500/30 border-green-500 ring-2 ring-green-500/50';
    }
  };

  const renderTimeBlocks = (blocks: TimeBlock[], label: string) => {
    if (blocks.length === 0) return null;

    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className={`p-2 rounded border ${getBlockColor(block.type)} transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">
                {formatTime(block.start)} - {formatTime(block.end)}
              </span>
              {block.type === 'overlap' && (
                <Badge variant="secondary" className="text-[10px] bg-green-500 text-white">
                  Both Free
                </Badge>
              )}
            </div>
            {block.eventTitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{block.eventTitle}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-medium">
          {currentWeekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
          {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/20 border border-primary/50" />
          <span>Busy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/30 border border-border" />
          <span>Free</span>
        </div>
        {selectedFriendId && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500 ring-2 ring-green-500/50" />
            <span>Both Free (Overlapping)</span>
          </div>
        )}
      </div>

      {/* Week View */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {schedules.map((schedule) => {
          const isToday = schedule.date.toDateString() === new Date().toDateString();
          
          return (
            <Card
              key={schedule.date.toISOString()}
              className={`p-4 space-y-4 ${isToday ? 'ring-2 ring-primary' : ''}`}
            >
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {schedule.date.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className="text-lg font-bold">
                  {schedule.date.getDate()}
                </p>
                {isToday && (
                  <Badge variant="default" className="text-[10px] mt-1">Today</Badge>
                )}
              </div>

              {/* Your Calendar */}
              {renderTimeBlocks(schedule.userBlocks, "Your Schedule")}

              {/* Friend's Calendar */}
              {selectedFriendId && schedule.friendBlocks && (
                <>
                  <div className="border-t pt-3" />
                  {renderTimeBlocks(schedule.friendBlocks, "Friend's Schedule")}
                </>
              )}

              {/* Overlapping Free Time */}
              {selectedFriendId && schedule.overlapBlocks.length > 0 && (
                <>
                  <div className="border-t pt-3" />
                  {renderTimeBlocks(schedule.overlapBlocks, "Available Together")}
                </>
              )}

              {/* No overlap message */}
              {selectedFriendId && 
               schedule.friendBlocks && 
               schedule.overlapBlocks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  No overlapping free time
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
