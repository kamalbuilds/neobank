import { avnuKey } from "../key";

export async function GET() {
  return Response.json({ configured: Boolean(avnuKey()) });
}
