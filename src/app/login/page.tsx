"use client";

import { LoginForm } from "@/components/loginForm/login-form";
import { ACCOUNT_LOGIN, SSO_LOGIN } from "@/constants/OptionsConstants";
import { useUserContext } from "@/context/useUserContext";

import LocalStorage from "@/lib/LocalStorage";
import SessionStorage from "@/lib/SessionStorage";
import { useEffect, useRef, useState } from "react";
import { showErrorNotification } from "@/lib/Notifications";
import { ApiError } from "@/lib/ApiError";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  loginWithOtpSchema,
  type LoginFormValues,
} from "@/schemas/auth";
import { ENTERPRISE_SSO, type SSOLogin } from "@/api/auth/userService";
import { useSSOProviders } from "@/hooks/useSSOProviders";
import { useSSODiscovery, type SsoDiscovery } from "@/hooks/useSSODiscovery";
import { getSsoRefusal } from "@/lib/ApiError";

const LOGIN_DEFAULT_VALUES: LoginFormValues = {
  email: "",
  password: "",
  otp: "",
};

export default function LoginPage() {
  const { loginUser, getSSOAuthenticationLink, userRef, isHydrated } =
    useUserContext();
  const [otpEnabled, setOtpEnabled] = useState<boolean>(false);
  const ssoProviders = useSSOProviders();
  const searchParams = useSearchParams();
  const router = useRouter();
  // A 403 refusal from the password grant pins the enterprise state for that email.
  const [refusal, setRefusal] = useState<
    (SsoDiscovery & { email: string }) | null
  >(null);

  const backToRef = useRef<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(otpEnabled ? loginWithOtpSchema : loginSchema),
    mode: "onChange",
    defaultValues: {
      ...LOGIN_DEFAULT_VALUES,
      email: searchParams.get("email") ?? "",
    },
  });
  const email = form.watch("email");
  const discovery = useSSODiscovery(email);
  const enterprise = refusal?.email === email ? refusal : discovery;

  const handleLogin = async (data: LoginFormValues): Promise<void> => {
    LocalStorage.setLoginType(ACCOUNT_LOGIN);
    try {
      const response = await loginUser(
        data.email,
        data.password,
        data.otp ?? ""
      );
      if (response.data.requires_otp) {
        setOtpEnabled(true);
        return;
      }
      const backTo = backToRef.current;
      router.push(backTo && backTo.startsWith("/") ? backTo : "/");
    } catch (error) {
      if (otpEnabled) {
        form.setValue("otp", "");
      }

      // signInAPICall uses plain axios (it targets the relative BFF route), so
      // it throws an AxiosError rather than an ApiError. Pull the error body
      // out of whichever shape we got so login failures actually surface.
      const errorData = (
        axios.isAxiosError(error)
          ? error.response?.data
          : error instanceof ApiError
            ? error.data
            : undefined
      ) as Record<string, unknown> | undefined;

      const ssoRefusal = getSsoRefusal(error);
      if (ssoRefusal) {
        setRefusal({
          email: data.email,
          connectionId: ssoRefusal.sso_connection_id,
          enforce: true,
        });
        showErrorNotification(ssoRefusal.error);
      } else if (errorData?.error === "invalid_grant") {
        showErrorNotification(
          otpEnabled
            ? "Invalid OTP code. Please try again."
            : "Provided credentials are invalid"
        );
      } else if (axios.isAxiosError(error)) {
        showErrorNotification(
          (errorData?.error_description as string) ??
            (errorData?.error as string) ??
            "Login failed. Please try again."
        );
      } else if (error instanceof ApiError) {
        showErrorNotification(error.message);
      }
    }
  };

  const loginWithSSO = async (sso: SSOLogin): Promise<void> => {
    LocalStorage.setLoginType(SSO_LOGIN);
    SessionStorage.setSsoEmail(form.getValues("email"));

    try {
      const response =
        sso === ENTERPRISE_SSO
          ? await getSSOAuthenticationLink(sso, {
              connection_id: enterprise.connectionId,
              email: form.getValues("email"),
            })
          : await getSSOAuthenticationLink(sso);
      const redirectURL: string = response.data.redirect_url;

      // Full-page redirect to the provider. The backend completes the flow by
      // redirecting back to the app root with tokens in the URL, which the root
      // page captures. This works reliably on both desktop and mobile, unlike a
      // popup (mobile browsers block popups opened after an async call).
      window.location.href = redirectURL;
    } catch {
      showErrorNotification("Could not start SSO sign-in. Please try again.");
    }
  };

  useEffect(() => {
    backToRef.current = searchParams.get("backTo");
  }, [searchParams]);

  // SSO failures come back as a ?error= redirect; show it, then strip it.
  useEffect(() => {
    const ssoError = searchParams.get("error");
    if (ssoError) {
      const remembered = SessionStorage.takeSsoEmail();
      if (remembered)
        form.setValue("email", remembered, { shouldValidate: true });
      showErrorNotification(ssoError);
      router.replace("/login");
    }
  }, [searchParams, router, form]);

  useEffect(() => {
    if (!isHydrated) return;

    // Mount-only: userRef and backToRef are refs whose .current is read but shouldn't trigger re-runs
    if (userRef.current && !backToRef.current) {
      router.replace("/dashboard");
    }
  }, [isHydrated, router, userRef]);

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 w-full">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm
          form={form}
          otpEnabled={otpEnabled}
          handleLogin={form.handleSubmit(handleLogin)}
          loginWithSSO={loginWithSSO}
          ssoProviders={ssoProviders}
          enterpriseConnectionId={enterprise.connectionId}
          enterpriseEnforced={enterprise.enforce}
        />
      </div>
    </div>
  );
}
