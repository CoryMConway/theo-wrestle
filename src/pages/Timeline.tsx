import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  PenLine,
  Trash2,
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

export default function Timeline() {
  const [, setLocation] = useLocation();
  const entriesQuery = trpc.journal.list.useQuery(
    { order: "desc" },
    { refetchInterval: 5000 }
  );
  const utils = trpc.useUtils();

  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: () => {
      utils.journal.list.invalidate();
      utils.progression.stats.invalidate();
      toast.success("Entry deleted.");
    },
    onError: () => {
      toast.error("Failed to delete entry.");
    },
  });

  const entries = entriesQuery.data ?? [];

  if (entriesQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Empty className="min-h-[60vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Clock className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Your timeline is empty</EmptyTitle>
            <EmptyDescription>
              Start writing theological reflections to build your timeline. Each
              entry will be timestamped and summarized by AI.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setLocation("/")} className="gap-2">
            <PenLine className="h-4 w-4" />
            Write Your First Reflection
          </Button>
        </Empty>
      </div>
    );
  }

  // Group entries by month/year
  const grouped = groupEntriesByMonth(entries);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">
          Your Wrestling Timeline
        </h1>
        <p className="text-muted-foreground">
          {entries.length} {entries.length === 1 ? "reflection" : "reflections"}{" "}
          documenting your theological journey.
        </p>
      </div>

      {grouped.map(({ key, label, entries: monthEntries }) => (
        <div key={key} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </h2>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <div className="space-y-3">
            {monthEntries.map((entry) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                onView={() => setLocation(`/entry/${entry.id}`)}
                onDelete={() => deleteEntry.mutate({ id: entry.id })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineEntry({
  entry,
  onView,
  onDelete,
}: {
  entry: {
    id: number;
    title: string | null;
    content: string;
    aiSummary: string | null;
    aiTags: string[];
    aiStatus: string;
    createdAtMs: number;
  };
  onView: () => void;
  onDelete: () => void;
}) {
  const date = new Date(entry.createdAtMs);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Card
      className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={onView}
    >
      <CardContent className="pt-5 pb-5">
        <div className="flex gap-4">
          {/* Timeline dot */}
          <div className="flex flex-col items-center pt-1 shrink-0">
            <div className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            <div className="w-px flex-1 bg-border/40 mt-2" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-serif font-medium text-foreground truncate">
                  {entry.title || "Untitled Reflection"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dateStr} at {timeStr}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entry.aiStatus === "processing" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                {entry.aiStatus === "completed" && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary/60" />
                )}
                {entry.aiStatus === "failed" && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive/60" />
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </div>
            </div>

            {/* AI Summary or content preview */}
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {entry.aiStatus === "completed" && entry.aiSummary
                ? entry.aiSummary
                : entry.content.substring(0, 200) +
                  (entry.content.length > 200 ? "..." : "")}
            </p>

            {/* Tags */}
            {entry.aiTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {entry.aiTags.slice(0, 4).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
                {entry.aiTags.length > 4 && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    +{entry.aiTags.length - 4}
                  </Badge>
                )}
              </div>
            )}

            {/* Delete button */}
            <div className="flex justify-end pt-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this reflection?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this journal entry and its AI
                      summary. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type TimelineEntryData = {
  id: number;
  title: string | null;
  content: string;
  aiSummary: string | null;
  aiTags: string[];
  aiStatus: string;
  createdAtMs: number;
};

function groupEntriesByMonth(entries: TimelineEntryData[]) {
  const groups: Map<string, TimelineEntryData[]> = new Map();

  for (const entry of entries) {
    const date = new Date(entry.createdAtMs);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  return Array.from(groups.entries()).map(([key, groupEntries]) => {
    const date = new Date(groupEntries[0].createdAtMs);
    return {
      key,
      label: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      }),
      entries: groupEntries,
    };
  });
}
