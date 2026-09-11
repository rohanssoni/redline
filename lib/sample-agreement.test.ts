import { describe, expect, it } from "vitest";
import { sampleFlags, sampleGaps, sampleText } from "./sample-agreement";

describe("landing page demonstration", () => {
  it("quotes every flag's source sentence verbatim from the sample agreement", () => {
    for (const flag of sampleFlags) {
      expect(sampleText).toContain(flag.sourceSentence);
    }
  });

  it("ranks flags as a contiguous sequence starting at 1", () => {
    expect(sampleFlags.map((flag) => flag.rank)).toEqual(sampleFlags.map((_, index) => index + 1));
  });

  it("never gives a gap a source sentence", () => {
    for (const gap of sampleGaps) {
      expect(gap).not.toHaveProperty("sourceSentence");
    }
  });
});
