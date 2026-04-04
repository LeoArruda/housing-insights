import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const looseText = z.union([z.string(), z.record(z.string(), z.unknown())]);

const rssItemSchema = z.object({
  title: looseText.optional(),
  link: looseText.optional(),
  pubDate: looseText.optional(),
});

const rssChannelSchema = z.object({
  title: looseText.optional(),
  item: z.union([rssItemSchema, z.array(rssItemSchema)]).optional(),
});

const rssRootSchema = z.object({
  rss: z
    .object({
      channel: rssChannelSchema.optional(),
    })
    .optional(),
  feed: z
    .object({
      title: looseText.optional(),
      entry: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .optional(),
});

export type ParsedRssSummary = {
  format: "rss" | "atom";
  itemCount: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export function parseRssXml(xml: string): ParsedRssSummary {
  const doc = parser.parse(xml);
  const parsed = rssRootSchema.safeParse(doc);
  if (!parsed.success) {
    throw new Error(`Invalid RSS/Atom structure: ${parsed.error.message}`);
  }
  const d = parsed.data;
  if (d.rss?.channel) {
    const items = d.rss.channel.item;
    const count = Array.isArray(items)
      ? items.length
      : items
        ? 1
        : 0;
    return { format: "rss", itemCount: count };
  }
  if (d.feed?.entry) {
    return { format: "atom", itemCount: d.feed.entry.length };
  }
  throw new Error("Unrecognized feed root (expected rss or atom)");
}
