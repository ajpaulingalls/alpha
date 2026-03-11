import { voice } from "@livekit/agents";
import type { AlphaSessionData } from "../types";

export class CatchUpAgent extends voice.Agent<AlphaSessionData> {
  async onEnter() {
    this.session.generateReply({
      instructions:
        "Let the user know that the catch-up feature is coming soon. " +
        "Tell them you're excited to bring them their personalized news briefing, " +
        "and that this feature will be available shortly.",
    });
  }

  static create() {
    return new CatchUpAgent({
      instructions:
        "You are Alpha, an AI-powered podcast assistant. " +
        "The catch-up feature is coming soon. " +
        "Be friendly and let users know this feature will be available shortly.",
    });
  }
}
