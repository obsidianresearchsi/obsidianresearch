import { z } from "zod";
import { authenticWebhook, logFlutterwave, PaymentError, transactionId, verifyFlutterwave } from "@/lib/payments";

export const runtime = "nodejs";

const eventSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.union([z.string(), z.number().int().max(Number.MAX_SAFE_INTEGER)]),
    tx_ref: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  if (!request.headers.has("verif-hash") && !request.headers.has("flutterwave-signature")) {
    return new Response(null, { status: 401 });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64_000) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
  }
  const body = Buffer.concat(chunks);
  const authenticated = await authenticWebhook(request.headers, body);
  if (authenticated !== true) return new Response(null, { status: authenticated === null ? 503 : 401 });
  let json: unknown;
  try { json = JSON.parse(body.toString("utf8")); }
  catch {
    const logged = await logFlutterwave("malformed_event", "webhook");
    return new Response(null, { status: logged ? 400 : 503 });
  }
  if (z.object({ event: z.string() }).safeParse(json).data?.event !== "charge.completed") {
    return new Response(null, { status: 200 });
  }
  const event = eventSchema.safeParse(json);
  if (!event.success || !transactionId.test(String(event.data.data.id))) {
    const logged = await logFlutterwave("malformed_event", "webhook");
    return new Response(null, { status: logged ? 400 : 503 });
  }
  try {
    await verifyFlutterwave(String(event.data.data.id), event.data.data.tx_ref, "webhook");
    return new Response(null, { status: 200 });
  } catch (error) {
    const handled = error instanceof PaymentError && (error.reason === "failed" || error.reason === "mismatch");
    return new Response(null, { status: handled ? 200 : 503 });
  }
}
