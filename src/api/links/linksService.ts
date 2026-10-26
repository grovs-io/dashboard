import type { AxiosResponse } from "axios";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  Link,
  GetLinksParams,
  LinksByIdsPayload,
  LinksLookupParams,
} from "@/types";

// --- Response types ---

interface PaginationMeta {
  total_pages: number;
  total_entries: number;
}

interface GetProjectLinksResponse {
  links: Link[];
  meta: PaginationMeta;
}

interface CreateLinkResponse {
  link: Link;
}

interface UpdateLinkResponse {
  link: Link;
}

interface GetLinksByIdResponse {
  links: Link[];
}

interface LinksLookupResponse {
  links: Link[];
}

export interface LinkLastOpen {
  opened_at: string;
  platform: string | null;
  model: string | null;
  app_version: string | null;
}

interface LinkLastOpenResponse {
  open: LinkLastOpen | null;
}

interface AvailablePathResponse {
  available: boolean;
}

interface RandomPathResponse {
  valid_path: string;
}

// --- API calls ---

export const createNewLinkAPICall = async (
  instanceId: string,
  formData: FormData
): Promise<AxiosResponse<CreateLinkResponse>> => {
  return POST(config.apiPath + `/projects/${instanceId}/links`, formData);
};

export const getProjectLinksAPICall = async (
  instanceId: string,
  data: GetLinksParams
): Promise<AxiosResponse<GetProjectLinksResponse>> => {
  return POST(config.apiPath + `/projects/${instanceId}/links/search_v2`, data);
};

export const getLinksByIdAPICall = async (
  instanceId: string,
  data: LinksByIdsPayload
): Promise<AxiosResponse<GetLinksByIdResponse>> => {
  return POST(config.apiPath + `/projects/${instanceId}/links/by_ids`, data);
};

export const lookupLinksAPICall = async (
  instanceId: string,
  params: LinksLookupParams = {},
  signal?: AbortSignal
): Promise<AxiosResponse<LinksLookupResponse>> => {
  const qs = new URLSearchParams();
  if (params.term) qs.set("term", params.term);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return GET(
    config.apiPath +
      `/projects/${instanceId}/links/lookup${query ? `?${query}` : ""}`,
    { signal }
  );
};

export const updateLinkAPICall = async (
  instanceId: string,
  linkId: string,
  formData: FormData
): Promise<AxiosResponse<UpdateLinkResponse>> => {
  return PATCH(
    config.apiPath + `/projects/${instanceId}/links/${linkId}`,
    formData
  );
};

export const removeLinkAPICall = async (
  instanceId: string,
  linkId: string
): Promise<AxiosResponse<void>> => {
  return DELETE(config.apiPath + `/projects/${instanceId}/links/${linkId}`);
};

export const availablePathAPICall = async (
  instanceId: string,
  path: string
): Promise<AxiosResponse<AvailablePathResponse>> => {
  const data = {
    path: path,
  };
  return POST(
    config.apiPath + `/projects/${instanceId}/links/check_path`,
    data
  );
};

export const getRandomPathAPICall = async (
  instanceId: string
): Promise<AxiosResponse<RandomPathResponse>> => {
  return GET(config.apiPath + `/projects/${instanceId}/links/random_path`);
};

export const getLinkLastOpenAPICall = async (
  projectId: string,
  linkId: string
): Promise<AxiosResponse<LinkLastOpenResponse>> => {
  return GET(
    config.apiPath + `/projects/${projectId}/links/${linkId}/last_open`,
    { maxRetries: 0 }
  );
};
