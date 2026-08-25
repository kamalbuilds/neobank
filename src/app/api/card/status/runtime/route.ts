import { readCardRuntimeHealth } from "@/server/card/status";

export const runtime = "nodejs";

export async function GET() {
  const status = await readCardRuntimeHealth();
  return Response.json(status, { status: status.configured ? 200 : 503 });
}
