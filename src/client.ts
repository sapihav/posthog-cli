import { type Config } from "./config.js";

interface ApiResponse<T> {
  results?: T[];
  next?: string | null;
  count?: number;
}

export class PostHogClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private projectId: string;

  constructor(config: Config) {
    this.projectId = config.projectId;
    this.baseUrl = config.host.replace(/\/$/, "");
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retries = 3
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let detail = text;
        try {
          const parsed = JSON.parse(text);
          detail = parsed.detail || parsed.message || text;
        } catch {
          // use raw text
        }
        throw new Error(`API ${res.status}: ${detail}`);
      }

      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    }

    throw new Error("Max retries exceeded");
  }

  // Convenience methods using project-scoped paths

  private projectPath(resource: string): string {
    return `/api/projects/${this.projectId}/${resource}`;
  }

  private envPath(resource: string): string {
    return `/api/environments/${this.projectId}/${resource}`;
  }

  // -- Generic CRUD --

  async list<T>(
    resource: string,
    params?: Record<string, string>,
    useEnv = false
  ): Promise<T[]> {
    const base = useEnv
      ? this.envPath(resource)
      : this.projectPath(resource);
    const qs = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    const data = await this.request<ApiResponse<T>>("GET", base + qs);
    return data.results ?? (data as unknown as T[]);
  }

  async listAll<T>(
    resource: string,
    params?: Record<string, string>,
    useEnv = false
  ): Promise<T[]> {
    const base = useEnv
      ? this.envPath(resource)
      : this.projectPath(resource);
    const qs = params
      ? "?" + new URLSearchParams(params).toString()
      : "";

    let nextUrl: string | null = base + qs;
    const all: T[] = [];

    while (nextUrl) {
      const reqPath: string = nextUrl.startsWith("http")
        ? nextUrl.replace(this.baseUrl, "")
        : nextUrl;
      const data: ApiResponse<T> = await this.request<ApiResponse<T>>("GET", reqPath);
      all.push(...(data.results ?? []));
      nextUrl = data.next ?? null;
    }
    return all;
  }

  async get<T>(
    resource: string,
    id: string | number,
    useEnv = false
  ): Promise<T> {
    const base = useEnv
      ? this.envPath(resource)
      : this.projectPath(resource);
    return this.request<T>("GET", `${base}${id}/`);
  }

  async create<T>(
    resource: string,
    body: unknown,
    useEnv = false
  ): Promise<T> {
    const base = useEnv
      ? this.envPath(resource)
      : this.projectPath(resource);
    return this.request<T>("POST", base, body);
  }

  async update<T>(
    resource: string,
    id: string | number,
    body: unknown,
    useEnv = false
  ): Promise<T> {
    const base = useEnv
      ? this.envPath(resource)
      : this.projectPath(resource);
    return this.request<T>("PATCH", `${base}${id}/`, body);
  }

  async delete(
    resource: string,
    id: string | number,
    useEnv = false
  ): Promise<void> {
    const base = useEnv
      ? this.envPath(resource)
      : this.projectPath(resource);
    await this.request<void>("DELETE", `${base}${id}/`);
  }

  // -- HogQL Query --

  async query<T = unknown>(hogql: string): Promise<T> {
    return this.request<T>("POST", this.envPath("query/"), {
      query: { kind: "HogQLQuery", query: hogql },
    });
  }
}
