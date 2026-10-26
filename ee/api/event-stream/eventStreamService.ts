import type { AxiosResponse } from "axios";
import { GET, POST, PATCH, DELETE } from "@/lib/api";
import { config } from "@/lib/config";
import type {
  DestinationInput,
  DestinationResponse,
  DestinationAction,
  EventDestination,
  FeedToken,
  EventExportInput,
} from "@ee/types/eventStream";

const base = (projectId: string) =>
  `${config.apiPath}/projects/${encodeURIComponent(projectId)}`;
const destinationPath = (projectId: string, id: string) =>
  `${base(projectId)}/event_destinations/${encodeURIComponent(id)}`;
// Retry policy is explicit, including DELETE. A failed response can follow a successful write.
const options = { maxRetries: 0 };
export const eventStreamApi = {
  async destinations(
    projectId: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ event_destinations: EventDestination[] }>> {
    return GET(`${base(projectId)}/event_destinations`, { ...options, signal });
  },
  async createDestination(
    projectId: string,
    input: DestinationInput
  ): Promise<AxiosResponse<DestinationResponse>> {
    return POST(`${base(projectId)}/event_destinations`, input, options);
  },
  async updateDestination(
    projectId: string,
    id: string,
    input: Omit<DestinationInput, "kind">
  ): Promise<AxiosResponse<DestinationResponse>> {
    return PATCH(destinationPath(projectId, id), input, options);
  },
  async removeDestination(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ message: string }>> {
    return DELETE(destinationPath(projectId, id), options);
  },
  async action(
    projectId: string,
    id: string,
    action: DestinationAction,
    to?: string
  ): Promise<
    AxiosResponse<{ message?: string; event_destination?: EventDestination }>
  > {
    return POST(
      `${destinationPath(projectId, id)}/${action}`,
      action === "rewind" ? { to } : {},
      options
    );
  },
  async tokens(
    projectId: string,
    signal?: AbortSignal
  ): Promise<AxiosResponse<{ event_stream_tokens: FeedToken[] }>> {
    return GET(`${base(projectId)}/event_stream_tokens`, {
      ...options,
      signal,
    });
  },
  async createToken(
    projectId: string,
    name: string
  ): Promise<AxiosResponse<{ event_stream_token: FeedToken; token: string }>> {
    return POST(`${base(projectId)}/event_stream_tokens`, { name }, options);
  },
  async revokeToken(
    projectId: string,
    id: string
  ): Promise<AxiosResponse<{ message: string }>> {
    return DELETE(
      `${base(projectId)}/event_stream_tokens/${encodeURIComponent(id)}`,
      options
    );
  },
  async export(
    projectId: string,
    input: EventExportInput
  ): Promise<AxiosResponse<{ message: string }>> {
    return POST(`${base(projectId)}/event_exports`, input, options);
  },
};
