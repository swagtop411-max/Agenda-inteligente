import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
webpush.setVapidDetails("mailto:suporte@agenda-inteligente.app", vapidPublic, vapidPrivate);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}
function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function dateLabel(date: string) { return new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }); }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const auth = req.headers.get("authorization") || "";
  if (auth !== "Bearer " + serviceKey) return json({ error: "Unauthorized" }, 401);
  try {
    const now = localParts();
    const today = `${now.year}-${now.month}-${now.day}`;
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    const { data: subscriptions, error: subError } = await db.from("push_subscriptions").select("user_id,endpoint,subscription");
    if (subError) throw subError;
    if (!subscriptions?.length) return json({ sent: 0, message: "No subscriptions" });

    const users = [...new Set(subscriptions.map(x => x.user_id))];
    const [{ data: bills, error: billsError }, { data: events, error: eventsError }] = await Promise.all([
      db.from("bills").select("id,user_id,title,date,amount,paid").in("user_id", users).eq("paid", false),
      db.from("events").select("id,user_id,title,date,time").in("user_id", users)
    ]);
    if (billsError) throw billsError;
    if (eventsError) throw eventsError;

    const jobs: Array<{ user_id: string; record_key: string; reminder_key: string; title: string; body: string }> = [];
    for (const bill of bills || []) {
      const delta = Math.round((Date.parse(bill.date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
      if (delta === 3 || delta === 1 || delta === 0) {
        const label = delta === 0 ? "vence hoje" : `vence em ${delta} dia(s)`;
        jobs.push({ user_id: bill.user_id, record_key: "bill:" + bill.id, reminder_key: "bill:" + delta, title: "Conta próxima do vencimento", body: `${bill.title}: ${label} (${dateLabel(bill.date)}) — R$ ${Number(bill.amount || 0).toFixed(2).replace(".", ",")}` });
      } else if (delta < 0) {
        jobs.push({ user_id: bill.user_id, record_key: "bill:" + bill.id, reminder_key: "overdue:" + today, title: "Conta em atraso", body: `${bill.title}: vencida em ${dateLabel(bill.date)}. Confira no Agenda Inteligente.` });
      }
    }
    for (const event of events || []) {
      const delta = Math.round((Date.parse(event.date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
      if (delta === 1) jobs.push({ user_id: event.user_id, record_key: "event:" + event.id, reminder_key: "event:1day", title: "Compromisso amanhã", body: `${event.title} — ${dateLabel(event.date)}${event.time ? " às " + event.time : ""}` });
      if (delta === 0 && event.time) {
        const match = String(event.time).match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          const eventMinutes = Number(match[1]) * 60 + Number(match[2]);
          if (eventMinutes - currentMinutes >= 0 && eventMinutes - currentMinutes <= 60) {
            jobs.push({ user_id: event.user_id, record_key: "event:" + event.id, reminder_key: "event:1hour", title: "Compromisso em breve", body: `${event.title} começa às ${event.time}.` });
          }
        }
      }
    }

    let sent = 0, skipped = 0;
    for (const job of jobs) {
      const { data: already } = await db.from("push_notification_log").select("id").eq("user_id", job.user_id).eq("record_key", job.record_key).eq("reminder_key", job.reminder_key).maybeSingle();
      if (already) { skipped++; continue; }
      const targets = (subscriptions || []).filter(s => s.user_id === job.user_id);
      let delivered = false;
      for (const target of targets) {
        try {
          await webpush.sendNotification(target.subscription, JSON.stringify({ title: job.title, body: job.body, url: "./", tag: job.record_key + "-" + job.reminder_key }));
          delivered = true; sent++;
        } catch (err) {
          const status = Number((err as { statusCode?: number }).statusCode || 0);
          if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", target.endpoint);
          console.error("Push delivery failed", status, err);
        }
      }
      if (delivered) {
        const { error } = await db.from("push_notification_log").insert({ user_id: job.user_id, record_key: job.record_key, reminder_key: job.reminder_key });
        if (error && error.code !== "23505") console.error("Push log error", error);
      }
    }
    return json({ sent, skipped, evaluated: jobs.length });
  } catch (error) {
    console.error(error);
    return json({ error: String(error) }, 500);
  }
});
