import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface NotificationTabsProps {
  pendingCount: number;
  acceptsCount: number;
  matchesCount: number;
  children: {
    invitations: React.ReactNode;
    accepts: React.ReactNode;
    matches: React.ReactNode;
  };
}

export const NotificationTabs = ({
  pendingCount,
  acceptsCount,
  matchesCount,
  children,
}: NotificationTabsProps) => {
  return (
    <Tabs defaultValue="invitations" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="invitations" className="relative">
          Invitations
          {pendingCount > 0 && (
            <Badge
              variant="default"
              className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="accepts" className="relative">
          My Accepts
          {acceptsCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {acceptsCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="matches" className="relative">
          Matches
          {matchesCount > 0 && (
            <Badge
              variant="default"
              className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {matchesCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="invitations" className="mt-6">
        {children.invitations}
      </TabsContent>

      <TabsContent value="accepts" className="mt-6">
        {children.accepts}
      </TabsContent>

      <TabsContent value="matches" className="mt-6">
        {children.matches}
      </TabsContent>
    </Tabs>
  );
};
