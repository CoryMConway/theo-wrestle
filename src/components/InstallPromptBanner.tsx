import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallPromptBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallPromptBanner({
  onInstall,
  onDismiss,
}: InstallPromptBannerProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
        <Download className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-card-foreground">
            Add to Home Screen
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Install TheoWrestle for quick access
          </p>
        </div>
        <Button size="sm" onClick={onInstall}>
          Install
        </Button>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
