export type MembershipPlan = "basic" | "plus" | "plus_performance";
export type MembershipRequest = { id: string; plan: string; status: string };
export type MembershipDue = { subscription_id: string; period_month: string; amount_eur: number | string; status: string };
export type MembershipAccess = {
  state: "admin" | "active" | "pending" | "unpaid" | "none";
  plan: MembershipPlan | null;
  club: boolean;
  premium: boolean;
};

const rank: Record<MembershipPlan, number> = { basic: 1, plus: 2, plus_performance: 3 };
export const membershipLabels: Record<MembershipPlan, string> = {
  basic: "NH Club Trail Running Alicante Básica", plus: "NH Club Trail Running Alicante PLUS", plus_performance: "PLUS Performance",
};

export function membershipMonth(at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
  }).formatToParts(at);
  return parts.find(p => p.type === "year")!.value + "-" + parts.find(p => p.type === "month")!.value + "-01";
}

// Presentation only. Authorization remains enforced by Supabase policies/RPCs.
export function resolveMembershipAccess(
  role: string | null, requests: readonly MembershipRequest[], dues: readonly MembershipDue[], at = new Date(),
): MembershipAccess {
  if (role === "admin") return { state: "admin", plan: null, club: true, premium: true };
  const valid = requests.filter((s): s is MembershipRequest & { plan: MembershipPlan } =>
    Object.hasOwn(rank, s.plan));
  const approved = valid.filter(s => s.status === "approved");
  const period = membershipMonth(at);
  const paid = approved.filter(s => dues.some(d => d.subscription_id === s.id &&
    d.period_month === period && d.status === "paid" && Number(d.amount_eur) > 0));
  const current = paid.reduce<typeof paid[number] | undefined>((best, s) =>
    !best || rank[s.plan] > rank[best.plan] ? s : best, undefined);
  if (current) return { state: "active", plan: current.plan, club: true, premium: current.plan !== "basic" };
  return { state: approved.length ? "unpaid" : valid.some(s => s.status === "pending") ? "pending" : "none",
    plan: null, club: false, premium: false };
}
