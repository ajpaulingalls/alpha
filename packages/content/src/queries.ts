export const SEARCH_QUERY = `query SearchQuery($query: String!, $start: Int, $sort: String) {
  searchPosts(query: $query, start: $start, sort: $sort) {
    items {
      title
      snippet
      link
      pagemap {
        cse_image {
          src
        }
      }
    }
  }
}`;

export const SINGLE_ARTICLE_QUERY = `query ArchipelagoSingleArticleQuery($name: String!, $postType: String) {
  article(name: $name, postType: $postType, preview: "") {
    id
    title
    excerpt
    content
    date
    link
    author {
      name
    }
    featuredImage {
      sourceUrl
    }
    categories {
      name
    }
    tags {
      name
    }
  }
}`;

export const POSTS_QUERY = `query PostsQuery($postType: String!, $quantity: Int!, $offset: Int) {
  articles(postType: $postType, quantity: $quantity, offset: $offset) {
    id
    title
    excerpt
    date
    link
    author {
      name
    }
    featuredImage {
      sourceUrl
    }
    categories {
      name
    }
    tags {
      name
    }
  }
}`;

export const SECTION_POSTS_QUERY = `query SectionPostsQuery($category: String!, $categoryType: String!, $quantity: Int!, $offset: Int!, $postTypes: [String]) {
  articles(category: $category, categoryType: $categoryType, quantity: $quantity, offset: $offset, postTypes: $postTypes) {
    id
    title
    excerpt
    date
    link
    author {
      name
    }
    featuredImage {
      sourceUrl
    }
    categories {
      name
    }
    tags {
      name
    }
  }
}`;

export const PODCAST_SERIES_QUERY = `query PodcastSeriesQuery($quantity: Int!, $offset: Int) {
  articles(postType: "podcast", quantity: $quantity, offset: $offset) {
    id
    title
    excerpt
    featuredImage {
      sourceUrl
    }
  }
}`;

export const EPISODE_QUERY = `query EpisodeQuery($category: String!, $quantity: Int!, $offset: Int!) {
  articles(category: $category, categoryType: "series", quantity: $quantity, offset: $offset, postTypes: ["episode"]) {
    id
    title
    excerpt
    date
    audioPlaybackUrl
    audioDuration
  }
}`;
