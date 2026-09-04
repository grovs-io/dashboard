import type { AxiosResponse } from "axios";
import { GET } from "@/lib/api";
import { config } from "@/lib/config";
import { toQueryString } from "./utils";
import type {
  RetentionSummaryResponse,
  AnalyticsRetentionSummaryParams,
} from "@/types";

const base = (projectId: string) =>
  config.apiPath + `/projects/${projectId}/analytics`;

export const getRetentionSummaryAPICall = async (
  projectId: string,
  params: AnalyticsRetentionSummaryParams = {}
): Promise<AxiosResponse<RetentionSummaryResponse>> => {
  return GET(`${base(projectId)}/retention/summary${toQueryString(params)}`);
};
