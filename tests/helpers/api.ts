// tests/helpers/api.ts

import { httpClient } from "../config/http.ts";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export async function api(
  method: HttpMethod,
  path: string,
  body?: unknown,
  token?: string,
  raw: boolean = false
) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await httpClient.request({
    method,
    url: path,
    data: body,
    headers,
  });

  if (raw) {
    return {
      status: res.status,
      data: res.data,
      headers: res.headers,
    };
  }

  // Default: unwrap body + attach status (used by existing tests)
  return {
    status: res.status,
    ...res.data,
  };
}
