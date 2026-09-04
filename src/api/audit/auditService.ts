import type { AxiosResponse } from "axios";
import { DELETE, GET, POST } from "@/lib/api";
import { config } from "@/lib/config";
import { toQueryString } from "@/api/analytics/utils";
import type {
  AuditEventsParams,
  AuditEventsResponse,
  AuditHeadResponse,
  AuditExportTokensResponse,
  AuditExportTokenCreateResponse,
} from "@/types";

const base = (instanceId: string) =>
  config.apiPath + `/instances/${instanceId}`;

export const getAuditHeadAPICall = async (
  instanceId: string
): Promise<AxiosResponse<AuditHeadResponse>> => {
  return GET(`${base(instanceId)}/audit_events/head`);
};

export const getAuditEventsAPICall = async (
  instanceId: string,
  params: AuditEventsParams = {}
): Promise<AxiosResponse<AuditEventsResponse>> => {
  return GET(`${base(instanceId)}/audit_events${toQueryString(params)}`);
};

export const listAuditExportTokensAPICall = async (
  instanceId: string
): Promise<AxiosResponse<AuditExportTokensResponse>> => {
  return GET(`${base(instanceId)}/audit_export_tokens`);
};

export const createAuditExportTokenAPICall = async (
  instanceId: string,
  payload: { name: string }
): Promise<AxiosResponse<AuditExportTokenCreateResponse>> => {
  return POST(`${base(instanceId)}/audit_export_tokens`, payload);
};

export const revokeAuditExportTokenAPICall = async (
  instanceId: string,
  tokenId: string
): Promise<AxiosResponse<{ message: string }>> => {
  return DELETE(`${base(instanceId)}/audit_export_tokens/${tokenId}`);
};
