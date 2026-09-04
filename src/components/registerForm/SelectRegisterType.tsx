"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/useUserContext";
import LocalStorage from "@/lib/LocalStorage";
import { SSO_LOGIN } from "@/constants/OptionsConstants";
import googleIcon from "@/assets/icons/generic/Google.svg";
import microsoftIcon from "@/assets/icons/generic/Microsoft.svg";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

export function SelectRegisterType({ className, ...props }: LoginFormProps) {
  const router = useRouter();

  const { getSSOAuthenticationLink, userRef, isHydrated } = useUserContext();

  const handleRegisterWithEmail = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    router.replace("/register/with_email");
  };

  const loginWithSSO = async (
    e: React.MouseEvent<HTMLButtonElement>,
    sso: string
  ) => {
    e.preventDefault();
    LocalStorage.setLoginType(SSO_LOGIN);

    try {
      const response = await getSSOAuthenticationLink(sso);
      const redirectURL = response.data.redirect_url;

      // Full-page redirect to the provider. The backend completes the flow by
      // redirecting back to the app root with tokens in the URL, which the root
      // page captures. This works reliably on both desktop and mobile, unlike a
      // popup (mobile browsers block popups opened after an async call).
      window.location.href = redirectURL;
    } catch {
      // Keep the user on the page if the auth link could not be fetched.
    }
  };

  useEffect(() => {
    if (!isHydrated) return;

    // Mount-only: userRef is a ref whose .current is read but shouldn't trigger re-runs
    if (userRef.current) {
      router.replace("/dashboard");
    }
  }, [isHydrated, router, userRef]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Get started</CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => loginWithSSO(e, "google_oauth2")}
                >
                  <Image
                    src={googleIcon}
                    alt="Google Icon"
                    width={24}
                    height={24}
                  />
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => loginWithSSO(e, "microsoft_graph")}
                >
                  <Image
                    src={microsoftIcon}
                    alt="Microsoft Icon"
                    width={24}
                    height={24}
                  />
                  Continue with Microsoft
                </Button>
              </div>
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2">
                  Or
                </span>
              </div>
              <div className="grid gap-6">
                <div className="flex flex-col gap-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRegisterWithEmail}
                  >
                    Register with email and password
                  </Button>
                </div>
                <div className="flex text-start text-sm gap-1">
                  Already a member?
                  <Link href="/login" className="underline underline-offset-4">
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type LoginFormProps = React.ComponentProps<"div"> & {};
