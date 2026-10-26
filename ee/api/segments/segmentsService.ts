import type { AxiosResponse } from "axios";
import { GET, POST, PATCH, DELETE } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  Segment,
  SegmentBreakdown,
  SegmentCatalogue,
  SegmentCount,
  SegmentDefinition,
  SegmentEstimate,
  SegmentExport,
  SegmentInput,
  SegmentMembersPage,
  SegmentSizePoint,
} from "@ee/types/segments";

const base = (projectId: string) =>
  `${config.apiPath}/projects/${encodeURIComponent(projectId)}`;
const segmentPath = (projectId: string, id: string) =>
  `${base(projectId)}/segments/${encodeURIComponent(id)}`;
// Writes must not double-fire, and estimate/count/users/breakdown each take an evaluation permit.
const options = { maxRetries: 0 };

export const segmentsApi = {
  async list(
    projectId: string,
    archived: boolean,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ segments: Segment[]; truncated: boolean }>> {
    return GET(`${base(projectId)}/segments?archived=${archived}`, {
      ...options,
      signal,
    });
  },
  async get(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ segment: Segment }>> {
    return GET(segmentPath(projectId, id), options);
  },
  async create(
    projectId: string,
    input: SegmentInput
  ): Promise<AxiosResponse<{ segment: Segment }>> {
    return POST(`${base(projectId)}/segments`, input, options);
  },
  async update(
    projectId: string,
    id: string,
    input: SegmentInput
  ): Promise<AxiosResponse<{ segment: Segment }>> {
    return PATCH(segmentPath(projectId, id), input, options);
  },
  async archive(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ message: string }>> {
    return DELETE(segmentPath(projectId, id), options);
  },
  async restore(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ segment: Segment }>> {
    return PATCH(segmentPath(projectId, id), { archived: false }, options);
  },
  async fields(
    projectId: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<SegmentCatalogue>> {
    return GET(`${base(projectId)}/segments/fields`, { ...options, signal });
  },
  async estimate(
    projectId: string,
    target:
      | { definition: SegmentDefinition; segment_id?: string }
      | { segment_id: string },
    signal?: AbortSignal
  ): Promise<AxiosResponse<SegmentEstimate>> {
    return POST(`${base(projectId)}/segments/estimate`, target, {
      ...options,
      signal,
    });
  },
  async count(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<SegmentCount>> {
    return POST(`${segmentPath(projectId, id)}/count`, {}, options);
  },
  async users(
    projectId: string,
    id: string,
    params: { cursor?: string; limit?: number; q?: string; result_id?: string }
  ): Promise<AxiosResponse<SegmentMembersPage>> {
    return POST(`${segmentPath(projectId, id)}/users`, params, options);
  },
  async breakdown(
    projectId: string,
    id: string,
    params: { by: string; result_id?: string }
  ): Promise<AxiosResponse<SegmentBreakdown>> {
    return POST(`${segmentPath(projectId, id)}/breakdown`, params, options);
  },
  async sizeHistory(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ size_history: SegmentSizePoint[] }>> {
    return GET(`${segmentPath(projectId, id)}/size_history`, options);
  },
  async replaceIdentifierList(
    projectId: string,
    id: string,
    payload: FormData | { identifiers: string[] }
  ): Promise<AxiosResponse<{ segment: Segment; count: number }>> {
    return POST(
      `${segmentPath(projectId, id)}/identifier_list`,
      payload,
      options
    );
  },
  async identifierListPreview(
    projectId: string,
    id: string,
    q: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ identifiers: string[]; more: boolean }>> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return GET(`${segmentPath(projectId, id)}/identifier_list${query}`, {
      ...options,
      signal,
    });
  },
  async downloadIdentifierList(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<string>> {
    return GET(
      `${segmentPath(projectId, id)}/identifier_list/download`,
      options
    );
  },
  async requestExport(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ export: SegmentExport }>> {
    return POST(`${segmentPath(projectId, id)}/export`, {}, options);
  },
  async exports(
    projectId: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ exports: SegmentExport[] }>> {
    return GET(`${base(projectId)}/segment_exports`, { ...options, signal });
  },
  async exportStatus(
    projectId: string,
    exportId: string
  ): Promise<AxiosResponse<{ export: SegmentExport }>> {
    return GET(
      `${base(projectId)}/segment_exports/${encodeURIComponent(exportId)}`,
      options
    );
  },
};
