import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const appSecret = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

if (!supabaseUrl || !appSecret || !vapidPublicKey || !vapidPrivateKey) {
  console.error("Configuração incompleta: confira os secrets da Edge Function.");
}

const db = supabaseUrl && appSecret
  ? createClient(supabaseUrl, appSecret, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:suporte@agenda-inteligente.app",
    vapidPublicKey,
    vapidPrivateKey,
  );
}

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateLabel(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

function daysBetween(date: string, today: string) {
  return Math.round(
    (Date.parse(date + "T12:00:00Z") -
      Date.parse(today + "T12:00:00Z")) / 86400000,
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Use o método POST." }, 405);
  }

  if (!supabaseUrl || !appSecret || !vapidPublicKey || !vapidPrivateKey || !db) {
    return json({
      error: "Configuração incompleta. Confira APP_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY nos secrets.",
    }, 500);
  }

  // A função deve ser publicada com a verificação JWT do gateway desativada.
  // O segredo é validado aqui por um cabeçalho próprio, usado somente pelo cron.
  const suppliedSecret = req.headers.get("x-app-secret") ?? "";
  if (!suppliedSecret || suppliedSecret !== appSecret) {
    return json({ error: "Não autorizado." }, 401);
  }

  try {
    const now = localParts();
    const today = `${now.year}-${now.month}-${now.day}`;
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);

    const { data: subscriptions, error: subscriptionsError } = await db
      .from("push_subscriptions")
      .select("user_id, endpoint, subscription");

    if (subscriptionsError) throw subscriptionsError;

    if (!subscriptions?.length) {
      return json({ sent: 0, skipped: 0, evaluated: 0, message: "Nenhuma inscrição push cadastrada." });
    }

    const userIds = [...new Set(subscriptions.map((item) => item.user_id))];

    const [
      { data: bills, error: billsError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      db.from("bills")
        .select("id, user_id, title, date, amount, paid")
        .in("user_id", userIds)
        .eq("paid", false),
      db.from("events")
        .select("id, user_id, title, date, time")
        .in("user_id", userIds),
    ]);

    if (billsError) throw billsError;
    if (eventsError) throw eventsError;

    type PushJob = {
      user_id: string;
      record_key: string;
      reminder_key: string;
      title: string;
      body: string;
    };

    const jobs: PushJob[] = [];

    for (const bill of bills ?? []) {
      const delta = daysBetween(bill.date, today);

      if ([3, 1, 0].includes(delta)) {
        const label = delta === 0 ? "vence hoje" : `vence em ${delta} dia(s)`;
        const amount = Number(bill.amount || 0).toFixed(2).replace(".", ",");

        jobs.push({
          user_id: bill.user_id,
          record_key: "bill:" + bill.id,
          reminder_key: "bill:" + delta,
          title: "Conta próxima do vencimento",
          body: `${bill.title}: ${label} (${dateLabel(bill.date)}) — R$ ${amount}`,
        });
      } else if (delta < 0) {
        jobs.push({
          user_id: bill.user_id,
          record_key: "bill:" + bill.id,
          reminder_key: "overdue:" + today,
          title: "Conta em atraso",
          body: `${bill.title}: vencida em ${dateLabel(bill.date)}. Confira no Agenda Inteligente.`,
        });
      }
    }

    for (const event of events ?? []) {
      const delta = daysBetween(event.date, today);

      if (delta === 1) {
        jobs.push({
          user_id: event.user_id,
          record_key: "event:" + event.id,
          reminder_key: "event:1day",
          title: "Compromisso amanhã",
          body: `${event.title} — ${dateLabel(event.date)}${event.time ? " às " + event.time : ""}`,
        });
      }

      if (delta === 0 && event.time) {
        const match = String(event.time).match(/^(\d{1,2}):(\d{2})/);

        if (match) {
          const eventMinutes = Number(match[1]) * 60 + Number(match[2]);
          const minutesUntil = eventMinutes - currentMinutes;

          if (minutesUntil >= 0 && minutesUntil <= 60) {
            jobs.push({
              user_id: event.user_id,
              record_key: "event:" + event.id,
              reminder_key: "event:1hour",
              title: "Compromisso em breve",
              body: `${event.title} começa às ${event.time}.`,
            });
          }
        }
      }
    }

    let sent = 0;
    let skipped = 0;

    for (const job of jobs) {
      const { data: alreadySent, error: logCheckError } = await db
        .from("push_notification_log")
        .select("id")
        .eq("user_id", job.user_id)
        .eq("record_key", job.record_key)
        .eq("reminder_key", job.reminder_key)
        .maybeSingle();

      if (logCheckError) throw logCheckError;

      if (alreadySent) {
        skipped++;
        continue;
      }

      const targets = subscriptions.filter((item) => item.user_id === job.user_id);
      let delivered = false;

      for (const target of targets) {
        try {
          await webpush.sendNotification(
            target.subscription,
            JSON.stringify({
              title: job.title,
              body: job.body,
              url: "./",
              tag: job.record_key + "-" + job.reminder_key,
            }),
          );
          delivered = true;
          sent++;
        } catch (error) {
          const status = Number((error as { statusCode?: number }).statusCode || 0);

          if (status === 404 || status === 410) {
            const { error: deleteError } = await db
              .from("push_subscriptions")
              .delete()
              .eq("user_id", target.user_id)
              .eq("endpoint", target.endpoint);

            if (deleteError) console.error("Erro ao remover inscrição expirada:", deleteError);
          }

          console.error("Falha ao enviar push:", status, error);
        }
      }

      if (delivered) {
        const { error: logError } = await db
          .from("push_notification_log")
          .insert({
            user_id: job.user_id,
            record_key: job.record_key,
            reminder_key: job.reminder_key,
          });

        if (logError && logError.code !== "23505") {
          console.error("Erro ao registrar envio:", logError);
        }
      }
    }

    return json({ sent, skipped, evaluated: jobs.length });
  } catch (error) {
    console.error("Erro na função send-push:", error);
    return json({ error: String(error) }, 500);
  }
});
