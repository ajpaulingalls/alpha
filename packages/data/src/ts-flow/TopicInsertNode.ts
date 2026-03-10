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
    completeCallback: (completeEventName: string, result: JSONObject) => void
  ): Promise<void> {
    if (Array.isArray(payload)) {
      const topics: NewPodcastTopic[] = payload.map((item) =>
        this.mapToTopic(item)
      );
      await createTopics(topics);
    } else {
      const topic = this.mapToTopic(payload);
      await createTopic(topic);
    }

    completeCallback(this.outputEventName, payload);
  }

  private mapToTopic(item: JSONObject): NewPodcastTopic {
    return {
      title: (item["topic"] as string) ?? (item["title"] as string),
      summary: item["summary"] as string,
      filename:
        (item["filename"] as string) ?? (item["podcastFilename"] as string),
      embedding: item["embedding"] as number[],
    };
  }
}
