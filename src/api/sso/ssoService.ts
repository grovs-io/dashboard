import type { AxiosResponse } from "axios";
import { DELETE, GET, POST, PUT } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  SsoConnectionResponse,
  SsoConnectionUpsertPayload,
  SsoDiscoverResponse,
} from "@/types";

const base = (instanceId: string) =>
  config.apiPath + `/instances/${instanceId}/sso_connection`;

export const getSsoConnectionAPICall = async (
  instanceId: string
): Promise<AxiosResponse<SsoConnectionResponse>> => GET(base(instanceId));

export const upsertSsoConnectionAPICall = async (
  instanceId: string,
  payload: SsoConnectionUpsertPayload
): Promise<AxiosResponse<SsoConnectionResponse>> =>
  PUT(base(instanceId), payload);

export const deleteSsoConnectionAPICall = async (
  instanceId: string
): Promise<AxiosResponse<{ message: string }>> => DELETE(base(instanceId));

export const verifySsoDomainsAPICall = async (
  instanceId: string
): Promise<AxiosResponse<SsoConnectionResponse>> =>
  POST(`${base(instanceId)}/verify_domains`, null);

export const createScimTokenAPICall = async (
  instanceId: string
): Promise<AxiosResponse<{ token: string }>> =>
  POST(`${base(instanceId)}/scim_token`, null);

export const deleteScimTokenAPICall = async (
  instanceId: string
): Promise<AxiosResponse<{ message: string }>> =>
  DELETE(`${base(instanceId)}/scim_token`);

export const discoverSsoAPICall = async (
  email: string
): Promise<AxiosResponse<SsoDiscoverResponse>> =>
  POST(config.apiPath + "/identity/sso/discover", { email }, { retry: false });
