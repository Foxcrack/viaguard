import { describe, it, expect } from "vitest";
import {
  SEVERITY_URGENCY_MAP,
  SIGNAL_MISMATCH_NOTE,
  REPORT_LIMITATIONS_TEXT,
  getUrgencyForSeverity,
  getSignalDiscrepancyNote,
  buildNeutralReportTitle,
  ensureNeutralReportTitle,
  toSingleSentenceExplanation,
  normalizeInspectionReport,
  InspectionReport,
} from "../src/index.js";

describe("Report Signals Separation, Neutral Titles & Deterministic Urgency", () => {
  it("maps severity levels deterministically to fixed urgency windows", () => {
    expect(getUrgencyForSeverity("low")).toBe("within 30 days");
    expect(getUrgencyForSeverity("medium")).toBe("within 14 days");
    expect(getUrgencyForSeverity("high")).toBe("within 7 days");
    expect(getUrgencyForSeverity("critical")).toBe("immediate");

    expect(SEVERITY_URGENCY_MAP).toEqual({
      low: "within 30 days",
      medium: "within 14 days",
      high: "within 7 days",
      critical: "immediate",
    });
  });

  it("emits SIGNAL_MISMATCH_NOTE iff measured severity and visual condition differ by >= 2 levels", () => {
    // 2+ levels apart -> note required
    expect(getSignalDiscrepancyNote("low", "poor")).toBe(SIGNAL_MISMATCH_NOTE);
    expect(getSignalDiscrepancyNote("low", "critical")).toBe(SIGNAL_MISMATCH_NOTE);
    expect(getSignalDiscrepancyNote("medium", "critical")).toBe(SIGNAL_MISMATCH_NOTE);
    expect(getSignalDiscrepancyNote("high", "good")).toBe(SIGNAL_MISMATCH_NOTE);
    expect(getSignalDiscrepancyNote("critical", "fair")).toBe(SIGNAL_MISMATCH_NOTE);

    // 0 or 1 level apart -> null
    expect(getSignalDiscrepancyNote("low", "good")).toBeNull();
    expect(getSignalDiscrepancyNote("low", "fair")).toBeNull();
    expect(getSignalDiscrepancyNote("medium", "poor")).toBeNull();
    expect(getSignalDiscrepancyNote("high", "poor")).toBeNull();
    expect(getSignalDiscrepancyNote("critical", "critical")).toBeNull();
  });

  it("builds neutral report titles with location or date and strips severity/condition words", () => {
    const withDate = buildNeutralReportTitle({
      module: "road",
      createdAt: "2026-10-30T06:52:23.714Z",
    });
    expect(withDate).toBe("Road inspection report — 2026-10-30");

    const withCoords = buildNeutralReportTitle({
      module: "road",
      location: { latitude: 37.7749, longitude: -122.4194, source: "exif" },
      createdAt: "2026-10-30T06:52:23.714Z",
    });
    expect(withCoords).toBe("Road inspection report — 37.7749, -122.4194");

    // Replaces generated title containing condition or score
    expect(
      ensureNeutralReportTitle(
        "Municipal Infrastructure Inspection - Intersection in Poor Condition",
        { module: "road", createdAt: "2026-10-30T06:52:23.714Z" }
      )
    ).toBe("Road inspection report — 2026-10-30");

    expect(
      ensureNeutralReportTitle("Road Survey (24/100 Low Severity)", {
        module: "road",
        createdAt: "2026-10-30T06:52:23.714Z",
      })
    ).toBe("Road inspection report — 2026-10-30");
  });

  it("extracts a single sentence for visualCondition.explanation without splitting decimals", () => {
    const raw =
      "Widespread raveling and loose aggregate cover approximately 2.91% of the lane edge. Additional wear is visible near trees.";
    expect(toSingleSentenceExplanation(raw, "poor", "asphalt road")).toBe(
      "Widespread raveling and loose aggregate cover approximately 2.91% of the lane edge."
    );
  });

  it("normalizes an InspectionReport with separated signals, neutral title, fixed urgency, mismatch note, and limitations", () => {
    const legacy: InspectionReport = {
      id: "rep-road-legacy",
      module: "road",
      createdAt: "2026-10-30T06:52:23.714Z",
      imageUrl: "/uploads/test.jpg",
      imageWidth: 399,
      imageHeight: 501,
      sceneType: "asphalt road",
      overallCondition: "poor",
      severityScore: 24,
      severityLevel: "low",
      findings: [],
      title: "Municipal Infrastructure Inspection - Asphalt Road Pothole Distress",
      summary: "Six small potholes detected.",
      recommendedAction: "Schedule patching.",
      estimatedUrgency: "High, 7-14 days",
      isCached: false,
      privacyBlurApplied: true,
      privacyRegionsBlurred: 0,
    };

    const normalized = normalizeInspectionReport(legacy);
    expect(normalized.title).toBe("Road inspection report — 2026-10-30");
    expect(normalized.estimatedUrgency).toBe("within 30 days");
    expect(normalized.measuredSeverity?.score).toBe(24);
    expect(normalized.measuredSeverity?.level).toBe("low");
    expect(normalized.visualCondition?.level).toBe("poor");
    expect(normalized.visualCondition?.explanation.length).toBeGreaterThan(10);
    expect(normalized.signalDiscrepancyNote).toBe(SIGNAL_MISMATCH_NOTE);
    expect(normalized.limitations).toBe(REPORT_LIMITATIONS_TEXT);
  });
});
