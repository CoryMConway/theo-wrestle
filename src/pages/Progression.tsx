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
import { trpc } from "../lib/trpc";
import {
  BookOpen,
  Clock,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";

export default function Progression() {
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);

  const statsQuery = trpc.progression.stats.useQuery();
  const latestQuery = trpc.progression.latest.useQuery();
  const summariesQuery = trpc.progression.list.useQuery();
  const utils = trpc.useUtils();

  const generateMutation = trpc.progression.generate.useMutation({
    onSuccess: () => {
      utils.progression.latest.invalidate();
      utils.progression.list.invalidate();
      utils.progression.stats.invalidate();
      toast.success("Progression analysis generated!");
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate progression analysis.");
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const stats = statsQuery.data;
  const latest = latestQuery.data;
  const allSummaries = summariesQuery.data ?? [];

  if (statsQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  // Not enough entries
  if (!stats || stats.entryCount < 2) {
    return (
      <div className="max-w-3xl mx-auto">
        <Empty className="min-h-[60vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Not enough reflections yet</EmptyTitle>
            <EmptyDescription>
              You need at least 2 journal entries before TheoWrestle can analyze
              the progression of your theological thinking. You currently have{" "}
              {stats?.entryCount ?? 0}.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setLocation("/")} className="gap-2">
            <PenLine className="h-4 w-4" />
            Write a Reflection
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">
            Your Theological Progression
          </h1>
          <p className="text-muted-foreground">
            AI-powered analysis of how your thinking has evolved across{" "}
            {stats.entryCount} reflections.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="gap-2 shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : latest ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh Analysis
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Analysis
            </>
          )}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {stats.entryCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Reflections</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {stats.uniqueThemes.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Themes</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {stats.firstEntryDate
                ? formatDateShort(stats.firstEntryDate)
                : "-"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">First Entry</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {allSummaries.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Analyses</p>
          </CardContent>
        </Card>
      </div>

      {/* Theme cloud */}
      {stats.uniqueThemes.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">
                Themes You've Explored
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.uniqueThemes.map((theme) => (
                <Badge key={theme} variant="secondary" className="font-normal">
                  {theme}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest Progression Summary */}
      {latest ? (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium text-primary">
                  Latest Progression Analysis
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on {latest.entriesAnalyzed} entries &middot;{" "}
                {new Date(latest.createdAtMs).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground/90">
              <Streamdown>{latest.summary}</Streamdown>
            </div>

            {latest.keyThemes.length > 0 && (
              <div className="mt-6 pt-4 border-t border-primary/10">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Key Themes Identified
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {latest.keyThemes.map((theme) => (
                    <Badge
                      key={theme}
                      variant="outline"
                      className="font-normal text-xs border-primary/30 text-primary"
                    >
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="font-serif text-lg font-medium text-foreground">
                  Ready to Analyze Your Journey
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Click "Generate Analysis" above to have AI trace the arc of
                  your theological thinking, identify patterns, and highlight
                  your growth.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous summaries */}
      {allSummaries.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Previous Analyses
          </h2>
          {allSummaries.slice(1).map((summary) => (
            <Card key={summary.id} className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {new Date(summary.createdAtMs).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}{" "}
                      &middot; {summary.entriesAnalyzed} entries analyzed
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground/80">
                  <Streamdown>{summary.summary}</Streamdown>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateShort(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}
