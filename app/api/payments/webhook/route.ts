import { z } from "zod";
import { authenticWebhook, PaymentError, verifyFlutterwave } from "@/lib/payments";

export const runtime = "nodejs";

const eventSchema = z.object({
  event: z.string(),
  data: z.object({ id: z.union([z.string(), z.number()]), status: z.string().optional() }),
});

export async function POST(request: Request) {
  if (!await authenticWebhook(request.headers.get("verif-hash"))) return new Response(null, { status: 401 });
  const body = await request.text();
  if (body.length > 64_000) return new Response(null, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(body); }
  catch { return new Response(null, { status: 400 }); }
  const event = eventSchema.safeParse(json);
  if (!event.success) return new Response(null, { status: 400 });
  if (event.data.event !== "charge.completed") return new Response(null, { status: 200 });
  try {
    await verifyFlutterwave(String(event.data.data.id));
    return new Response(null, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentError && error.reason === "pending" && event.data.data.status === "failed") return new Response(null, { status: 200 });
    console.error("Flutterwave webhook requires retry or finance review.", error instanceof PaymentError ? error.reason : "provider");
    return new Response(null, { status: 503 });
  }
}
