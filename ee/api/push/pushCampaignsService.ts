import type { AxiosResponse } from "axios";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  PushAudienceInput,
  PushCampaign,
  PushCampaignInput,
  PushDelivery,
  PushDeliveriesParams,
  PushEstimate,
  PushScheduleInput,
  PushStatus,
} from "@ee/types/push";
import type { Experiment, VariantId } from "@ee/types/experiment";

const base = (projectId: string) =>
  `${config.apiPath}/projects/${encodeURIComponent(projectId)}`;
const campaignPath = (projectId: string, id: string) =>
  `${base(projectId)}/push_campaigns/${encodeURIComponent(id)}`;
// Writes must not double-fire, and estimate takes an evaluation permit.
const options = { maxRetries: 0 };

export const pushApi = {
  async list(
    projectId: string,
    params: { status?: PushStatus; after?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<
    AxiosResponse<{
      push_campaigns: PushCampaign[];
      truncated: boolean;
      next_after?: string | null;
    }>
  > {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.after) qs.set("after", params.after);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return GET(`${base(projectId)}/push_campaigns${query ? `?${query}` : ""}`, {
      ...options,
      signal,
    });
  },
  async get(
    projectId: string,
    id: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return GET(campaignPath(projectId, id), { ...options, signal });
  },
  async create(
    projectId: string,
    input: PushCampaignInput | FormData
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return POST(`${base(projectId)}/push_campaigns`, input, options);
  },
  async update(
    projectId: string,
    id: string,
    input: PushCampaignInput | FormData
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return PATCH(campaignPath(projectId, id), input, options);
  },
  async removeImage(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return DELETE(`${campaignPath(projectId, id)}/image`, options);
  },
  async send(
    projectId: string,
    id: string,
    schedule: PushScheduleInput
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return POST(`${campaignPath(projectId, id)}/send`, schedule, options);
  },
  async cancel(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return POST(`${campaignPath(projectId, id)}/cancel`, {}, options);
  },
  // Sends that variant to everyone kept waiting by the test share; once.
  async sendWinner(
    projectId: string,
    id: string,
    variant: "a" | VariantId
  ): Promise<AxiosResponse<{ push_campaign: PushCampaign }>> {
    return POST(
      `${campaignPath(projectId, id)}/send_winner`,
      { variant },
      options
    );
  },
  // Without a range the server counts from the day the campaign started.
  async getExperiment(
    projectId: string,
    id: string,
    from?: string,
    to?: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ experiment: Experiment }>> {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const query = qs.toString();
    return GET(
      `${campaignPath(projectId, id)}/experiment${query ? `?${query}` : ""}`,
      { ...options, signal }
    );
  },
  async estimateAudience(
    projectId: string,
    audience: PushAudienceInput,
    signal?: AbortSignal
  ): Promise<AxiosResponse<PushEstimate>> {
    return POST(
      `${base(projectId)}/push_campaigns/estimate`,
      { audience },
      { ...options, signal }
    );
  },
  async deliveries(
    projectId: string,
    id: string,
    params: PushDeliveriesParams = {},
    signal?: AbortSignal
  ): Promise<
    AxiosResponse<{ deliveries: PushDelivery[]; next_after: number | null }>
  > {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.after !== undefined) qs.set("after", String(params.after));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return GET(
      `${campaignPath(projectId, id)}/deliveries${query ? `?${query}` : ""}`,
      { ...options, signal }
    );
  },
};
