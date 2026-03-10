import type {
  OmnyClip,
  OmnyClipsResult,
  OmnyClientConfig,
  OmnyProgram,
  RawOmnyClip,
  RawOmnyClipsResponse,
  RawOmnyProgram,
  RawOmnyProgramsResponse,
} from "./types.ts";
import { assertOk, DEFAULT_TIMEOUT_MS } from "./http.ts";

const DEFAULT_BASE_URL = "https://api.omny.fm";
const DEFAULT_PAGE_SIZE = 10;

const HEADERS: Record<string, string> = {
  accept: "application/json",
};

const VALID_PATH_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function assertValidSegment(value: string, label: string): void {
  if (!VALID_PATH_SEGMENT.test(value)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(value)}`);
  }
}

export class OmnyClient {
  private orgId: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: string | OmnyClientConfig) {
    if (typeof config === "string") {
      this.orgId = config;
      this.baseUrl = DEFAULT_BASE_URL;
      this.timeoutMs = DEFAULT_TIMEOUT_MS;
    } else {
      this.orgId = config.orgId;
      this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
      this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }
    assertValidSegment(this.orgId, "orgId");
  }

  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    await assertOk(res);
    return (await res.json()) as T;
  }

  private mapClip(raw: RawOmnyClip): OmnyClip {
    return {
      id: raw.Id,
      title: raw.Title,
      slug: raw.Slug,
      description: raw.Description,
      summary: raw.Summary,
      imageUrl: raw.ImageUrl,
      audioUrl: raw.AudioUrl,
      durationSeconds: raw.DurationSeconds,
      publishedUtc: raw.PublishedUtc,
      programId: raw.ProgramId,
      programSlug: raw.ProgramSlug,
      episodeType: raw.EpisodeType,
      season: raw.Season,
      episode: raw.Episode,
      shareUrl: raw.ShareUrl,
      tags: raw.Tags,
    };
  }

  private mapProgram(raw: RawOmnyProgram): OmnyProgram {
    return {
      id: raw.Id,
      name: raw.Name,
      slug: raw.Slug,
      description: raw.Description,
      artworkUrl: raw.ArtworkUrl,
      author: raw.Author,
      categories: raw.Categories,
    };
  }

  async getPrograms(): Promise<OmnyProgram[]> {
    const data = await this.get<RawOmnyProgramsResponse>(
      `${this.baseUrl}/orgs/${this.orgId}/programs`
    );
    return data.Programs.map((raw) => this.mapProgram(raw));
  }

  async getClips(
    programSlug: string,
    options?: { pageSize?: number; cursor?: string }
  ): Promise<OmnyClipsResult> {
    assertValidSegment(programSlug, "programSlug");
    const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    const data = await this.get<RawOmnyClipsResponse>(
      `${this.baseUrl}/programs/${programSlug}/clips?${params.toString()}`
    );
    return {
      clips: data.Clips.map((raw) => this.mapClip(raw)),
      cursor: data.Cursor,
      totalCount: data.TotalCount,
    };
  }

  async getClip(programSlug: string, clipSlug: string): Promise<OmnyClip> {
    assertValidSegment(programSlug, "programSlug");
    assertValidSegment(clipSlug, "clipSlug");
    const raw = await this.get<RawOmnyClip>(
      `${this.baseUrl}/programs/${programSlug}/clips/${clipSlug}`
    );
    return this.mapClip(raw);
  }
}
