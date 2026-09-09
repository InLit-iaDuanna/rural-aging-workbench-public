export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}
export async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, '业务服务未连接，请配置服务地址');
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error ?? data.message ?? '请求失败',
      data.details,
    );
  return data;
}
export const api = (
  project: string,
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
) =>
  request(`/api/v1/projects/${project}${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
