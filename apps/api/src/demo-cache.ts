import { InspectionReport } from "@viaguard/core";

export const DEMO_PRECACHED_REPORTS: Record<string, Partial<InspectionReport>> = {
  "road-sample-pothole": {
    module: "road",
    sceneType: "municipal asphalt road",
    overallCondition: "poor",
    severityScore: 78,
    severityLevel: "high",
    title: "Municipal Road Damage Assessment: Main Transit Corridor",
    summary:
      "Critical asphalt void detected along active traffic lane spanning 6.8% of camera sensor frame. Subgrade exposure poses immediate tire hazard and water infiltration risk.",
    recommendedAction:
      "Deploy municipal maintenance crew for immediate cold patch void filling and subbase compaction.",
    estimatedUrgency: "Within 48 hours",
    findings: [
      {
        id: "finding-pothole-demo-1",
        concept: "pothole",
        confidence: 0.94,
        relativeAreaPercent: 6.8,
        boundingBox: { x1: 290, y1: 305, x2: 550, y2: 455, width: 260, height: 150 },
        svgPath: "M 320 380 Q 420 310 520 380 Q 420 450 320 380 Z",
        maskBounds: { left: 290, top: 305, right: 550, bottom: 455 },
        activePixels: 32600,
      },
    ],
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      source: "exif",
    },
    isCached: true,
  },

  "road-sample-cracks": {
    module: "road",
    sceneType: "residential street asphalt",
    overallCondition: "fair",
    severityScore: 36,
    severityLevel: "medium",
    title: "Routine Surface Survey: Interconnected Longitudinal Cracking",
    summary:
      "Alligator and longitudinal crack patterns identified covering 3.4% of frame area. Adjacent cast iron manhole cover serves as neutral reference point.",
    recommendedAction:
      "Apply high-elasticity rubberized asphalt crack sealant prior to winter freeze-thaw cycles.",
    estimatedUrgency: "Within 30 days",
    findings: [
      {
        id: "finding-crack-demo-1",
        concept: "crack",
        confidence: 0.89,
        relativeAreaPercent: 3.4,
        boundingBox: { x1: 200, y1: 150, x2: 590, y2: 430, width: 390, height: 280 },
        svgPath: "M 200 150 L 260 220 L 340 210 L 380 290 L 450 310 L 550 430",
        maskBounds: { left: 200, top: 150, right: 590, bottom: 430 },
        activePixels: 16300,
      },
      {
        id: "finding-manhole-demo-1",
        concept: "manhole cover",
        confidence: 0.96,
        relativeAreaPercent: 2.1,
        boundingBox: { x1: 630, y1: 150, x2: 730, y2: 250, width: 100, height: 100 },
        svgPath: "M 680 150 A 50 50 0 1 0 680 250 A 50 50 0 1 0 680 150",
        maskBounds: { left: 630, top: 150, right: 730, bottom: 250 },
        activePixels: 9800,
      },
    ],
    location: {
      latitude: 37.7833,
      longitude: -122.4167,
      source: "browser",
    },
    isCached: true,
  },

  "construction-pair": {
    module: "construction",
    sceneType: "commercial structural site",
    overallCondition: "active framing and foundation",
    severityScore: 22,
    severityLevel: "low",
    title: "Comparative Job Site Progression Audit: Foundation & Scaffolding",
    summary:
      "Substantial structural progression confirmed between baseline excavation and current state (+65 progress score). Permanent concrete walls poured and 4-tier steel scaffolding framework erected.",
    recommendedAction:
      "Approve Phase II rebar inspection and schedule safety netting installation.",
    estimatedUrgency: "Next scheduled milestone (14 days)",
    findings: [
      {
        id: "const-debris-before",
        concept: "debris",
        confidence: 0.88,
        relativeAreaPercent: 3.5,
        boundingBox: { x1: 220, y1: 320, x2: 540, y2: 450, width: 320, height: 130 },
        activePixels: 16800,
      },
    ],
    afterFindings: [
      {
        id: "const-wall-after",
        concept: "concrete wall",
        confidence: 0.95,
        relativeAreaPercent: 20.0,
        boundingBox: { x1: 150, y1: 200, x2: 650, y2: 440, width: 500, height: 240 },
        activePixels: 96000,
      },
      {
        id: "const-scaffold-after",
        concept: "scaffolding",
        confidence: 0.92,
        relativeAreaPercent: 12.0,
        boundingBox: { x1: 160, y1: 100, x2: 560, y2: 450, width: 400, height: 350 },
        activePixels: 57600,
      },
    ],
    constructionDiff: {
      conceptChanges: [
        {
          concept: "concrete wall",
          beforeCount: 0,
          afterCount: 1,
          deltaCount: 1,
          beforeAreaPercent: 0,
          afterAreaPercent: 20.0,
          deltaAreaPercent: 20.0,
          status: "progress",
        },
        {
          concept: "scaffolding",
          beforeCount: 0,
          afterCount: 1,
          deltaCount: 1,
          beforeAreaPercent: 0,
          afterAreaPercent: 12.0,
          deltaAreaPercent: 12.0,
          status: "progress",
        },
        {
          concept: "debris",
          beforeCount: 1,
          afterCount: 0,
          deltaCount: -1,
          beforeAreaPercent: 3.5,
          afterAreaPercent: 0,
          deltaAreaPercent: -3.5,
          status: "progress",
        },
      ],
      overallAssessment:
        "Observable structural progression measured across 3 target elements with successful ground clearance.",
      progressScore: 65,
    },
    isCached: true,
  },
};
