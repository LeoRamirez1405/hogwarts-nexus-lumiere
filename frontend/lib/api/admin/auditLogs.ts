import { request, buildQuery } from "../../core";
import type { PaginationParams, Page } from "../../core";

export interface AuditLogResponse {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  actor_name?: string;
}

export interface AuditLogPage {
  items: AuditLogResponse[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export const auditLogsApi = {
  getAuditLogs: (params?: {
    actor_id?: string;
    action?: string;
    entity_type?: string;
    entity_id?: string;
    pagination?: PaginationParams;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.actor_id) searchParams.set("actor_id", params.actor_id);
    if (params?.action) searchParams.set("action", params.action);
    if (params?.entity_type)
      searchParams.set("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.set("entity_id", params.entity_id);
    if (params?.pagination?.skip)
      searchParams.set("skip", String(params.pagination.skip));
    if (params?.pagination?.limit)
      searchParams.set("limit", String(params.pagination.limit));
    return request<AuditLogPage>(`/audit-logs?${searchParams.toString()}`);
  },

  getAuditLog: (id: string) =>
    request<AuditLogResponse>(`/audit-logs/${id}`),
};