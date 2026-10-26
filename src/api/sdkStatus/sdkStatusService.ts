import type { AxiosResponse } from "axios";
import { GET } from "@/lib/api";
import { config } from "@/lib/config";
import type { SdkStatus } from "@/types";

export const getSdkStatusAPICall = (
  projectId: string
): Promise<AxiosResponse<SdkStatus>> =>
  GET(`${config.apiPath}/projects/${projectId}/sdk_status`, { maxRetries: 0 });
