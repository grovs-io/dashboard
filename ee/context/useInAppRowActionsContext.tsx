"use client";
import { createContext, useContext } from "react";
import type { InAppCampaign, InAppStep } from "@ee/types/inApp";

export interface InAppRowActions {
  onOpen: (campaign: InAppCampaign) => void;
  onEdit: (campaign: InAppCampaign) => void;
  onDuplicate: (campaign: InAppCampaign) => void;
  onStep: (campaign: InAppCampaign, step: InAppStep) => void;
  onDelete: (campaign: InAppCampaign) => void;
}

// Actions come from context so the table's column defs stay stable across page re-renders.
const InAppRowActionsContext = createContext<InAppRowActions | null>(null);

export const InAppRowActionsProvider = InAppRowActionsContext.Provider;

export const useInAppRowActions = () => useContext(InAppRowActionsContext);
