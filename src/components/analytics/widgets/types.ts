import type { MetricQueryResponse } from "@/types";

export type WidgetViz = "number" | "bar" | "line" | "table";

export type WidgetData = MetricQueryResponse;

export type RowClickHandler = (key: string, label: string) => void;
