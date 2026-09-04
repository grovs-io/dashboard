import type { AxiosResponse } from "axios";
import { GET } from "@/lib/api";
import { config } from "@/lib/config";
import { toQueryString } from "./utils";
import type {
  EventsListResponse,
  EventDetailResponse,
  EventVolumeResponse,
  EventFieldValuesResponse,
  EventFieldsResponse,
  AnalyticsEventsParams,
  AnalyticsEventVolumeParams,
  AnalyticsFieldValuesParams,
} from "@/types";

const base = (projectId: string) =>
  config.apiPath + `/projects/${projectId}/analytics`;

export const getAnalyticsEventsAPICall = async (
  projectId: string,
  params: AnalyticsEventsParams = {}
): Promise<AxiosResponse<EventsListResponse>> => {
  return GET(`${base(projectId)}/events${toQueryString(params)}`);
};

export const getAnalyticsEventByIdAPICall = async (
  projectId: string,
  eventId: string
): Promise<AxiosResponse<EventDetailResponse>> => {
  return GET(`${base(projectId)}/events/${eventId}`);
};

export const getAnalyticsEventVolumeAPICall = async (
  projectId: string,
  params: AnalyticsEventVolumeParams = {}
): Promise<AxiosResponse<EventVolumeResponse>> => {
  return GET(`${base(projectId)}/events/volume${toQueryString(params)}`);
};

export const getAnalyticsEventFieldValuesAPICall = async (
  projectId: string,
  params: AnalyticsFieldValuesParams
): Promise<AxiosResponse<EventFieldValuesResponse>> => {
  return GET(`${base(projectId)}/events/field-values${toQueryString(params)}`);
};

export const getAnalyticsEventFieldsAPICall = async (
  projectId: string
): Promise<AxiosResponse<EventFieldsResponse>> => {
  return GET(`${base(projectId)}/events/fields`);
};
