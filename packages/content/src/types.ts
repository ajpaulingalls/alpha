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
