import type { SupabaseClient } from "@supabase/supabase-js";
export function madridToday() {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value+"T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
export async function billingRows<T>(client: SupabaseClient, table: string, columns: string, order: string): Promise<T[]> {
  const rows:T[]=[];
  for(let offset=0;;offset+=500) {
    const {data,error}=await client.from(table).select(columns).order(order,{ascending:false}).order("id").range(offset,offset+499);
    if(error) throw error;
    rows.push(...(data??[]) as T[]);
    if(!data || data.length<500) return rows;
  }
}
