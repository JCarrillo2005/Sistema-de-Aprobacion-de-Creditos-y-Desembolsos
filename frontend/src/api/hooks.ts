import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { auditApi, authApi, budgetApi, requestsApi } from "./endpoints";
import type {
  AuditFilters,
  CreateRequestPayload,
  RequestStatus,
} from "./types";

export const keys = {
  users: ["users"] as const,
  requests: ["requests"] as const,
  requestList: (status?: RequestStatus) =>
    ["requests", "list", status ?? "all"] as const,
  request: (id: number) => ["requests", "detail", id] as const,
  budget: ["budget"] as const,
  audit: (filters: AuditFilters) => ["audit", filters] as const,
};

// ---------- Consultas ----------

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: authApi.users });
}

export function useRequests(
  options: { status?: RequestStatus; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: keys.requestList(options.status),
    queryFn: () => requestsApi.list(options.status),
    refetchInterval: options.refetchInterval,
  });
}

export function useRequest(
  id: number,
  enabled: boolean,
  refetchInterval?: number,
) {
  return useQuery({
    queryKey: keys.request(id),
    queryFn: () => requestsApi.get(id),
    enabled,
    refetchInterval,
  });
}

// Detección previa del documento: la misma regla que aplica el backend al crear.
export function useDocumentStatus(documentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["requests", "document-status", documentId] as const,
    queryFn: () => requestsApi.documentStatus(documentId),
    enabled,
    staleTime: 5_000,
    retry: false,
  });
}

export function useBudget(refetchInterval?: number) {
  return useQuery({
    queryKey: keys.budget,
    queryFn: budgetApi.get,
    refetchInterval,
  });
}

export function useAudit(
  filters: AuditFilters,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: keys.audit(filters),
    queryFn: () => auditApi.list(filters),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });
}

// ---------- Mutaciones ----------

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.requests }),
        queryClient.invalidateQueries({ queryKey: keys.budget }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]),
    [queryClient],
  );
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRequestPayload) => requestsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.requests }),
  });
}

export function useStartReview() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => requestsApi.startReview(id),
    onSuccess: invalidate,
  });
}

export function useApprove() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => requestsApi.approve(id),
    onSuccess: invalidate,
  });
}

export function useReject() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (vars: { id: number; comment: string }) =>
      requestsApi.reject(vars.id, vars.comment),
    onSuccess: invalidate,
  });
}

// La mutación del buró vive en el caché global: sigue en curso aunque el usuario navegue
// a otra página, y su estado se puede consultar desde cualquier componente.
export function useBureauCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["bureau"],
    mutationFn: (requestId: number) => requestsApi.bureauCheck(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.requests }),
  });
}

export function useBureauState(requestId: number): {
  pending: boolean;
  error: Error | null;
} {
  const states = useMutationState({
    filters: { mutationKey: ["bureau"] },
    select: (mutation) => ({
      id: mutation.state.variables as number | undefined,
      status: mutation.state.status,
      error: mutation.state.error,
    }),
  });

  const mine = states.filter((state) => state.id === requestId);
  const last = mine[mine.length - 1];

  return {
    pending: last?.status === "pending",
    error: last?.status === "error" ? last.error : null,
  };
}
