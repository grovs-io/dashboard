"use client";
import { useCallback, useRef, useState } from "react";
import { buildPushFormData } from "@ee/lib/push";
import { inputDiff } from "@ee/lib/pushComposer";
import {
  useCreatePushCampaign,
  useUpdatePushCampaign,
} from "@ee/hooks/mutations/usePushMutations";
import type { PushCampaign, PushCampaignInput } from "@ee/types/push";

export interface SaveResult {
  campaign: PushCampaign;
  audienceChanged: boolean;
}

// Saves are chained so an autosave and a manual save never race into two creates.
export function usePushDraft(
  projectId: string,
  initial: PushCampaign | null,
  baseline: PushCampaignInput
) {
  const create = useCreatePushCampaign(projectId);
  const update = useUpdatePushCampaign(projectId);
  const [campaign, setCampaign] = useState<PushCampaign | null>(initial);
  const [saving, setSaving] = useState(false);
  const campaignRef = useRef<PushCampaign | null>(initial);
  const savedRef = useRef<PushCampaignInput>(baseline);
  const [saved, setSaved] = useState<PushCampaignInput>(baseline);
  const uploadedRef = useRef<File | null>(null);
  const [uploaded, setUploaded] = useState<File | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const isDirty = useCallback(
    (input: PushCampaignInput, file: File | null) =>
      (!!file && file !== uploaded) ||
      Object.keys(inputDiff(saved, input)).length > 0,
    [saved, uploaded]
  );

  const run = async (
    input: PushCampaignInput,
    file: File | null
  ): Promise<SaveResult> => {
    const current = campaignRef.current;
    const pendingFile = file && file !== uploadedRef.current ? file : null;
    let next: PushCampaign;
    let audienceChanged: boolean;
    const commit = (saved: PushCampaign, text: PushCampaignInput) => {
      savedRef.current = text;
      campaignRef.current = saved;
      setSaved(text);
      setCampaign(saved);
    };
    if (!current) {
      // Multipart only when a file is staged: it cannot express an empty data object.
      next = await create.mutateAsync(
        pendingFile ? buildPushFormData(input, pendingFile) : input
      );
      audienceChanged = true;
      if (pendingFile) {
        uploadedRef.current = pendingFile;
        setUploaded(pendingFile);
      }
      commit(next, input);
    } else {
      const diff = inputDiff(savedRef.current, input);
      audienceChanged = "audience" in diff;
      next = current;
      if (Object.keys(diff).length > 0) {
        next = await update.mutateAsync({ id: current.id, input: diff });
        // Committed before the image upload, so a failed upload keeps the saved text.
        commit(next, input);
      }
      if (pendingFile) {
        next = await update.mutateAsync({
          id: current.id,
          input: buildPushFormData({}, pendingFile),
        });
        uploadedRef.current = pendingFile;
        setUploaded(pendingFile);
        commit(next, input);
      }
    }
    return { campaign: next, audienceChanged };
  };

  const save = (input: PushCampaignInput, file: File | null) => {
    const task = chain.current.then(async () => {
      setSaving(true);
      try {
        return await run(input, file);
      } finally {
        setSaving(false);
      }
    });
    chain.current = task.catch(() => {});
    return task;
  };

  const replaceCampaign = useCallback((next: PushCampaign) => {
    campaignRef.current = next;
    setCampaign(next);
  }, []);

  return { campaign, saving, save, isDirty, replaceCampaign };
}
