import { trpc } from "@/lib/trpc";

export function useAuth() {
  const utils = trpc.useUtils();
  const userQuery = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  return {
    user: userQuery.data ?? null,
    loading: userQuery.isLoading,
    error: userQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(userQuery.data),
    logout: async () => {
      if (userQuery.data) {
        await logoutMutation.mutateAsync();
      }
    },
  };
}