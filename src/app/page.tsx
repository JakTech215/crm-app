import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FolderKanban } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/40 px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <FolderKanban className="h-6 w-6" />
        </div>
        <h1 className="text-4xl font-bold">CRM</h1>
      </div>
      <p className="max-w-md text-center text-muted-foreground">
        Manage your contacts, projects, tasks, and team — all in one place.
      </p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/auth/register">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
