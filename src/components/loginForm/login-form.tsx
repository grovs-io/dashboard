"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import googleIcon from "@/assets/icons/generic/Google.svg";
import microsoftIcon from "@/assets/icons/generic/Microsoft.svg";
import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { config } from "@/lib/config";
import { IS_SELF_HOSTED } from "@/lib/edition";
import {
  ENTERPRISE_SSO,
  type SSOLogin,
  type SSOProvider,
} from "@/api/auth/userService";
import type { UseFormReturn } from "react-hook-form";
import type { LoginFormValues } from "@/schemas/auth";

export function LoginForm({
  className,
  form,
  otpEnabled,
  handleLogin,
  loginWithSSO,
  ssoProviders,
  enterpriseConnectionId = null,
  enterpriseEnforced = false,
  ...props
}: LoginFormProps) {
  const {
    formState: { isValid, isSubmitting },
  } = form;
  const googleEnabled = ssoProviders.includes("google_oauth2");
  const microsoftEnabled = ssoProviders.includes("microsoft_graph");
  const enterpriseEnabled = enterpriseConnectionId !== null;
  // An organisation's own IdP replaces the social buttons; those would bypass its tenant.
  const socialEnabled =
    !enterpriseEnabled && (googleEnabled || microsoftEnabled);
  // Enforced domains sign in through their organisation only; before that the password is one click away.
  const passwordAllowed = !(enterpriseEnabled && enterpriseEnforced);
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const passwordEnabled =
    passwordAllowed && (!enterpriseEnabled || passwordRevealed);
  const ssoEnabled = socialEnabled || enterpriseEnabled;

  const description =
    enterpriseEnforced && enterpriseEnabled
      ? "Your organisation requires single sign-on"
      : ssoEnabled
        ? "Login with your configured account or email and password"
        : "Login with your email and password";

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleLogin}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (passwordEnabled) handleLogin?.(e);
                else loginWithSSO(ENTERPRISE_SSO);
              }
            }}
          >
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  {...form.register("email")}
                />
              </div>
              {enterpriseEnabled && (
                <Button
                  variant={passwordEnabled ? "outline" : "default"}
                  className="w-full"
                  type="button"
                  onClick={() => loginWithSSO(ENTERPRISE_SSO)}
                >
                  <Building2 className="h-4 w-4" />
                  Continue with your organisation
                </Button>
              )}
              {socialEnabled && (
                <div className="flex flex-col gap-4">
                  {googleEnabled && (
                    <Button
                      variant="outline"
                      className="w-full"
                      type="button"
                      onClick={() => loginWithSSO("google_oauth2")}
                    >
                      <Image
                        src={googleIcon}
                        alt="Google Icon"
                        width={24}
                        height={24}
                      />
                      Login with Google
                    </Button>
                  )}
                  {microsoftEnabled && (
                    <Button
                      variant="outline"
                      className="w-full"
                      type="button"
                      onClick={() => loginWithSSO("microsoft_graph")}
                    >
                      <Image
                        src={microsoftIcon}
                        alt="Microsoft Icon"
                        width={24}
                        height={24}
                      />
                      Login with Microsoft
                    </Button>
                  )}
                </div>
              )}
              {enterpriseEnabled && passwordAllowed && !passwordRevealed && (
                <button
                  type="button"
                  className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                  onClick={() => setPasswordRevealed(true)}
                >
                  Sign in with a password instead
                </button>
              )}
              {passwordEnabled && ssoEnabled && (
                <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                  <span className="bg-card text-muted-foreground relative z-10 px-2">
                    Or continue with
                  </span>
                </div>
              )}
              {passwordEnabled && (
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/reset_password"
                        className="ml-auto text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      required
                      {...form.register("password")}
                    />
                  </div>
                  {otpEnabled && (
                    <div className="grid gap-3">
                      <div className="flex items-center">
                        <Label htmlFor="otp">OTP</Label>
                      </div>
                      <Input
                        id="otp"
                        type="text"
                        required
                        {...form.register("otp")}
                      />
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!isValid || isSubmitting}
                  >
                    Login
                  </Button>
                </div>
              )}
              {!IS_SELF_HOSTED && passwordEnabled && (
                <div className="text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/register"
                    className="underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our{" "}
        <a href={config.termsUrl} target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href={config.privacyUrl} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </div>
    </div>
  );
}

type LoginFormProps = React.ComponentProps<"div"> & {
  form: UseFormReturn<LoginFormValues>;
  otpEnabled: boolean;
  handleLogin: (e?: React.BaseSyntheticEvent) => void;
  loginWithSSO: (provider: SSOLogin) => void;
  ssoProviders: readonly SSOProvider[];
  enterpriseConnectionId?: number | null;
  enterpriseEnforced?: boolean;
};
