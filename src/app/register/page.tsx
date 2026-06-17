"use client";

import { SelectRegisterType } from "@/components/registerForm/SelectRegisterType";
import { IS_SELF_HOSTED } from "@/lib/edition";
import { redirect } from "next/navigation";

const Page = () => {
  // Public sign-up is closed in self-hosted mode (backend also rejects it).
  if (IS_SELF_HOSTED) redirect("/login");

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 w-full">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <SelectRegisterType />
      </div>
    </div>
  );
};

export default Page;
