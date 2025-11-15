import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar } from "lucide-react";

interface TimeBlock {
  start: string;
  end: string;
  duration: number;
}

interface TimeBlockSelectorProps {
  timeBlocks: TimeBlock[];
  selectedTimeBlock: TimeBlock | null;
  onSelectTimeBlock: (block: TimeBlock) => void;
  disabled?: boolean;
}

export const TimeBlockSelector = ({
  timeBlocks,
  selectedTimeBlock,
  onSelectTimeBlock,
  disabled = false,
}: TimeBlockSelectorProps) => {
  const formatTimeBlock = (block: TimeBlock) => {
    const start = new Date(block.start);
    const end = new Date(block.end);
    
    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    
    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    
    const hours = Math.floor(block.duration / 60);
    const mins = block.duration % 60;
    const durationStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    
    return {
      date: dateStr,
      time: `${startTime} - ${endTime}`,
      duration: durationStr,
      full: `${dateStr} • ${startTime} - ${endTime} (${durationStr})`,
    };
  };

  const groupedBlocks = timeBlocks.reduce((acc, block) => {
    const formatted = formatTimeBlock(block);
    if (!acc[formatted.date]) {
      acc[formatted.date] = [];
    }
    acc[formatted.date].push({ block, formatted });
    return acc;
  }, {} as Record<string, Array<{ block: TimeBlock; formatted: ReturnType<typeof formatTimeBlock> }>>);

  return (
    <Select
      disabled={disabled}
      value={selectedTimeBlock ? JSON.stringify(selectedTimeBlock) : undefined}
      onValueChange={(value) => onSelectTimeBlock(JSON.parse(value))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a time slot">
          {selectedTimeBlock && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTimeBlock(selectedTimeBlock).full}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedBlocks).map(([date, blocks]) => (
          <div key={date}>
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {date}
            </div>
            {blocks.map(({ block, formatted }, idx) => (
              <SelectItem key={`${date}-${idx}`} value={JSON.stringify(block)}>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatted.time}</span>
                  <span className="text-xs text-muted-foreground">({formatted.duration})</span>
                </div>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
};
