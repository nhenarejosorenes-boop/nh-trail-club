import type { SupabaseClient } from "@supabase/supabase-js";
import { membershipMonth, resolveMembershipAccess, type MembershipDue, type MembershipRequest } from "./membership-model";

export async function loadMembershipAccess(client: SupabaseClient, userId: string, knownRole?: string) {
  const at = new Date();
  const [profile, subscriptions] = await Promise.all([
    knownRole === undefined ? client.from("profiles").select("role").eq("id", userId).single() :
      Promise.resolve({ data: { role: knownRole }, error: null }),
    client.from("club_subscription_requests").select("id,plan,status").eq("user_id", userId).in("status", ["approved", "pending"]),
  ]);
  if (profile.error) throw profile.error;
  if (subscriptions.error) throw subscriptions.error;
  const requests = (subscriptions.data ?? []) as MembershipRequest[];
  if (profile.data.role === "admin") return resolveMembershipAccess("admin", requests, [], at);
  const approved = requests.filter(s => s.status === "approved").map(s => s.id);
  if (!approved.length) return resolveMembershipAccess(profile.data.role, requests, [], at);
  const dues = await client.from("club_subscription_monthly_dues")
    .select("subscription_id,period_month,amount_eur,status").in("subscription_id", approved)
    .eq("period_month", membershipMonth(at)).eq("status", "paid").gt("amount_eur", 0);
  if (dues.error) throw dues.error;
  return resolveMembershipAccess(profile.data.role, requests, (dues.data ?? []) as MembershipDue[], at);
}
