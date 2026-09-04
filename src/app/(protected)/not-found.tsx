import { SearchX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex w-full min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-muted mb-5">
          <SearchX className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">
          Page not found
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
