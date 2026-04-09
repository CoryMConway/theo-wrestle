import { BookOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { useState } from "react";
import { toast } from "sonner";
import { isOfficialHostedInstance } from "@/lib/hosting";

type AuthMode = "login" | "register";
const OFFICIAL_NOTICE_TEXT =
  "This shared free instance has limited capacity. If you can, please host your own free fork on Hugging Face for your community. See the self-hosting instructions in the ";

const HOST_FIRST_TITLE = "Are you able to host your own free instance first?";
const HOST_FIRST_DESCRIPTION =
  "You're using the official free shared instance. If possible, please host your own free fork on Hugging Face so this project can reach more people. See the self-hosting instructions in the ";

const CANT_HOST_TITLE = "Confirm before creating account";
const CANT_HOST_DESCRIPTION =
  "Please confirm: I can't host my own free version on Hugging Face right now.";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState<
    "host-first" | "cant-host"
  >("host-first");
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("Signed in successfully");
      await utils.invalidate();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      toast.success("Account created! You're now signed in.");
      await utils.invalidate();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isLoading = loginMutation.isPending || registerMutation.isPending;
  const isOfficialHost = isOfficialHostedInstance(window.location.href);
  const submitRegistration = () => {
    registerMutation.mutate({ username, password, name });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "login") {
      loginMutation.mutate({ username, password });
    } else {
      if (isOfficialHost) {
        setConfirmationStep("host-first");
        setConfirmationOpen(true);
        return;
      }

      submitRegistration();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-2">
          <BookOpen className="h-12 w-12 text-primary mb-2" />
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-center text-foreground">
            TheoWrestle
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
            A reflective space for your theological wrestling.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <h2 className="text-xl font-semibold text-center text-foreground">
            {mode === "login" ? "Sign in" : "Create an account"}
          </h2>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {mode === "register" && (
            <>
              {isOfficialHost && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="bg-amber-500/10 text-amber-700 text-sm rounded-lg px-4 py-3"
                >
                  <span className="font-semibold">Notice:</span>{" "}
                  {OFFICIAL_NOTICE_TEXT}
                  <a className="text-blue-600 hover:text-blue-400" href='https://github.com/CoryMConway/theo-wrestle/blob/main/README.md' target='_blank' rel='noopener noreferrer'>
                    <u>README</u>
                  </a>
                  {'.'}
                </div>
              )}
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-foreground"
                >
                  Display name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="text-sm font-medium text-foreground"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 6 characters" : "Enter your password"}
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {isLoading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>

      <AlertDialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          setConfirmationOpen(open);
          if (!open) {
            setConfirmationStep("host-first");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmationStep === "host-first"
                ? HOST_FIRST_TITLE
                : CANT_HOST_TITLE}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationStep === "host-first"
                ? <>
                    {HOST_FIRST_DESCRIPTION }
                    <u>
                      <a className="text-blue-600 hover:text-blue-400" href='https://github.com/CoryMConway/theo-wrestle/blob/main/README.md' target='_blank' rel='noopener noreferrer'>README</a>
                    </u>
                    {'.'}
                  </>
                : CANT_HOST_DESCRIPTION}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirmationStep === "host-first" ? "I'll host my own" : "Go back"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                if (confirmationStep === "host-first") {
                  e.preventDefault();
                  setConfirmationStep("cant-host");
                  return;
                }

                submitRegistration();
              }}
            >
              {confirmationStep === "host-first"
                ? "I can't host right now"
                : "Continue to create account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
