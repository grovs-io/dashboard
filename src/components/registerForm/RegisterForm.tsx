"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UseFormReturn } from "react-hook-form";
import type { RegisterFormValues } from "@/schemas/auth";
import { FieldError } from "@/components/common/FieldError";
import { PasswordChecklist } from "@/components/common/PasswordChecklist";

export function RegisterForm({
  className,
  form,
  handleRegister,
  showConditions,
  setPasswordRulesValid,
  passwordRulesValid,
  acceptInvite,
  ...props
}: RegisterFormProps) {
  const {
    formState: { isValid, errors },
  } = form;
  const watchedPassword = form.watch("password");
  const watchedPasswordConfirm = form.watch("password_confirm");

  // Reveal the password rules as soon as the user starts typing (not only after
  // a failed submit) so they can see exactly which requirements are unmet.
  const showChecklist = showConditions || watchedPassword.length > 0;

  // Derive the mismatch from the live values rather than `errors.password_confirm`.
  // react-hook-form only re-validates the field being edited, so the zod refine
  // error on the confirm field goes stale when the user fixes the *password*
  // field — leaving "Passwords do not match" showing even once they match.
  const passwordsMismatch =
    watchedPasswordConfirm.length > 0 &&
    watchedPassword !== watchedPasswordConfirm;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister}>
            <div className="grid gap-6">
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter name"
                    required
                    aria-invalid={!!errors.name}
                    {...form.register("name")}
                  />
                  <FieldError message={errors.name?.message} />
                </div>
                {!acceptInvite && (
                  <div className="grid gap-3">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email"
                      required
                      aria-invalid={!!errors.email}
                      {...form.register("email")}
                    />
                    <FieldError message={errors.email?.message} />
                  </div>
                )}
                <div className="grid gap-3">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    required
                    aria-invalid={!!errors.password}
                    {...form.register("password")}
                  />
                  <FieldError message={errors.password?.message} />
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center">
                    <Label htmlFor="password_confirm">Confirm password</Label>
                  </div>
                  <Input
                    id="password_confirm"
                    type="password"
                    placeholder="Confirm password"
                    required
                    aria-invalid={passwordsMismatch}
                    {...form.register("password_confirm")}
                  />
                  <FieldError
                    message={
                      passwordsMismatch ? "Passwords do not match" : undefined
                    }
                  />
                </div>
                <div className={showChecklist ? "visible" : "hidden"}>
                  <PasswordChecklist
                    password={watchedPassword}
                    passwordConfirm={watchedPasswordConfirm}
                    minLength={8}
                    onValidityChange={setPasswordRulesValid}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isValid || !passwordRulesValid}
                >
                  Get started
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type RegisterFormProps = React.ComponentProps<"div"> & {
  form: UseFormReturn<RegisterFormValues>;
  handleRegister: (e?: React.BaseSyntheticEvent) => void;
  showConditions: boolean;
  setPasswordRulesValid: (valid: boolean) => void;
  passwordRulesValid: boolean;
  acceptInvite?: boolean;
};
