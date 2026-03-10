import type {
  Article,
  SearchResult,
  PodcastSeries,
  PodcastEpisode,
  ContentClientConfig,
  RawPost,
  RawSearchItem,
} from "./types.ts";
import {
  SEARCH_QUERY,
  SINGLE_ARTICLE_QUERY,
  POSTS_QUERY,
  SECTION_POSTS_QUERY,
  PODCAST_SERIES_QUERY,
  EPISODE_QUERY,
} from "./queries.ts";
import { assertOk, DEFAULT_TIMEOUT_MS } from "./http.ts";

const WP_SITE = "aje";
const HEADERS: Record<string, string> = {
  accept: "application/json",
  "wp-site": WP_SITE,
};

export class ContentClient {
  private graphqlUrl: string;
  private timeoutMs: number;

  constructor(config: string | ContentClientConfig) {
    if (typeof config === "string") {
      this.graphqlUrl = config.replace(/\/+$/, "");
    } else {
      this.graphqlUrl = config.graphqlUrl.replace(/\/+$/, "");
    }
    this.timeoutMs =
      (typeof config === "object" ? config.timeoutMs : undefined) ??
      DEFAULT_TIMEOUT_MS;
  }

  private async executeQuery<T>(
    operationName: string,
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const url = `${
      this.graphqlUrl
    }?wp-site=${WP_SITE}&operationName=${encodeURIComponent(
      operationName
    )}&query=${encodeURIComponent(query)}&variables=${encodeURIComponent(
      JSON.stringify(variables)
    )}&extensions=${encodeURIComponent("{}")}`;

    const res = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    await assertOk(res);

    const json = (await res.json()) as {
      data?: T;
      errors?: { message: string }[];
    };

    if (json.errors && json.errors.length > 0) {
      throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }

    if (!json.data) {
      throw new Error(`No data returned for query "${operationName}"`);
    }

    return json.data;
  }

  private mapPost(raw: RawPost): Article {
    return {
      id: raw.id,
      title: raw.title,
      excerpt: raw.excerpt,
      content: raw.content ?? "",
      date: raw.date,
      slug: this.extractSlug(raw.link),
      link: raw.link,
      author: raw.author.length > 0 ? raw.author[0].name : "",
      imageUrl: raw.featuredImage?.sourceUrl ?? "",
      categories: raw.categories.map((c) => c.name),
      tags: raw.tags.map((t) => t.name),
    };
  }

  private extractSlug(link: string): string {
    return link.replace(/\/+$/, "").split("/").at(-1) ?? "";
  }

  // --- Public methods ---

  async searchArticles(
    query: string,
    offset?: number
  ): Promise<SearchResult[]> {
    const variables: Record<string, unknown> = { query };
    if (offset !== undefined) variables.start = offset;

    const data = await this.executeQuery<{
      searchPosts: { items: RawSearchItem[] };
    }>("SearchQuery", SEARCH_QUERY, variables);

    return data.searchPosts.items.map((item) => {
      const images = item.pagemap?.cse_image;
      return {
        title: item.title,
        snippet: item.snippet,
        link: item.link,
        imageUrl: images && images.length > 0 ? images[0].src : "",
        publishedAt: "",
      };
    });
  }

  async getArticle(slug: string): Promise<Article | null> {
    const data = await this.executeQuery<{ article: RawPost | null }>(
      "ArchipelagoSingleArticleQuery",
      SINGLE_ARTICLE_QUERY,
      { name: slug, postType: "post" }
    );
    return data.article ? this.mapPost(data.article) : null;
  }

  async getRecentArticles(limit?: number): Promise<Article[]> {
    const data = await this.executeQuery<{ articles: RawPost[] }>(
      "PostsQuery",
      POSTS_QUERY,
      { postType: "post", quantity: limit ?? 10, offset: 0 }
    );
    return data.articles.map((raw) => this.mapPost(raw));
  }

  async getArticlesByCategory(
    category: string,
    limit?: number
  ): Promise<Article[]> {
    const data = await this.executeQuery<{ articles: RawPost[] }>(
      "SectionPostsQuery",
      SECTION_POSTS_QUERY,
      {
        category,
        categoryType: "defined",
        quantity: limit ?? 10,
        offset: 0,
        postTypes: ["post"],
      }
    );
    return data.articles.map((raw) => this.mapPost(raw));
  }

  async getPodcastSeries(limit?: number): Promise<PodcastSeries[]> {
    const data = await this.executeQuery<{ articles: RawPost[] }>(
      "PodcastSeriesQuery",
      PODCAST_SERIES_QUERY,
      { quantity: limit ?? 50, offset: 0 }
    );
    return data.articles.map((raw) => ({
      id: raw.id,
      title: raw.title,
      description: raw.excerpt,
      imageUrl: raw.featuredImage?.sourceUrl ?? "",
    }));
  }

  async getEpisode(id: string): Promise<PodcastEpisode | null> {
    const data = await this.executeQuery<{ articles: RawPost[] }>(
      "EpisodeQuery",
      EPISODE_QUERY,
      { category: id, quantity: 1, offset: 0 }
    );
    if (data.articles.length === 0) return null;
    const raw = data.articles[0];
    return {
      id: raw.id,
      title: raw.title,
      description: raw.excerpt,
      publishedAt: raw.date,
      audioUrl: raw.audioPlaybackUrl ?? "",
      duration: raw.audioDuration ?? "",
    };
  }
}
