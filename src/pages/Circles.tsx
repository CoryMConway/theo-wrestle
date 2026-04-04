import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc-client";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
  Send,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Circles() {
  const [, setLocation] = useLocation();
  const [inviteUsername, setInviteUsername] = useState("");
  const [friendSearch, setFriendSearch] = useState("");

  const utils = trpc.useUtils();
  const membersQuery = trpc.circle.members.useQuery();
  const pendingQuery = trpc.circle.pendingRequests.useQuery();
  const sentQuery = trpc.circle.sentRequests.useQuery();
  const feedQuery = trpc.circle.memberEntries.useQuery(
    { limit: 6 },
    { refetchInterval: 30000 }
  );

  const sendRequest = trpc.circle.sendRequest.useMutation({
    onSuccess: (data) => {
      toast.success(`Circle request sent to ${data.toUsername}!`);
      setInviteUsername("");
      utils.circle.members.invalidate();
      utils.circle.sentRequests.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const acceptRequest = trpc.circle.acceptRequest.useMutation({
    onSuccess: () => {
      toast.success("Circle request accepted!");
      utils.circle.pendingRequests.invalidate();
      utils.circle.pendingCount.invalidate();
      utils.circle.members.invalidate();
      utils.circle.memberEntries.invalidate();
    },
    onError: () => {
      toast.error("Failed to accept request.");
    },
  });

  const declineRequest = trpc.circle.declineRequest.useMutation({
    onSuccess: () => {
      toast.success("Request declined.");
      utils.circle.pendingRequests.invalidate();
      utils.circle.pendingCount.invalidate();
    },
    onError: () => {
      toast.error("Failed to decline request.");
    },
  });

  const removeMember = trpc.circle.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Removed from your circle.");
      utils.circle.members.invalidate();
      utils.circle.memberEntries.invalidate();
    },
    onError: () => {
      toast.error("Failed to remove member.");
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    sendRequest.mutate({ username: inviteUsername.trim() });
  };

  const members = membersQuery.data ?? [];
  const pendingRequests = pendingQuery.data ?? [];
  const sentRequests = sentQuery.data ?? [];
  const feedEntries = feedQuery.data ?? [];

  const filteredMembers = friendSearch
    ? members.filter(
        (m) =>
          m.username?.toLowerCase().includes(friendSearch.toLowerCase()) ||
          m.name?.toLowerCase().includes(friendSearch.toLowerCase())
      )
    : members;

  if (membersQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">
          Your Circles
        </h1>
        <p className="text-muted-foreground">
          Connect with others to share your theological wrestlings.
        </p>
      </div>

      {/* Invite Section */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleInvite} className="flex gap-2">
            <div className="relative flex-1">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter a username to invite..."
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                className="w-full rounded-lg border bg-background px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              type="submit"
              disabled={!inviteUsername.trim() || sendRequest.isPending}
              className="gap-2"
            >
              {sendRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Pending Requests
          </h2>
          {pendingRequests.map((req) => (
            <PendingRequestCard
              key={req.id}
              request={req}
              onAccept={(shareBack) =>
                acceptRequest.mutate({
                  requestId: req.id,
                  shareBack,
                })
              }
              onDecline={() => declineRequest.mutate({ requestId: req.id })}
              isAccepting={acceptRequest.isPending}
              isDeclining={declineRequest.isPending}
            />
          ))}
        </div>
      )}

      {/* Sent Requests (Pending) */}
      {sentRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Sent Requests
          </h2>
          {sentRequests.map((req) => (
            <Card key={req.id} className="border-border/50 bg-muted/30">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-muted-foreground">
                      {(
                        req.toName?.charAt(0) ||
                        req.toUsername?.charAt(0) ||
                        "?"
                      ).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {req.toName || req.toUsername}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{req.toUsername}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal shrink-0">
                    <span className="relative mr-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                    Awaiting response
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Wrestlings Feed */}
      {feedEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent Wrestlings
            </h2>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feedEntries.map((entry) => (
              <Card
                key={entry.id}
                className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() =>
                  setLocation(`/circle/${entry.userId}`)
                }
              >
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {(
                            entry.memberName?.charAt(0) ||
                            entry.username?.charAt(0) ||
                            "?"
                          ).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {entry.memberName || entry.username}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-foreground transition-colors" />
                    </div>
                    <h3 className="font-serif font-medium text-sm text-foreground line-clamp-1">
                      {entry.title || "Untitled Reflection"}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {entry.aiStatus === "completed" && entry.aiSummary
                        ? entry.aiSummary
                        : entry.content.substring(0, 120) +
                          (entry.content.length > 120 ? "..." : "")}
                    </p>
                    {entry.aiTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.aiTags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] font-normal"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {entry.aiTags.length > 2 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal text-muted-foreground"
                          >
                            +{entry.aiTags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Your Friends Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Your Friends
          </h2>
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "friend" : "friends"}
          </span>
        </div>

        {members.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search friends..."
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              className="w-full rounded-lg border bg-background px-10 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {members.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No one in your circle yet</EmptyTitle>
              <EmptyDescription>
                Invite someone by entering their username above. Once they
                accept, you'll be able to see each other's theological
                wrestlings.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <Card
                key={member.id}
                className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setLocation(`/circle/${member.id}`)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {(
                          member.name?.charAt(0) ||
                          member.username?.charAt(0) ||
                          "?"
                        ).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.name || member.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{member.username}
                        {!member.sharesWithYou && (
                          <span className="ml-2 text-muted-foreground/60">
                            · doesn't share with you
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove {member.name || member.username}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove them from your circle and you from
                              theirs. You'll no longer be able to see each
                              other's content.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMember.mutate({ memberId: member.id });
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {friendSearch && filteredMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No friends matching "{friendSearch}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRequestCard({
  request,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: {
  request: {
    id: number;
    fromUsername: string | null;
    fromName: string | null;
    createdAt: Date;
  };
  onAccept: (shareBack: boolean) => void;
  onDecline: () => void;
  isAccepting: boolean;
  isDeclining: boolean;
}) {
  const [shareBack, setShareBack] = useState(true);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-primary">
                {(
                  request.fromName?.charAt(0) ||
                  request.fromUsername?.charAt(0) ||
                  "?"
                ).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {request.fromName || request.fromUsername} wants to add you to
                their circle
              </p>
              <p className="text-xs text-muted-foreground">
                @{request.fromUsername} ·{" "}
                {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="checkbox"
              aria-checked={shareBack}
              onClick={() => setShareBack(!shareBack)}
              className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                shareBack
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-muted-foreground"
              }`}
            >
              {shareBack && <Check className="h-3 w-3" />}
            </button>
            <span className="text-sm text-foreground">
              Share my wrestlings with them too
            </span>
          </label>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onAccept(shareBack)}
              disabled={isAccepting}
              className="gap-1.5"
            >
              {isAccepting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDecline}
              disabled={isDeclining}
              className="gap-1.5"
            >
              {isDeclining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Decline
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
