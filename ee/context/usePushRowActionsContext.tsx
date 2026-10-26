"use client";
import { createContext, useContext } from "react";
import type { PushCampaign } from "@ee/types/push";

export interface PushRowActions {
  onOpen: (campaign: PushCampaign) => void;
  onEdit: (campaign: PushCampaign) => void;
  onDuplicate: (campaign: PushCampaign) => void;
  onCancel: (campaign: PushCampaign) => void;
}

// Actions come from context so the push table's column defs stay stable across page re-renders.
const PushRowActionsContext = createContext<PushRowActions | null>(null);

export const PushRowActionsProvider = PushRowActionsContext.Provider;

export const usePushRowActions = () => useContext(PushRowActionsContext);
