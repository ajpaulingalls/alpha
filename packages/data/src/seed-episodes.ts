/**
 * Seed script: creates podcast_episodes from existing podcast_topics,
 * links topics to episodes, copies audio files to the server's audio/topics/
 * directory, and updates filenames to unique basenames.
 *
 * Usage: cd packages/data && bun run src/seed-episodes.ts
 */
import { sql } from "drizzle-orm";
import { db, client } from "./client";
import { podcastEpisodes } from "./schema/podcast_episodes";
import { podcastTopics } from "./schema/podcast_topics";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../../..");
const IMPORTER_PODS = path.join(ROOT, "apps/importer/public/pods");
const GENERATOR_CACHE = path.join(ROOT, "apps/generator/pods/cache");
const SERVER_AUDIO = path.join(ROOT, "apps/server/audio/topics");

async function main() {
  // Ensure target directory exists
  fs.mkdirSync(SERVER_AUDIO, { recursive: true });

  // 1. Group topics by source and episode directory
  const importerTopics = await db
    .select()
    .from(podcastTopics)
    .where(sql`${podcastTopics.filename} LIKE 'public/pods/%'`);

  const generatorTopics = await db
    .select()
    .from(podcastTopics)
    .where(sql`${podcastTopics.filename} LIKE './pods/cache/%'`);

  console.log(
    `Found ${importerTopics.length} importer topics, ${generatorTopics.length} generator topics`,
  );

  // 2. Process importer topics — group by episode directory
  const importerGroups = new Map<
    string,
    { topics: typeof importerTopics; firstTitle: string; earliest: Date }
  >();

  for (const topic of importerTopics) {
    const match = topic.filename.match(/public\/pods\/([^/]+)\//);
    if (!match) {
      console.warn(
        `Skipping topic with unexpected filename: ${topic.filename}`,
      );
      continue;
    }
    const episodeDir = match[1];
    const group = importerGroups.get(episodeDir);
    if (group) {
      group.topics.push(topic);
      if (topic.createdAt < group.earliest) {
        group.earliest = topic.createdAt;
      }
    } else {
      importerGroups.set(episodeDir, {
        topics: [topic],
        firstTitle: topic.title,
        earliest: topic.createdAt,
      });
    }
  }

  console.log(`Creating ${importerGroups.size} importer episodes...`);

  let copiedFiles = 0;
  let skippedFiles = 0;

  for (const [episodeDir, group] of importerGroups) {
    // Create episode
    const episodeTitle =
      group.topics.length > 1
        ? group.firstTitle.replace(/^Introduction.*$/, group.topics[1].title)
        : group.firstTitle;

    const [episode] = await db
      .insert(podcastEpisodes)
      .values({
        showName: "Al Jazeera",
        title: episodeTitle,
        publishedAt: group.earliest,
      })
      .returning();

    // Sort topics by clip number for ordering
    const sorted = group.topics.sort((a, b) => {
      const numA = parseInt(a.filename.match(/clip_(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.filename.match(/clip_(\d+)/)?.[1] ?? "0");
      return numA - numB;
    });

    // Update each topic: set episode_id, start_time, filename; copy audio
    for (let i = 0; i < sorted.length; i++) {
      const topic = sorted[i];
      const clipBasename = path.basename(topic.filename);
      const newFilename = `${episodeDir}_${clipBasename}`;
      const srcPath = path.join(IMPORTER_PODS, episodeDir, clipBasename);
      const dstPath = path.join(SERVER_AUDIO, newFilename);

      // Copy audio file
      if (fs.existsSync(srcPath)) {
        if (!fs.existsSync(dstPath)) {
          fs.copyFileSync(srcPath, dstPath);
          copiedFiles++;
        } else {
          skippedFiles++;
        }
      } else {
        console.warn(`Missing audio: ${srcPath}`);
      }

      // Update topic
      await db
        .update(podcastTopics)
        .set({
          episodeId: episode.id,
          startTime: i,
          filename: newFilename,
        })
        .where(sql`${podcastTopics.id} = ${topic.id}`);
    }
  }

  // 3. Process generator topics — group into one "generated" episode per date batch
  if (generatorTopics.length > 0) {
    // Group by creation date
    const dateGroups = new Map<string, typeof generatorTopics>();

    for (const topic of generatorTopics) {
      const dateKey = topic.createdAt.toISOString().slice(0, 10);
      const group = dateGroups.get(dateKey);
      if (group) {
        group.push(topic);
      } else {
        dateGroups.set(dateKey, [topic]);
      }
    }

    console.log(
      `Creating ${dateGroups.size} generated episodes (${generatorTopics.length} topics)...`,
    );

    for (const [dateKey, topics] of dateGroups) {
      const [episode] = await db
        .insert(podcastEpisodes)
        .values({
          showName: "Under the Headlines",
          title: `Daily Briefing — ${dateKey}`,
          publishedAt: topics[0].createdAt,
        })
        .returning();

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        // Extract slug from ./pods/cache/{slug}/segment.pcm
        const slugMatch = topic.filename.match(
          /\.\/pods\/cache\/([^/]+)\/segment\.pcm/,
        );
        if (!slugMatch) {
          console.warn(
            `Skipping generator topic with unexpected filename: ${topic.filename}`,
          );
          continue;
        }
        const slug = slugMatch[1];
        const newFilename = `gen_${slug}.pcm`;
        const srcPath = path.join(GENERATOR_CACHE, slug, "segment.pcm");
        const dstPath = path.join(SERVER_AUDIO, newFilename);

        // Copy audio file
        if (fs.existsSync(srcPath)) {
          if (!fs.existsSync(dstPath)) {
            fs.copyFileSync(srcPath, dstPath);
            copiedFiles++;
          } else {
            skippedFiles++;
          }
        } else {
          console.warn(`Missing audio: ${srcPath}`);
        }

        await db
          .update(podcastTopics)
          .set({
            episodeId: episode.id,
            startTime: i,
            filename: newFilename,
          })
          .where(sql`${podcastTopics.id} = ${topic.id}`);
      }
    }
  }

  // 4. Verify
  const episodeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(podcastEpisodes);
  const linkedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(podcastTopics)
    .where(sql`${podcastTopics.episodeId} IS NOT NULL`);
  const unlinkedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(podcastTopics)
    .where(sql`${podcastTopics.episodeId} IS NULL`);

  console.log(`\nDone!`);
  console.log(`  Episodes created: ${episodeCount[0].count}`);
  console.log(`  Topics linked: ${linkedCount[0].count}`);
  console.log(`  Topics unlinked: ${unlinkedCount[0].count}`);
  console.log(`  Audio files copied: ${copiedFiles}`);
  console.log(`  Audio files skipped (already exist): ${skippedFiles}`);

  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
