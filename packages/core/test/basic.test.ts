import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index.js";

describe("core package", () => {
  it("exports package version", () => {
    expect(VERSION).toBe("0.1.0");
  });
});

