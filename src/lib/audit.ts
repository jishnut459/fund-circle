import { createAdminSupabaseClient } from "./supabase-server"

export async function writeAuditLog(params: {
  circleId: string | null
  userId: string
  action: string
  entityType: string
  entityId?: string
  previousValue?: unknown
  newValue?: unknown
}): Promise<void> {
  const supabase = createAdminSupabaseClient()

  await supabase.from("audit_logs").insert({
    circle_id: params.circleId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    previous_value: params.previousValue ?? null,
    new_value: params.newValue ?? null,
  })
}
