const MAX_JSON_BODY_BYTES = 1_048_576;

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 500; error: string };

export async function readLimitedJsonBody(
  request: Request,
): Promise<JsonBodyResult> {
  if (request.body === null) {
    return { ok: false, status: 400, error: "invalid JSON body" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_JSON_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The oversized request is already being rejected.
        }
        return { ok: false, status: 413, error: "request body too large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 500, error: "internal server error" };
  } finally {
    reader.releaseLock();
  }

  try {
    const body = Buffer.concat(chunks, totalBytes).toString("utf8");
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, status: 400, error: "invalid JSON body" };
  }
}
