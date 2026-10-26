import { cn } from "@/lib/utils";
import type { BuiltinKey } from "./builtinDashboards";

type Kpi = [label: string, value: string, delta: string];
type Bar = [label: string, width: number, value: string];

const KPIS: Record<BuiltinKey, Kpi[]> = {
  "": [
    ["New users", "12,480", "8%"],
    ["Installs", "9,920", "4%"],
    ["App opens", "41,770", "2%"],
  ],
  acquisition: [
    ["New users", "12,480", "8%"],
    ["Installs", "9,920", "4%"],
    ["Link-driven", "4,560", "11%"],
  ],
  engagement: [
    ["App opens", "41,770", "2%"],
    ["Returning", "6,310", "4%"],
    ["Return rate", "38%", "1%"],
  ],
  revenue: [
    ["Revenue", "$18,240", "12%"],
    ["ARPU", "$1.46", "4%"],
    ["Units sold", "1,912", "9%"],
  ],
  links: [
    ["Link views", "86,310", "5%"],
    ["Installs", "4,560", "11%"],
    ["Opens", "9,870", "2%"],
  ],
};

const TOP_LINKS: Bar[] = [
  ["Summer sale", 100, "18,220"],
  ["Onboarding invite", 54, "9,804"],
  ["Black Friday", 40, "7,315"],
  ["Referral", 32, "5,902"],
  ["Newsletter #42", 17, "3,118"],
];

const CURRENT = [52, 56, 50, 47, 49, 42, 45, 38, 40, 33, 35, 28, 30, 22];
const PREVIOUS = [60, 62, 59, 58, 57, 55, 56, 53, 54, 52, 51, 50, 49, 47];

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <p className="text-xs font-semibold">{title}</p>
      <p className="mb-2 text-[10.5px] text-muted-foreground">{hint}</p>
    </>
  );
}

function Bars({ rows, color }: { rows: Bar[]; color: string }) {
  return (
    <div className="mb-4">
      {rows.map(([label, width, value], i) => (
        <div
          key={label}
          className={cn(
            "grid grid-cols-[1fr_70px_46px] items-center gap-2.5 py-2 text-[11.5px]",
            i > 0 && "border-t border-sidebar-border"
          )}
        >
          <span className="truncate font-medium">{label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${width}%`, background: color }}
            />
          </span>
          <span className="text-right tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Chart({ color }: { color: string }) {
  const W = 300;
  const H = 110;
  const step = W / (CURRENT.length - 1);
  const pts = (a: number[]) =>
    a.map((y, i) => `${(i * step).toFixed(1)},${((y / 66) * H).toFixed(1)}`);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mb-4 block h-[110px] w-full"
    >
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1="0"
          x2={W}
          y1={(i * H) / 2 + 0.5}
          y2={(i * H) / 2 + 0.5}
          className="stroke-border"
        />
      ))}
      <polygon
        points={`0,${H} ${pts(CURRENT).join(" ")} ${W},${H}`}
        fill={color}
        opacity={0.08}
      />
      <polyline
        points={pts(PREVIOUS).join(" ")}
        fill="none"
        className="stroke-muted-foreground"
        strokeWidth="1.2"
        strokeDasharray="3 3"
        opacity={0.55}
      />
      <polyline
        points={pts(CURRENT).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Channels() {
  const parts: [string, number, string][] = [
    ["Link-driven", 46, "var(--chart-users)"],
    ["Organic", 41, "var(--chart-4)"],
    ["Referred", 13, "var(--chart-2)"],
  ];
  const C = 2 * Math.PI * 30;
  let offset = 0;
  return (
    <div className="mb-4 flex items-center gap-4">
      <svg width="76" height="76" viewBox="0 0 80 80" className="-rotate-90">
        {parts.map(([label, share, color]) => {
          const el = (
            <circle
              key={label}
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke={color}
              strokeWidth="11"
              strokeDasharray={`${(share / 100) * C} ${C}`}
              strokeDashoffset={(-offset / 100) * C}
            />
          );
          offset += share;
          return el;
        })}
      </svg>
      <div className="flex flex-1 flex-col gap-1.5 text-[11.5px] text-muted-foreground">
        {parts.map(([label, share, color]) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: color }}
            />
            {label}
            <span className="ml-auto font-medium text-foreground">
              {share}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Body({ dashboard }: { dashboard: BuiltinKey }) {
  switch (dashboard) {
    case "acquisition":
      return (
        <>
          <Heading title="Acquisition channels" hint="Share of new users" />
          <Channels />
          <Heading title="Installs by country" hint="Top 3" />
          <Bars
            color="var(--chart-users)"
            rows={[
              ["United States", 100, "4,812"],
              ["Germany", 59, "2,830"],
              ["United Kingdom", 44, "2,140"],
            ]}
          />
        </>
      );
    case "engagement":
      return (
        <>
          <Heading title="Retention" hint="Users active on day N" />
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {[
              ["Day 1", "44%"],
              ["Day 7", "21%"],
              ["Day 30", "9%"],
            ].map(([d, v]) => (
              <div
                key={d}
                className="rounded-lg border border-sidebar-border px-2 py-2 text-[10.5px] text-muted-foreground"
              >
                {d}
                <span className="mt-0.5 block text-[15px] font-bold text-foreground">
                  {v}
                </span>
              </div>
            ))}
          </div>
          <Heading title="Top events" hint="By count" />
          <Bars
            color="var(--chart-2)"
            rows={[
              ["screen_view", 100, "182,400"],
              ["add_to_cart", 21, "38,120"],
              ["search", 16, "29,770"],
            ]}
          />
        </>
      );
    case "revenue":
      return (
        <>
          <Heading title="Revenue" hint="vs previous period" />
          <Chart color="var(--chart-4)" />
        </>
      );
    case "links":
      return (
        <>
          <Heading title="Top links" hint="By views" />
          <Bars color="var(--chart-users)" rows={TOP_LINKS} />
        </>
      );
    default:
      return (
        <>
          <Heading title="New users" hint="vs previous period" />
          <Chart color="var(--chart-users)" />
          <Heading title="Top links" hint="By views" />
          <Bars color="var(--chart-users)" rows={TOP_LINKS.slice(0, 3)} />
        </>
      );
  }
}

/** Static sample of the dashboard, shown whole inside the panel. */
export function DashboardSetupPreview({
  dashboard,
}: {
  dashboard: BuiltinKey;
}) {
  return (
    <div
      aria-hidden
      data-testid={`setup-preview-${dashboard || "overview"}`}
      className="flex h-full min-h-[340px] items-center bg-muted/40 px-7 py-8 dark:bg-muted/20"
    >
      <div className="w-full rounded-xl border border-sidebar-border bg-background px-4 pt-4">
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {KPIS[dashboard].map(([label, value, delta]) => (
            <div
              key={label}
              className="px-2 py-2 text-[10.5px] text-muted-foreground"
            >
              {label}
              <span className="mt-0.5 block whitespace-nowrap text-[15px] font-bold tracking-tight text-foreground tabular-nums">
                {value}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium text-valid-green dark:text-emerald-400">
                ↑ {delta}
              </span>
            </div>
          ))}
        </div>
        <Body dashboard={dashboard} />
      </div>
    </div>
  );
}
