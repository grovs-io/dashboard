// Channel-neutral: shared by the push composer and (later) the in-app Messaging composer.
export type AudienceType = "segment" | "identifiers" | "visitors";

export interface AudienceValue {
  type: AudienceType;
  segmentId?: string;
  recipients: string[];
}
