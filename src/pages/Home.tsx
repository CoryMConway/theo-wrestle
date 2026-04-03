import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { trpc } from "../lib/trpc";
import { BookOpen, Clock, PenLine, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = trpc.useUtils();
  const createEntry = trpc.journal.create.useMutation({
    onSuccess: () => {
      utils.journal.list.invalidate();
      utils.progression.stats.invalidate();
    },
  });

  const statsQuery = trpc.progression.stats.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please write something before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEntry.mutateAsync({
        content: content.trim(),
        title: title.trim() || undefined,
      });
      toast.success("Entry saved. AI is summarizing your reflection...");
      setTitle("");
      setContent("");
      setLocation(`/entry/${result.id}`);
    } catch (error) {
      toast.error("Failed to save entry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = statsQuery.data;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">
          What are you wrestling with?
        </h1>
        <p className="text-muted-foreground">
          Pour out your theological thoughts, questions, doubts, and discoveries. This is your safe space for honest spiritual reflection.
        </p>
      </div>

      {/* Brain Dump Form */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Give this reflection a title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg font-serif font-medium placeholder:text-muted-foreground/50 focus:outline-none border-none text-foreground"
            />
          </div>
          <div className="border-t border-border/40 pt-4">
            <textarea
              placeholder="Start writing... What theological questions are on your mind? What passages are you wrestling with? What tensions are you feeling between what you've been taught and what you're discovering?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full bg-transparent resize-none placeholder:text-muted-foreground/40 focus:outline-none text-foreground leading-relaxed"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              {content.length > 0
                ? `${content.split(/\s+/).filter(Boolean).length} words`
                : "Your thoughts will be summarized by AI after saving"}
            </p>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Save Reflection
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {stats && stats.entryCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className="border-border/40 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setLocation("/timeline")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PenLine className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {stats.entryCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.entryCount === 1 ? "Reflection" : "Reflections"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-border/40 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setLocation("/timeline")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {stats.uniqueThemes.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Themes Explored
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-border/40 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setLocation("/progression")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {stats.hasProgressionSummary ? "Ready" : "Available"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.entryCount >= 2
                      ? "Progression Analysis"
                      : `${2 - stats.entryCount} more entry needed`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* First-time guidance */}
      {(!stats || stats.entryCount === 0) && (
        <Card className="border-dashed border-border/60 bg-muted/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="font-serif text-lg font-medium text-foreground">
                  Begin Your Theological Journey
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Write your first reflection above. As you continue to journal, TheoWrestle will build a timeline of your theological wrestling and use AI to help you see patterns and growth in your thinking over time.
                </p>
              </div>
              <div className="flex items-center gap-6 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <PenLine className="h-3.5 w-3.5" />
                  <span>Write reflections</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Build a timeline</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>See your growth</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
