export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "x-requested-with": "football-idle",
    ...extra,
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") headers["idempotency-key"] = crypto.randomUUID();
  const options: RequestInit = {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, options);
  } catch {
    response = await fetch(`/api/v1${path}`, options);
  }
  const payload = await response.json();
  if (!response.ok)
    throw new ApiError(
      payload.error?.message ?? "Não foi possível concluir a ação.",
      payload.error?.code ?? "UNKNOWN",
      response.status,
    );
  return payload.data as T;
}
