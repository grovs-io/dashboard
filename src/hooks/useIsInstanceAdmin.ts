"use client";

import { ADMIN_ROLE } from "@/constants/OptionsConstants";
import { useProjectSelection } from "@/context/useProjectSelection";
import { useUserContext } from "@/context/useUserContext";

export function useIsInstanceAdmin(): boolean {
  const { user, userRef } = useUserContext();
  const { selectedInstance } = useProjectSelection();

  // `user` state (not userRef) so callers re-render when roles arrive — a ref
  // read leaves the sidebar stuck on its first, role-less render.
  const roles = (user ?? userRef.current)?.roles || [];
  const roleEntry = roles.find((r) => r.instance_id === selectedInstance?.id);

  return roleEntry?.role === ADMIN_ROLE;
}
