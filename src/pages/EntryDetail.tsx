import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc-client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function EntryDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const entryId = parseInt(params.id || "0", 10);

  const entryQuery = trpc.journal.get.useQuery(
    { id: entryId },
    {
      enabled: entryId > 0,
      refetchInterval: (query) => {
        const data = query.state.data;
        // Poll while AI is processing
        if (data?.aiStatus === "pending" || data?.aiStatus === "processing") {
          return 3000;
        }
        return false;
      },
    }
  );

  const resummarize = trpc.journal.resummarize.useMutation({
    onSuccess: () => {
      entryQuery.refetch();
      toast.success("Re-summarizing your reflection...");
    },
    onError: () => {
      toast.error("Failed to re-summarize.");
    },
  });

  if (entryQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!entryQuery.data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Entry not found.</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => setLocation("/timeline")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Timeline
        </Button>
      </div>
    );
  }

  const entry = entryQuery.data;
  const date = new Date(entry.createdAtMs);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
        onClick={() => setLocation("/timeline")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Timeline
      </Button>

      {/* Entry header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">
          {entry.title || "Untitled Reflection"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dateStr} at {timeStr}
        </p>
      </div>

      {/* Tags */}
      {entry.aiTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.aiTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Summary Card */}
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-primary">AI Summary</h2>
            </div>
            <div className="flex items-center gap-2">
              {entry.aiStatus === "processing" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing...
                </div>
              )}
              {entry.aiStatus === "pending" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Queued...
                </div>
              )}
              {entry.aiStatus === "completed" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary/60" />
              )}
              {entry.aiStatus === "failed" && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => resummarize.mutate({ id: entry.id })}
                    disabled={resummarize.isPending}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entry.aiStatus === "completed" && entry.aiSummary ? (
            <p className="text-sm text-foreground/80 leading-relaxed">
              {entry.aiSummary}
            </p>
          ) : entry.aiStatus === "processing" || entry.aiStatus === "pending" ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              AI summarization failed. Click retry to try again.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Full Content */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Full Reflection
          </h2>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
