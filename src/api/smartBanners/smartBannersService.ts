import { GET, POST, PATCH, DELETE } from "@/lib/api";
import type { AxiosResponse } from "axios";
import { config } from "@/lib/config";
import type { SmartBanner, SmartBannersStatus } from "@/types";

interface ListResponse {
  smart_banners: SmartBanner[];
}

interface ItemResponse {
  smart_banner: SmartBanner;
}

const base = (projectId: string) =>
  config.apiPath + `/projects/${projectId}/smart_banners`;

export const getSmartBannersAPICall = async (
  projectId: string
): Promise<AxiosResponse<ListResponse>> => GET(base(projectId));

export const getSmartBannerAPICall = async (
  projectId: string,
  bannerId: number
): Promise<AxiosResponse<ItemResponse>> =>
  GET(`${base(projectId)}/${bannerId}`);

export const createSmartBannerAPICall = async (
  projectId: string,
  fd: FormData
): Promise<AxiosResponse<ItemResponse>> => POST(base(projectId), fd);

export const updateSmartBannerAPICall = async (
  projectId: string,
  bannerId: number,
  fd: FormData
): Promise<AxiosResponse<ItemResponse>> =>
  PATCH(`${base(projectId)}/${bannerId}`, fd);

export const deleteSmartBannerAPICall = async (
  projectId: string,
  bannerId: number
): Promise<AxiosResponse<void>> => DELETE(`${base(projectId)}/${bannerId}`);

export const duplicateSmartBannerAPICall = async (
  projectId: string,
  bannerId: number
): Promise<AxiosResponse<ItemResponse>> =>
  POST(`${base(projectId)}/${bannerId}/duplicate`);

export const reorderSmartBannersAPICall = async (
  projectId: string,
  ids: number[]
): Promise<AxiosResponse<ListResponse>> =>
  PATCH(`${base(projectId)}/reorder`, { ids });

export const getSmartBannersStatusAPICall = async (
  projectId: string
): Promise<AxiosResponse<SmartBannersStatus>> =>
  GET(`${base(projectId)}/status`);
