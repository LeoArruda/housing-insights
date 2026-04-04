import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRssXml } from "../src/connectors/rss-common.ts";

const dir = join(import.meta.dir, "fixtures");

describe("parseRssXml", () => {
  it("parses RSS 2.0 sample", () => {
    const xml = readFileSync(join(dir, "sample-rss.xml"), "utf-8");
    const r = parseRssXml(xml);
    expect(r.format).toBe("rss");
    expect(r.itemCount).toBe(2);
  });

  it("parses Atom sample", () => {
    const xml = readFileSync(join(dir, "sample-atom.xml"), "utf-8");
    const r = parseRssXml(xml);
    expect(r.format).toBe("atom");
    expect(r.itemCount).toBe(2);
  });
});
