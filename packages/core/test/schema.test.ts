import { describe, it, expect } from "vitest";
import {
  SceneUnderstandingSchema,
  StructuredReportSchema,
  InspectionReportSchema,
} from "../src/index.js";

describe("Schema Validation", () => {
  it("validates well-formed SceneUnderstanding JSON", () => {
    const valid = {
      scene_type: "asphalt road",
      visible_damage_types: ["pothole", "crack"],
      overall_condition: "poor",
      notes: "Severe surface breakdown along main traffic lane.",
    };
    const parsed = SceneUnderstandingSchema.parse(valid);
    expect(parsed.scene_type).toBe("asphalt road");
    expect(parsed.visible_damage_types).toEqual(["pothole", "crack"]);
  });

  it("throws validation error for invalid SceneUnderstanding JSON", () => {
    const invalid = {
      scene_type: 123, // should be string
      visible_damage_types: "not an array",
    };
    expect(() => SceneUnderstandingSchema.parse(invalid)).toThrow();
  });

  it("validates well-formed StructuredReport JSON", () => {
    const report = {
      title: "Municipal Road Damage Assessment: Main St",
      summary: "Significant asphalt loss identified on eastbound lane.",
      recommendedAction: "Cold patch void immediately and schedule resurfacing.",
      priority: "critical",
      estimatedUrgency: "Within 24 hours",
      keyFindings: [
        {
          concept: "pothole",
          description: "Active road hazard spanning 11% of frame",
          severity: "critical",
        },
      ],
    };
    const parsed = StructuredReportSchema.parse(report);
    expect(parsed.priority).toBe("critical");
    expect(parsed.keyFindings.length).toBe(1);
  });

  it("validates complete InspectionReport entity", () => {
    const entity = {
      id: "report-123",
      module: "road",
      createdAt: new Date().toISOString(),
      imageUrl: "/uploads/road-test.jpg",
      imageWidth: 1200,
      imageHeight: 900,
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        source: "exif",
      },
      sceneType: "residential street",
      overallCondition: "fair",
      severityScore: 42,
      severityLevel: "medium",
      findings: [],
      title: "Routine Road Survey",
      summary: "Minor surface defects noted.",
      recommendedAction: "Routine seal coating.",
      estimatedUrgency: "Within 60 days",
      isCached: false,
    };
    const parsed = InspectionReportSchema.parse(entity);
    expect(parsed.id).toBe("report-123");
    expect(parsed.severityLevel).toBe("medium");
  });
});

