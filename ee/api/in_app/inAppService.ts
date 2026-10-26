import type { AxiosResponse } from "axios";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  InAppAnswersExport,
  InAppCampaign,
  InAppCampaignInput,
  InAppCommentsPage,
  InAppExperiment,
  InAppImageSlot,
  InAppMedia,
  InAppReport,
  InAppSettings,
  InAppStatus,
  InAppStep,
  InAppVariantId,
} from "@ee/types/inApp";

const base = (projectId: string) =>
  `${config.apiPath}/projects/${encodeURIComponent(projectId)}`;
const campaignPath = (projectId: string, id: string) =>
  `${base(projectId)}/in_app_campaigns/${encodeURIComponent(id)}`;
// Writes must not double-fire: a repeated launch or duplicate is a second action.
const options = { maxRetries: 0 };

type One = Promise<AxiosResponse<{ in_app_campaign: InAppCampaign }>>;

export const inAppApi = {
  async list(
    projectId: string,
    params: { status?: InAppStatus; after?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<
    AxiosResponse<{
      in_app_campaigns: InAppCampaign[];
      truncated: boolean;
      next_after: string | null;
    }>
  > {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.after) qs.set("after", params.after);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return GET(
      `${base(projectId)}/in_app_campaigns${query ? `?${query}` : ""}`,
      { ...options, signal }
    );
  },
  async get(projectId: string, id: string, signal?: AbortSignal): One {
    return GET(campaignPath(projectId, id), { ...options, signal });
  },
  async create(projectId: string, input: InAppCampaignInput): One {
    return POST(`${base(projectId)}/in_app_campaigns`, input, options);
  },
  async update(projectId: string, id: string, input: InAppCampaignInput): One {
    return PATCH(campaignPath(projectId, id), input, options);
  },
  async remove(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ message: string }>> {
    return DELETE(campaignPath(projectId, id), options);
  },
  async step(projectId: string, id: string, step: InAppStep): One {
    return POST(`${campaignPath(projectId, id)}/${step}`, {}, options);
  },
  async test(
    projectId: string,
    id: string,
    identifier: string
  ): Promise<AxiosResponse<{ devices: number }>> {
    return POST(`${campaignPath(projectId, id)}/test`, { identifier }, options);
  },
  async updateAudience(projectId: string, id: string): One {
    return POST(`${campaignPath(projectId, id)}/update_audience`, {}, options);
  },
  // With a variant, the copy holds that variant's content and no experiment.
  async duplicate(
    projectId: string,
    id: string,
    variant?: "a" | InAppVariantId
  ): One {
    return POST(
      `${campaignPath(projectId, id)}/duplicate`,
      variant ? { variant } : {},
      options
    );
  },
  async uploadImage(
    projectId: string,
    id: string,
    slot: InAppImageSlot,
    file: File
  ): One {
    const form = new FormData();
    form.append("image", file);
    return POST(`${campaignPath(projectId, id)}/images/${slot}`, form, options);
  },
  async removeImage(projectId: string, id: string, slot: InAppImageSlot): One {
    return DELETE(`${campaignPath(projectId, id)}/images/${slot}`, options);
  },
  async media(
    projectId: string,
    id: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ media: InAppMedia[] }>> {
    return GET(`${campaignPath(projectId, id)}/media`, { ...options, signal });
  },
  // A stale lock_version is refused like a stale save of the campaign.
  async uploadMedia(
    projectId: string,
    id: string,
    file: File,
    lockVersion: number
  ): Promise<AxiosResponse<{ media: InAppMedia; lock_version: number }>> {
    const form = new FormData();
    form.append("file", file);
    form.append("lock_version", String(lockVersion));
    return POST(`${campaignPath(projectId, id)}/media`, form, options);
  },
  // A file the saved HTML still uses is refused with 409 "in_use".
  async removeMedia(
    projectId: string,
    id: string,
    mediaId: string,
    lockVersion: number
  ): Promise<AxiosResponse<{ message: string; lock_version: number }>> {
    return DELETE(
      `${campaignPath(projectId, id)}/media/${encodeURIComponent(mediaId)}?lock_version=${lockVersion}`,
      options
    );
  },
  async report(
    projectId: string,
    id: string,
    params: { from: string; to: string; by: "day" | "hour" },
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ report: InAppReport }>> {
    const qs = new URLSearchParams(params).toString();
    return GET(`${campaignPath(projectId, id)}/report?${qs}`, {
      ...options,
      signal,
    });
  },
  async getExperiment(
    projectId: string,
    id: string,
    from: string,
    to: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ experiment: InAppExperiment }>> {
    const qs = new URLSearchParams({ from, to }).toString();
    return GET(`${campaignPath(projectId, id)}/experiment?${qs}`, {
      ...options,
      signal,
    });
  },
  async answers(
    projectId: string,
    id: string,
    params: { from: string; to: string }
  ): Promise<AxiosResponse<{ answers: InAppAnswersExport }>> {
    const qs = new URLSearchParams(params).toString();
    return GET(`${campaignPath(projectId, id)}/answers?${qs}`, options);
  },
  async comments(
    projectId: string,
    id: string,
    params: { from: string; to: string; values?: string; before?: string },
    signal?: AbortSignal
  ): Promise<AxiosResponse<InAppCommentsPage>> {
    const qs = new URLSearchParams(
      Object.entries(params).filter(
        (pair): pair is [string, string] => !!pair[1]
      )
    ).toString();
    return GET(`${campaignPath(projectId, id)}/comments?${qs}`, {
      ...options,
      signal,
    });
  },
  async settings(
    projectId: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ in_app_settings: InAppSettings }>> {
    return GET(`${base(projectId)}/in_app_settings`, { ...options, signal });
  },
  async updateSettings(
    projectId: string,
    input: Partial<InAppSettings>
  ): Promise<AxiosResponse<{ in_app_settings: InAppSettings }>> {
    return PATCH(`${base(projectId)}/in_app_settings`, input, options);
  },
};
