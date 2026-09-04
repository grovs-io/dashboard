"use client";

import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
  showDashboardLink?: boolean;
}

export function ErrorState({
  title,
  description,
  onRetry,
  showDashboardLink = false,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-20">
      <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-destructive/10 mb-5">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-6">
        {description}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </Button>
        )}
        {showDashboardLink && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
