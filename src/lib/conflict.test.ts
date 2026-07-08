import { describe, expect, it } from "vitest";
import { isCloudNewer } from "./conflict";

describe("isCloudNewer", () => {
  it("returns false when there is no cloud timestamp", () => {
    expect(isCloudNewer("2026-01-01T00:00:00Z", null)).toBe(false);
    expect(isCloudNewer("2026-01-01T00:00:00Z", undefined)).toBe(false);
  });

  it("returns false when there is no local baseline (first push, nothing to compare against)", () => {
    expect(isCloudNewer(null, "2026-01-01T00:00:00Z")).toBe(false);
    expect(isCloudNewer(undefined, "2026-01-01T00:00:00Z")).toBe(false);
  });

  it("returns false when cloud timestamp matches the last known baseline", () => {
    expect(isCloudNewer("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(false);
  });

  it("returns true when the cloud timestamp is newer than the last known baseline", () => {
    expect(isCloudNewer("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true);
  });

  it("returns false when the cloud timestamp is older than the last known baseline", () => {
    expect(isCloudNewer("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(false);
  });
});
