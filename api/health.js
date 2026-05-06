/**
 * Vercel serverless — sanity check: GET /api/health
 */
export default function handler(req, res) {
  res.status(200).json({ ok: true, service: "circl" });
}
