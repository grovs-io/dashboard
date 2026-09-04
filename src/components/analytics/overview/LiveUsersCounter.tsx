"use client";

import "react";

type LiveUsersCounterProps = {
  count: number;
};

export function LiveUsersCounter({ count }: LiveUsersCounterProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      <span className="font-medium tabular-nums">{count}</span>
      <span>users active</span>
    </div>
  );
}
