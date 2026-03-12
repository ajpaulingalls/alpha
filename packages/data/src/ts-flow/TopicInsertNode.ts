import {
  ContainerNode,
  type IContainer,
  type IQueryEngine,
  type JSONObject,
  NodeBase,
} from "@ts-flow/core";
import { createTopic, createTopics } from "../crud/topics";
import type { NewPodcastTopic } from "../schema/podcast_topics";

@ContainerNode
export class TopicInsertNode extends NodeBase implements IQueryEngine {
  private readonly outputEventName: string;

  constructor(id: string, container: IContainer, config: JSONObject) {
    super(id, container, config);
    this.outputEventName = config["outputEventName"] as string;
  }

  async execute(
    payload: JSONObject,
    completeCallback: (completeEventName: string, result: JSONObject) => void,
  ): Promise<void> {
    if (Array.isArray(payload)) {
      const topics: NewPodcastTopic[] = payload.map((item) =>
        this.mapToTopic(item),
      );
      await createTopics(topics);
    } else {
      const topic = this.mapToTopic(payload);
      await createTopic(topic);
    }

    completeCallback(this.outputEventName, payload);
  }

  private mapToTopic(item: JSONObject): NewPodcastTopic {
    const title = (item["topic"] ?? item["title"]) as string | undefined;
    const summary = item["summary"] as string | undefined;
    const filename = (item["filename"] ?? item["podcastFilename"]) as
      | string
      | undefined;
    const embedding = item["embedding"];

    if (!title || !summary || !filename) {
      throw new Error(
        `TopicInsertNode: missing required field(s) — title: ${!!title}, summary: ${!!summary}, filename: ${!!filename}`,
      );
    }

    if (!Array.isArray(embedding)) {
      throw new Error(
        `TopicInsertNode: embedding must be a number array, got ${typeof embedding}`,
      );
    }

    return { title, summary, filename, embedding: embedding as number[] };
  }
}
