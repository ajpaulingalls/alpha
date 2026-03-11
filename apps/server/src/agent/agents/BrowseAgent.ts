import { voice } from "@livekit/agents";
import type { AlphaSessionData } from "../types";

export class BrowseAgent extends voice.Agent<AlphaSessionData> {
  async onEnter() {
    this.session.generateReply({
      instructions:
        "Welcome the user to browse mode. Let them know they can ask about any topic, " +
        "search for podcasts, or explore the latest news. " +
        "Keep your tone friendly and conversational.",
    });
  }

  static create() {
    return new BrowseAgent({
      instructions:
        "You are Alpha, an AI-powered podcast assistant in browse mode. " +
        "Help the user explore content — they can ask about topics, search for podcasts, " +
        "or dive deeper into stories. Be conversational and helpful.",
    });
  }
}
