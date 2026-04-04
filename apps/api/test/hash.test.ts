import { describe, expect, it } from "bun:test";
import { sha256Hex } from "../src/util/hash.ts";

describe("sha256Hex", () => {
  it("is stable for same input", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("differs for different input", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});
