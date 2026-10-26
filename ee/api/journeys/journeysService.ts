import type { AxiosResponse } from "axios";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  Journey,
  JourneyAction,
  JourneyInput,
  JourneyReport,
  JourneyRow,
  JourneyStatus,
} from "@ee/types/journey";

const base = (projectId: string) =>
  `${config.apiPath}/projects/${encodeURIComponent(projectId)}/journeys`;
const journeyPath = (projectId: string, id: string) =>
  `${base(projectId)}/${encodeURIComponent(id)}`;
// Writes must not double-fire: a repeated launch or duplicate is a second action.
const options = { maxRetries: 0 };

type One = Promise<AxiosResponse<{ journey: Journey }>>;

export const journeysApi = {
  async list(
    projectId: string,
    params: { status?: JourneyStatus; after?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<
    AxiosResponse<{
      journeys: JourneyRow[];
      truncated: boolean;
      next_after: string | null;
    }>
  > {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.after) qs.set("after", params.after);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return GET(`${base(projectId)}${query ? `?${query}` : ""}`, {
      ...options,
      signal,
    });
  },
  async get(projectId: string, id: string, signal?: AbortSignal): One {
    return GET(journeyPath(projectId, id), { ...options, signal });
  },
  async create(projectId: string, input: Partial<JourneyInput>): One {
    return POST(base(projectId), input, options);
  },
  async update(
    projectId: string,
    id: string,
    input: Partial<JourneyInput>
  ): One {
    return PATCH(journeyPath(projectId, id), input, options);
  },
  async remove(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ message: string }>> {
    return DELETE(journeyPath(projectId, id), options);
  },
  async step(projectId: string, id: string, action: JourneyAction): One {
    return POST(`${journeyPath(projectId, id)}/${action}`, {}, options);
  },
  async duplicate(projectId: string, id: string): One {
    return POST(`${journeyPath(projectId, id)}/duplicate`, {}, options);
  },
  // A permanent URL for a push or in-app image of this journey.
  async uploadImage(
    projectId: string,
    id: string,
    file: File,
    lockVersion: number
  ): Promise<AxiosResponse<{ url: string; lock_version?: number }>> {
    const form = new FormData();
    form.append("image", file);
    // The server refuses a stale version with 409, like a save.
    form.append("lock_version", String(lockVersion));
    return POST(`${journeyPath(projectId, id)}/images`, form, options);
  },
  async report(
    projectId: string,
    id: string,
    params: { from: string; to: string },
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ report: JourneyReport }>> {
    const qs = new URLSearchParams(params).toString();
    return GET(`${journeyPath(projectId, id)}/report?${qs}`, {
      ...options,
      signal,
    });
  },
};
