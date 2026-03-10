// Public types

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  slug: string;
  link: string;
  author: string;
  imageUrl: string;
  categories: string[];
  tags: string[];
}

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  imageUrl: string;
  publishedAt: string;
}

export interface PodcastSeries {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  audioUrl: string;
  duration: string;
}

export interface ContentClientConfig {
  graphqlUrl: string;
  /** Request timeout in milliseconds (default: 15 000) */
  timeoutMs?: number;
}

// Internal raw API response types

export interface RawAuthor {
  name: string;
}

export interface RawFeaturedImage {
  sourceUrl: string;
}

export interface RawTaxonomy {
  name: string;
}

export interface RawPost {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  date: string;
  link: string;
  author: RawAuthor[];
  featuredImage: RawFeaturedImage | null;
  categories: RawTaxonomy[];
  tags: RawTaxonomy[];
  audioPlaybackUrl?: string;
  audioDuration?: string;
}

export interface RawSearchItem {
  title: string;
  snippet: string;
  link: string;
  pagemap?: {
    cse_image?: { src: string }[];
  };
}

// --- Omny Studio Consumer API types ---

// Public

export interface OmnyProgram {
  id: string;
  name: string;
  slug: string;
  description: string;
  artworkUrl: string | null;
  author: string | null;
  categories: string[] | null;
}

export interface OmnyClip {
  id: string;
  title: string;
  slug: string;
  description: string;
  summary: string | null;
  imageUrl: string | null;
  audioUrl: string;
  durationSeconds: number;
  publishedUtc: string;
  programId: string;
  programSlug: string;
  episodeType: string;
  season: number | null;
  episode: number | null;
  shareUrl: string | null;
  tags: string[] | null;
}

export interface OmnyClipsResult {
  clips: OmnyClip[];
  cursor: string | null;
  totalCount: number;
}

export interface OmnyClientConfig {
  orgId: string;
  /** Base URL for the Omny Consumer API (default: https://api.omny.fm) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 15 000) */
  timeoutMs?: number;
}

// Internal (PascalCase from API)

export interface RawOmnyProgram {
  Id: string;
  Name: string;
  Slug: string;
  Description: string;
  DescriptionHtml: string | null;
  ArtworkUrl: string | null;
  Author: string | null;
  Categories: string[] | null;
}

export interface RawOmnyClip {
  Id: string;
  Title: string;
  Slug: string;
  Description: string;
  Summary: string | null;
  ImageUrl: string | null;
  AudioUrl: string;
  DurationSeconds: number;
  PublishedUtc: string;
  ProgramId: string;
  ProgramSlug: string;
  EpisodeType: string;
  Season: number | null;
  Episode: number | null;
  ShareUrl: string | null;
  Tags: string[] | null;
}

export interface RawOmnyClipsResponse {
  Clips: RawOmnyClip[];
  Cursor: string | null;
  TotalCount: number;
}

export interface RawOmnyProgramsResponse {
  Programs: RawOmnyProgram[];
}
