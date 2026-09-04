import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import {
  useCreateInstanceMutation,
  useEditInstanceMutation,
  useDeleteInstanceMutation,
  useAddMemberMutation,
  useRemoveMemberMutation,
  useCompleteSetupStepMutation,
  useDismissGetStartedMutation,
  useExportUsageMutation,
  useSetRevenueCollectionMutation,
  useSetIosConfigMutation,
  useSetIosPushConfigMutation,
  useSetAndroidConfigMutation,
  useSetAndroidPushConfigMutation,
  useSetAndroidWebhookKeyMutation,
  useSetWebConfigMutation,
  useSetDesktopConfigMutation,
  useRemoveIosConfigMutation,
  useRemoveAndroidConfigMutation,
  useRemoveWebConfigMutation,
} from "../mutations/useInstanceMutations";

vi.mock("@/api/instances/instanceService", () => ({
  createInstanceAPICall: vi.fn(),
  editInstanceAPICall: vi.fn(),
  deleteInstanceAPICall: vi.fn(),
  addMemberToInstanceAPICall: vi.fn(),
  removedMemberFromInstanceAPICall: vi.fn(),
  dismissGetStartedAPICall: vi.fn(),
  exportUsageApiCall: vi.fn(),
  setRevenueCollectionEnabledApiCall: vi.fn(),
  completeSetupStepAPICall: vi.fn(),
}));

vi.mock("@/api/applications/configApplicationsService", () => ({
  setIOSAppConfigAPICall: vi.fn(),
  setIOSPushConfigAPICall: vi.fn(),
  setAndroidAppConfigAPICall: vi.fn(),
  setAndroidPushConfigAPICall: vi.fn(),
  setAndroidAppWebhookAccessKeyAPICall: vi.fn(),
  setWebAppConfigAPICall: vi.fn(),
  setDesktopAppConfigAPICall: vi.fn(),
  removeIOSConfigAPICall: vi.fn(),
  removeAndroidConfigAPICall: vi.fn(),
  removeWebConfigAPICall: vi.fn(),
}));

import {
  createInstanceAPICall,
  editInstanceAPICall,
  deleteInstanceAPICall,
  addMemberToInstanceAPICall,
  removedMemberFromInstanceAPICall,
  completeSetupStepAPICall,
  dismissGetStartedAPICall,
  exportUsageApiCall,
  setRevenueCollectionEnabledApiCall,
} from "@/api/instances/instanceService";
import {
  setIOSAppConfigAPICall,
  setIOSPushConfigAPICall,
  setAndroidAppConfigAPICall,
  setAndroidPushConfigAPICall,
  setAndroidAppWebhookAccessKeyAPICall,
  setWebAppConfigAPICall,
  setDesktopAppConfigAPICall,
  removeIOSConfigAPICall,
  removeAndroidConfigAPICall,
  removeWebConfigAPICall,
} from "@/api/applications/configApplicationsService";

const mockedCreateInstance = vi.mocked(createInstanceAPICall);
const mockedEditInstance = vi.mocked(editInstanceAPICall);
const mockedDeleteInstance = vi.mocked(deleteInstanceAPICall);
const mockedAddMember = vi.mocked(addMemberToInstanceAPICall);
const mockedRemoveMember = vi.mocked(removedMemberFromInstanceAPICall);
const mockedCompleteStep = vi.mocked(completeSetupStepAPICall);
const mockedDismissGetStarted = vi.mocked(dismissGetStartedAPICall);
const mockedExportUsage = vi.mocked(exportUsageApiCall);
const mockedSetRevenueCollection = vi.mocked(
  setRevenueCollectionEnabledApiCall
);

const CONFIG_KEY = ["instances", "inst-1", "config"];

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useInstanceMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  describe("useCreateInstanceMutation", () => {
    it("calls create API and invalidates instances", async () => {
      mockedCreateInstance.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateInstanceMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Project",
          members: [{ email: "test@test.com", role: "admin" }],
        });
      });

      expect(mockedCreateInstance).toHaveBeenCalledWith("New Project", [
        { email: "test@test.com", role: "admin" },
      ]);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["instances"],
      });
    });
  });

  describe("useEditInstanceMutation", () => {
    it("calls edit API and invalidates instances", async () => {
      mockedEditInstance.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useEditInstanceMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: "inst-1", name: "Renamed" });
      });

      expect(mockedEditInstance).toHaveBeenCalledWith("inst-1", "Renamed");
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["instances"],
      });
    });
  });

  describe("useDeleteInstanceMutation", () => {
    it("calls delete API and invalidates instances", async () => {
      mockedDeleteInstance.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDeleteInstanceMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("inst-1");
      });

      expect(mockedDeleteInstance).toHaveBeenCalledWith("inst-1");
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["instances"],
      });
    });
  });

  describe("useAddMemberMutation", () => {
    it("calls add member API and invalidates members", async () => {
      mockedAddMember.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAddMemberMutation("inst-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          email: "new@test.com",
          role: "member",
        });
      });

      expect(mockedAddMember).toHaveBeenCalledWith(
        "inst-1",
        "new@test.com",
        "member"
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["instances", "inst-1", "members"],
      });
    });

    it("does not invalidate when instanceId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAddMemberMutation(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current
          .mutateAsync({
            email: "new@test.com",
            role: "member",
          })
          .catch(() => {});
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useRemoveMemberMutation", () => {
    it("calls remove member API and invalidates members", async () => {
      mockedRemoveMember.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useRemoveMemberMutation("inst-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("old@test.com");
      });

      expect(mockedRemoveMember).toHaveBeenCalledWith("inst-1", "old@test.com");
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["instances", "inst-1", "members"],
      });
    });
  });

  describe("useCompleteSetupStepMutation", () => {
    it("calls complete step API and invalidates setup progress", async () => {
      mockedCompleteStep.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useCompleteSetupStepMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync({
          category: "ios",
          stepIdentifier: "bundle_id",
        });
      });

      expect(mockedCompleteStep).toHaveBeenCalledWith(
        "inst-1",
        "ios",
        "bundle_id"
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["instances", "inst-1", "setupProgress", "ios"],
      });
    });

    it("rejects and skips invalidation when instanceId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useCompleteSetupStepMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            category: "ios",
            stepIdentifier: "bundle_id",
          })
        ).rejects.toThrow("Instance ID is required");
      });

      expect(mockedCompleteStep).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useDismissGetStartedMutation", () => {
    it("forwards the optional payload and invalidates instances", async () => {
      mockedDismissGetStarted.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDismissGetStartedMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "inst-1",
          data: { dismissed: true } as never,
        });
      });

      expect(mockedDismissGetStarted).toHaveBeenCalledWith("inst-1", {
        dismissed: true,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["instances"] });
    });

    it("omits the payload when none is given", async () => {
      mockedDismissGetStarted.mockResolvedValueOnce({ data: {} } as never);

      const { result } = renderHook(() => useDismissGetStartedMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: "inst-1" });
      });

      expect(mockedDismissGetStarted).toHaveBeenCalledWith("inst-1", undefined);
    });
  });

  describe("useExportUsageMutation", () => {
    it("calls the export API without invalidating anything", async () => {
      mockedExportUsage.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useExportUsageMutation(), {
        wrapper: createWrapper(queryClient),
      });

      const data = {
        start_date: "2026-08-01 00:00:00",
        end_date: "2026-08-11 23:59:59",
      };

      await act(async () => {
        await result.current.mutateAsync({ id: "inst-1", data: data as never });
      });

      expect(mockedExportUsage).toHaveBeenCalledWith("inst-1", data);
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useSetRevenueCollectionMutation", () => {
    it("calls the revenue API and invalidates instances", async () => {
      mockedSetRevenueCollection.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetRevenueCollectionMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "inst-1",
          data: { revenue_collection_enabled: true } as never,
        });
      });

      expect(mockedSetRevenueCollection).toHaveBeenCalledWith("inst-1", {
        revenue_collection_enabled: true,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["instances"] });
    });
  });

  describe("useSetIosConfigMutation", () => {
    it("sends the payload and invalidates config", async () => {
      vi.mocked(setIOSAppConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const payload = new FormData();

      const { result } = renderHook(() => useSetIosConfigMutation("inst-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(setIOSAppConfigAPICall).toHaveBeenCalledWith("inst-1", payload);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetIosConfigMutation(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync(new FormData())
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setIOSAppConfigAPICall).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useSetIosPushConfigMutation", () => {
    it("sends the payload and invalidates config", async () => {
      vi.mocked(setIOSPushConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const payload = new FormData();

      const { result } = renderHook(
        () => useSetIosPushConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(setIOSPushConfigAPICall).toHaveBeenCalledWith("inst-1", payload);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useSetIosPushConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync(new FormData())
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setIOSPushConfigAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useSetAndroidConfigMutation", () => {
    it("sends the payload and invalidates config", async () => {
      vi.mocked(setAndroidAppConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const payload = new FormData();

      const { result } = renderHook(
        () => useSetAndroidConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(setAndroidAppConfigAPICall).toHaveBeenCalledWith(
        "inst-1",
        payload
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useSetAndroidConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync(new FormData())
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setAndroidAppConfigAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useSetAndroidPushConfigMutation", () => {
    it("sends the payload and invalidates config", async () => {
      vi.mocked(setAndroidPushConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const payload = new FormData();

      const { result } = renderHook(
        () => useSetAndroidPushConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(setAndroidPushConfigAPICall).toHaveBeenCalledWith(
        "inst-1",
        payload
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useSetAndroidPushConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync(new FormData())
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setAndroidPushConfigAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useSetAndroidWebhookKeyMutation", () => {
    it("sends the payload and invalidates config", async () => {
      vi.mocked(setAndroidAppWebhookAccessKeyAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const payload = new FormData();

      const { result } = renderHook(
        () => useSetAndroidWebhookKeyMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(setAndroidAppWebhookAccessKeyAPICall).toHaveBeenCalledWith(
        "inst-1",
        payload
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useSetAndroidWebhookKeyMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync(new FormData())
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setAndroidAppWebhookAccessKeyAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useSetDesktopConfigMutation", () => {
    it("sends the payload and invalidates config", async () => {
      vi.mocked(setDesktopAppConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const payload = new FormData();

      const { result } = renderHook(
        () => useSetDesktopConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(setDesktopAppConfigAPICall).toHaveBeenCalledWith(
        "inst-1",
        payload
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useSetDesktopConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync(new FormData())
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setDesktopAppConfigAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useSetWebConfigMutation", () => {
    it("spreads enabled and domains into the API call", async () => {
      vi.mocked(setWebAppConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetWebConfigMutation("inst-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          enabled: true,
          domains: ["acme.com"],
        });
      });

      expect(setWebAppConfigAPICall).toHaveBeenCalledWith("inst-1", true, [
        "acme.com",
      ]);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(() => useSetWebConfigMutation(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({ enabled: false, domains: [] })
        ).rejects.toThrow("Instance ID is required");
      });

      expect(setWebAppConfigAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useRemoveIosConfigMutation", () => {
    it("calls the API and invalidates config", async () => {
      vi.mocked(removeIOSConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useRemoveIosConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(removeIOSConfigAPICall).toHaveBeenCalledWith("inst-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useRemoveIosConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow(
          "Instance ID is required"
        );
      });

      expect(removeIOSConfigAPICall).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useRemoveAndroidConfigMutation", () => {
    it("calls the API and invalidates config", async () => {
      vi.mocked(removeAndroidConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useRemoveAndroidConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(removeAndroidConfigAPICall).toHaveBeenCalledWith("inst-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useRemoveAndroidConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow(
          "Instance ID is required"
        );
      });

      expect(removeAndroidConfigAPICall).not.toHaveBeenCalled();
    });
  });

  describe("useRemoveWebConfigMutation", () => {
    it("calls the API and invalidates config", async () => {
      vi.mocked(removeWebConfigAPICall).mockResolvedValueOnce({
        data: {},
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useRemoveWebConfigMutation("inst-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(removeWebConfigAPICall).toHaveBeenCalledWith("inst-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONFIG_KEY });
    });

    it("rejects when instanceId is undefined", async () => {
      const { result } = renderHook(
        () => useRemoveWebConfigMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow(
          "Instance ID is required"
        );
      });

      expect(removeWebConfigAPICall).not.toHaveBeenCalled();
    });
  });
});
