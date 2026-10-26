import type { AxiosResponse } from "axios";
import { GET } from "@/lib/api";
import { config } from "@/lib/config";
import { toQueryString } from "./utils";
import type { MetricQueryParams, MetricQueryResponse } from "@/types";

export const getMetricQueryAPICall = async (
  projectId: string,
  params: MetricQueryParams
): Promise<AxiosResponse<MetricQueryResponse>> => {
  return GET(
    `${config.apiPath}/projects/${projectId}/analytics/query${toQueryString(params)}`
  );
};
