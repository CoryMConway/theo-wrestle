import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { getAiSummaryMarkdown } from "@/lib/ai-summary";

type TabType = "wrestlings" | "progression";

export default function MemberView() {
  const params = useParams<{ memberId: string }>();
  const [, setLocation] = useLocation();
  const memberId = parseInt(params.memberId || "0", 10);

  const membersQuery = trpc.circle.members.useQuery();
  const timelineQuery = trpc.circle.memberTimeline.useQuery(
    { memberId },
    {
      enabled: memberId > 0,
      refetchInterval: 15000,
    }
  );
  const progressionQuery = trpc.circle.memberProgression.useQuery(
    { memberId },
    { enabled: memberId > 0 }
  );

  const member = membersQuery.data?.find((m) => m.id === memberId);
  const entries = timelineQuery.data ?? [];
  const progression = progressionQuery.data;

  const [activeTab, setActiveTab] = useState<TabType>("wrestlings");

  if (timelineQuery.isLoading || membersQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (timelineQuery.error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-muted-foreground">
          {timelineQuery.error.message || "You don't have access to this person's content."}
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => setLocation("/circles")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Circles
        </Button>
      </div>
    );
  }

  const memberName = member?.name || member?.username || "Member";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
        onClick={() => setLocation("/circles")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Circles
      </Button>

      {/* Member header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-medium text-primary">
            {memberName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-serif font-semibold tracking-tight text-foreground">
            {memberName}'s Journey
          </h1>
          {member?.username && (
            <p className="text-sm text-muted-foreground">@{member.username}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("wrestlings")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "wrestlings"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Wrestlings
            <span className="text-xs text-muted-foreground">
              ({entries.length})
            </span>
          </div>
          {activeTab === "wrestlings" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("progression")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "progression"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Progression
          </div>
          {activeTab === "progression" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "wrestlings" ? (
        <WrestlingsTab entries={entries} memberName={memberName} />
      ) : (
        <ProgressionTab progression={progression} memberName={memberName} />
      )}
    </div>
  );
}

function WrestlingsTab({
  entries,
  memberName,
}: {
  entries: Array<{
    id: number;
    title: string | null;
    content: string;
    aiSummary: string | null;
    aiTags: string[];
    aiStatus: string;
    createdAtMs: number;
  }>;
  memberName: string;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>No wrestlings yet</EmptyTitle>
          <EmptyDescription>
            {memberName} hasn't written any theological reflections yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Group entries by month
  const grouped = groupEntriesByMonth(entries);

  return (
    <div className="space-y-6">
      {grouped.map(({ key, label, entries: monthEntries }) => (
        <div key={key} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </h2>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <div className="space-y-3">
            {monthEntries.map((entry) => (
              <MemberEntryCard
                key={entry.id}
                entry={entry}
                isExpanded={expandedId === entry.id}
                onToggle={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberEntryCard({
  entry,
  isExpanded,
  onToggle,
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
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(entry.createdAtMs);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const summaryMarkdown = getAiSummaryMarkdown(entry.aiSummary);

  return (
    <Card
      className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={onToggle}
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
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground/50 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </div>
            </div>

            {/* Preview (collapsed) */}
            {!isExpanded && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {entry.aiStatus === "completed" && entry.aiSummary
                  ? entry.aiSummary
                  : entry.content.substring(0, 200) +
                    (entry.content.length > 200 ? "..." : "")}
              </p>
            )}

            {/* Expanded content */}
            {isExpanded && (
              <div className="space-y-4 pt-2">
                {/* AI Summary */}
                {entry.aiStatus === "completed" && entry.aiSummary && (
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        AI Summary
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed">
                      <Streamdown>{summaryMarkdown}</Streamdown>
                    </div>
                  </div>
                )}

                {/* Full content */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Full Reflection
                  </p>
                  <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {entry.content}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {entry.aiTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {entry.aiTags.slice(0, isExpanded ? undefined : 4).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
                {!isExpanded && entry.aiTags.length > 4 && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    +{entry.aiTags.length - 4}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressionTab({
  progression,
  memberName,
}: {
  progression: {
    summary: string;
    entriesAnalyzed: number;
    keyThemes: string[];
    createdAtMs: number;
  } | null | undefined;
  memberName: string;
}) {
  if (!progression) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>No progression analysis yet</EmptyTitle>
          <EmptyDescription>
            {memberName} hasn't generated a progression analysis yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const date = new Date(progression.createdAtMs);
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{progression.entriesAnalyzed} entries analyzed</span>
        <span>·</span>
        <span>Generated {dateStr}</span>
      </div>

      {progression.keyThemes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {progression.keyThemes.map((theme) => (
            <Badge key={theme} variant="secondary" className="font-normal">
              {theme}
            </Badge>
          ))}
        </div>
      )}

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="pt-6">
          <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed">
            <Streamdown>{progression.summary}</Streamdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type EntryData = {
  id: number;
  title: string | null;
  content: string;
  aiSummary: string | null;
  aiTags: string[];
  aiStatus: string;
  createdAtMs: number;
};

function groupEntriesByMonth(entries: EntryData[]) {
  const groups: Map<string, EntryData[]> = new Map();

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
