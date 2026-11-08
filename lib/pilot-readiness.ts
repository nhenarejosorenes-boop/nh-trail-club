import type { SupabaseClient } from '@supabase/supabase-js';
import { AthleteAccessError } from './athlete-detail.ts';
import { membershipMonth, resolveMembershipAccess, type MembershipPlan, type MembershipRequest, type MembershipDue } from './membership-model.ts';
import { resolvePilotMembership, type PilotMembership } from './pilot-membership.ts';

export const pilotPlans = ['basic', 'plus', 'plus_performance'] as const;
export const pilotLabels: Record<MembershipPlan, string> = { basic: 'Básica', plus: 'PLUS', plus_performance: 'PLUS Performance' };
export type PilotRequest = MembershipRequest & { user_id: string };
export type PilotCard = { id: string; user_id: string | null };
export type PilotGroup = { plan: MembershipPlan; active: number; linked: number; missingCard: number };
export type PilotReadiness = { period: string; checkedAt: string; groups: PilotGroup[]; testGroups?: PilotGroup[]; unlinkedCards: number; unpaidAccounts: number; pendingAccounts: number };

export function pilotReadiness(requests: readonly PilotRequest[], dues: readonly MembershipDue[], cards: readonly PilotCard[], at = new Date(), pilots: readonly PilotMembership[] = []): PilotReadiness {
  const byUser = new Map<string, PilotRequest[]>();
  for (const request of requests) {
    const own = byUser.get(request.user_id) ?? [];
    own.push(request); byUser.set(request.user_id, own);
  }
  const dueBySubscription = new Map<string, MembershipDue[]>();
  for (const due of dues) {
    const own = dueBySubscription.get(due.subscription_id) ?? [];
    own.push(due); dueBySubscription.set(due.subscription_id, own);
  }
  const linked = new Set(cards.flatMap(card => card.user_id ? [card.user_id] : []));
  const groups = pilotPlans.map(plan => ({ plan, active: 0, linked: 0, missingCard: 0 }));
  let unpaidAccounts = 0, pendingAccounts = 0;
  for (const [user, own] of byUser) {
    const access = resolveMembershipAccess('athlete', own, own.flatMap(request => dueBySubscription.get(request.id) ?? []), at);
    if (access.state === 'unpaid') unpaidAccounts++;
    if (access.state === 'pending') pendingAccounts++;
    if (access.state !== 'active' || !access.plan) continue;
    const group = groups.find(group => group.plan === access.plan)!;
    group.active++;
    if (linked.has(user)) group.linked++; else group.missingCard++;
  }
  const testGroups=pilotPlans.map(plan=>({plan,active:0,linked:0,missingCard:0}));
  for(const row of pilots){
    const access=resolvePilotMembership(row,at);if(!access)continue;
    const group=testGroups.find(group=>group.plan===access.plan)!;group.active++;
    if(linked.has(row.user_id))group.linked++;else group.missingCard++;
  }
  return { period: membershipMonth(at), checkedAt: at.toISOString(), groups, testGroups, unlinkedCards: cards.filter(card => !card.user_id).length, unpaidAccounts, pendingAccounts };
}

async function pages<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetch(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export async function loadPilotReadiness(client: SupabaseClient, at = new Date()) {
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) throw new AthleteAccessError('login');
  const profile = await client.from('profiles').select('role').eq('id', auth.data.user.id).single();
  if (profile.error) throw profile.error;
  if (profile.data?.role !== 'admin') throw new AthleteAccessError('forbidden');
  const period = membershipMonth(at);
  const [requests, cards, pilots] = await Promise.all([
    pages<PilotRequest>((from,to) => client.from('club_subscription_requests').select('id,user_id,plan,status')
      .in('status',['approved','pending']).order('id').range(from,to)),
    pages<PilotCard>((from,to) => client.from('deportistas').select('id,user_id').order('id').range(from,to)),
    pages<PilotMembership>((from,to)=>client.from('club_pilot_memberships').select('user_id,plan,starts_at,expires_at').order('user_id').range(from,to)),
  ]);
  const ids = [...new Set(requests.filter(request => request.status === 'approved').map(request => request.id))];
  const dues: MembershipDue[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    dues.push(...await pages<MembershipDue>((from,to) => client.from('club_subscription_monthly_dues').select('subscription_id,period_month,amount_eur,status')
      .in('subscription_id',ids.slice(offset,offset+100)).eq('period_month',period).eq('status','paid').gt('amount_eur',0)
      .order('subscription_id').order('id').range(from,to)));
  }
  return pilotReadiness(requests,dues,cards,at,pilots);
}
