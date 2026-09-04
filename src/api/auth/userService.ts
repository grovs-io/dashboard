import type { AxiosResponse } from "axios";
import axios from "axios";
import { DELETE, GET, PATCH, POST, PUT } from "@/lib/api";
import { config } from "@/lib/config";
import type { User, EditUserPayload } from "@/types";

// --- Response interfaces ---

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  requires_otp?: boolean;
}

export interface UserResponse {
  user: User;
}

export interface SSORedirectResponse {
  redirect_url: string;
}

export const SSO_PROVIDERS = ["google_oauth2", "microsoft_graph"] as const;
export type SSOProvider = (typeof SSO_PROVIDERS)[number];
// Enterprise OIDC connections (ee/); started with a connection id instead of a global provider.
export const ENTERPRISE_SSO = "oidc" as const;
export type SSOLogin = SSOProvider | typeof ENTERPRISE_SSO;

export interface SSOProvidersResponse {
  sso_enabled: boolean;
  providers: SSOProvider[];
}

export const signInAPICall = async (
  email: string,
  password: string,
  otpCode: string
): Promise<AxiosResponse<AuthTokenResponse>> => {
  const data: Record<string, string> = {
    email,
    password,
  };

  if (otpCode !== "") {
    data.otp_code = otpCode;
  }

  return axios.post<AuthTokenResponse>("/api/auth/token", data);
};

export const logoutAPICall = async (token: string): Promise<AxiosResponse> => {
  return axios.post("/api/auth/revoke", { token });
};

// Same-origin server routes attach the client id server-side (see api/auth/*).
export const acceptInviteAPICall = async (
  invitationToken: string,
  name: string,
  password: string
): Promise<AxiosResponse<AuthTokenResponse>> => {
  return axios.post<AuthTokenResponse>("/api/auth/accept-invite", {
    invitation_token: invitationToken,
    name,
    password,
  });
};

export const createAccountAPICall = async (
  email: string,
  password: string,
  name: string
): Promise<AxiosResponse<AuthTokenResponse>> => {
  return axios.post<AuthTokenResponse>("/api/auth/signup", {
    email,
    password,
    name,
  });
};

export const resetPasswordAPICall = async (
  email: string
): Promise<AxiosResponse> => {
  const data = {
    email: email,
  };

  return POST(config.apiPath + "/users/reset_password", data);
};

export const changePasswordAPICall = async (
  token: string,
  password: string
): Promise<AxiosResponse> => {
  const data = {
    new_password: password,
    reset_token: token,
  };

  return POST(config.apiPath + "/users/change_password", data);
};

export const currentUserAPICall = async (): Promise<
  AxiosResponse<UserResponse>
> => {
  return GET(config.apiPath + "/users/me");
};

export const enable2FAAPICall = async (
  enable: boolean,
  otpCode: string
): Promise<AxiosResponse<UserResponse>> => {
  const data = {
    enable_2fa: enable,
    otp_code: otpCode,
  };
  return PUT(config.apiPath + "/users/me/two_factor", data);
};

export const getOTPQrcodeAPICall = async (): Promise<AxiosResponse<string>> => {
  return GET(config.apiPath + "/users/me/otp_qr");
};

export const removeUserAPICall = async (
  email: string
): Promise<AxiosResponse> => {
  return DELETE(config.apiPath + `/users/me?email=${email}`);
};

export const editUserAPICall = async (
  data: EditUserPayload
): Promise<AxiosResponse<UserResponse>> => {
  return PATCH(config.apiPath + `/users/me`, data);
};

export const fetchLoginWithSSOEndpointAPICall = async (
  sso: string,
  body: unknown = null
): Promise<AxiosResponse<SSORedirectResponse>> => {
  const path = config.apiPath + "/identity/sso/auth/" + sso;
  return POST(path, body, { retry: false });
};

export const fetchSSOProvidersAPICall = async (): Promise<
  AxiosResponse<SSOProvidersResponse>
> => GET(config.apiPath + "/identity/sso/providers");
