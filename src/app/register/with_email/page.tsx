"use client";
import { useUserContext } from "@/context/useUserContext";
import { useState } from "react";

import { RegisterForm } from "@/components/registerForm/RegisterForm";
import { showErrorNotification } from "@/lib/Notifications";
import { getApiErrorInfo } from "@/lib/ApiError";
import { useRouter, redirect } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormValues } from "@/schemas/auth";
import { IS_SELF_HOSTED } from "@/lib/edition";

const REGISTER_DEFAULT_VALUES: RegisterFormValues = {
  name: "",
  email: "",
  password: "",
  password_confirm: "",
};

const Page = () => {
  const { createUser } = useUserContext();
  const [passwordRulesValid, setPasswordRulesValid] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const router = useRouter();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: REGISTER_DEFAULT_VALUES,
  });

  const handleRegister = async (data: RegisterFormValues) => {
    if (!passwordRulesValid) {
      setShowConditions(true);
      return;
    }

    try {
      await createUser(data.email, data.password, data.name);
      router.replace("/");
    } catch (error) {
      const { message, fieldErrors } = getApiErrorInfo(
        error,
        "We couldn't create your account. Please try again."
      );

      // Map any field-specific backend errors (e.g. "Email has already been
      // taken") onto the matching input so they show inline next to the field.
      let mappedToField = false;
      (["email", "password", "name"] as const).forEach((field) => {
        if (fieldErrors[field]) {
          form.setError(field, { type: "server", message: fieldErrors[field] });
          mappedToField = true;
        }
      });

      // Only toast when we couldn't attach the error to a specific field, to
      // avoid duplicating the same message inline and in a toast.
      if (!mappedToField) {
        showErrorNotification(message);
      }
    }
  };

  // Public sign-up is closed in self-hosted mode (backend also rejects it).
  if (IS_SELF_HOSTED) redirect("/login");

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 w-full">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <RegisterForm
          form={form}
          handleRegister={form.handleSubmit(handleRegister)}
          passwordRulesValid={passwordRulesValid}
          setPasswordRulesValid={setPasswordRulesValid}
          showConditions={showConditions}
        />
      </div>
    </div>
  );
};

export default Page;
