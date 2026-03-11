import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";

export type ContentType = "cached_response" | "podcast_topic" | "article";

export interface ContentResult {
  contentType: ContentType;
  id: string;
  title: string;
  summary: string;
  score?: number;
  audioFilename?: string;
  link?: string;
  publishedAt?: string;
}

export function mapEpisodeSummary(ep: PodcastEpisode) {
  return {
    id: ep.id,
    title: ep.title,
    showName: ep.showName,
    description: ep.description,
    publishedAt: ep.publishedAt,
    duration: ep.duration,
  };
}

export async function embedQuery(
  cortexClient: { embed: (text: string) => Promise<number[][]> },
  query: string
): Promise<number[] | null> {
  const embeddings = await cortexClient.embed(query);
  return embeddings.length > 0 ? embeddings[0] : null;
}
