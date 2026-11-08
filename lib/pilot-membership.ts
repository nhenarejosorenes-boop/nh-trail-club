import { membershipLabels, type MembershipAccess, type MembershipPlan } from './membership-model.ts';
export type PilotMembership = { user_id: string; plan: string; starts_at: string; expires_at: string };
export function resolvePilotMembership(row: PilotMembership | null, at = new Date()): MembershipAccess | null {
  if (!row || !Object.hasOwn(membershipLabels,row.plan)) return null;
  const start=Date.parse(row.starts_at),end=Date.parse(row.expires_at),now=at.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || start>now || end<=now || end<=start) return null;
  return {state:'active',plan:row.plan as MembershipPlan,club:true,premium:row.plan!=='basic',source:'pilot',pilotExpiresAt:row.expires_at};
}
