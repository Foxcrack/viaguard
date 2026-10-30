import {
  GeoLocation,
  InspectionReport,
  MeasuredSeverity,
  SeverityLevel,
  VisualCondition,
  VisualConditionLevel,
} from "./index.js";
import { calculateSeverity } from "./scoring.js";

/**
 * Deterministic mapping from Measured Severity level (`calculateSeverity`) to target repair urgency.
 * Muse Spark receives this urgency as fixed input and never invents its own timeframe.
 */
export const SEVERITY_URGENCY_MAP: Record<SeverityLevel, string> = {
  low: "within 30 days",
  medium: "within 14 days",
  high: "within 7 days",
  critical: "immediate",
};

/**
 * Explicit explanation displayed whenever Measured Severity (SAM) and Visual Condition (Muse Spark)
 * differ by two or more ordinal levels (e.g., `low` vs `poor`).
 */
export const SIGNAL_MISMATCH_NOTE =
  "Measured severity counts only discrete defects detected by SAM. Diffuse surface deterioration may not be captured.";

/**
 * Static limitations disclosure rendered beneath detected findings in all reports.
 */
export const REPORT_LIMITATIONS_TEXT =
  "Limitations: Detections cover discrete defects; areas are relative to the image frame.";

const MEASURED_SEVERITY_RANK: Record<SeverityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const VISUAL_CONDITION_RANK: Record<VisualConditionLevel, number> = {
  good: 0,
  fair: 1,
  poor: 2,
  critical: 3,
};

const TITLE_SEVERITY_OR_CONDITION_REGEX =
  /\b(good|fair|poor|critical|low|medium|high|severe|moderate|minor|major|severity|condition|distress|damage|hazard|urgent|immediate)\b|\d+\s*\/\s*100/i;

/**
 * Returns the fixed policy urgency string for a given `SeverityLevel`.
 */
export function getUrgencyForSeverity(level: SeverityLevel): string {
  return SEVERITY_URGENCY_MAP[level];
}

/**
 * Normalizes a raw `overall_condition` string into one of `"good" | "fair" | "poor" | "critical"`.
 */
export function normalizeVisualConditionLevel(raw?: string | null): VisualConditionLevel {
  const v = (raw || "").trim().toLowerCase();
  if (v === "good" || v === "fair" || v === "poor" || v === "critical") {
    return v;
  }
  if (
    v.includes("critical") ||
    v.includes("severe") ||
    v.includes("collapse") ||
    v.includes("emergency") ||
    v.includes("hazard")
  ) {
    return "critical";
  }
  if (
    v.includes("poor") ||
    v.includes("bad") ||
    v.includes("degrad") ||
    v.includes("deteriorat") ||
    v.includes("distress")
  ) {
    return "poor";
  }
  if (
    v.includes("good") ||
    v.includes("intact") ||
    v.includes("clean") ||
    v.includes("excellent")
  ) {
    return "good";
  }
  return "fair";
}

/**
 * Extracts or normalizes a clean single-sentence visual condition explanation.
 */
export function toSingleSentenceExplanation(
  rawExplanation?: string | null,
  conditionLevel?: VisualConditionLevel,
  sceneType?: string
): string {
  const cleaned = (rawExplanation || "").replace(/\s+/g, " ").trim();
  if (cleaned.length > 0) {
    // Capture first sentence while avoiding splitting decimal numbers like "2.91%"
    const match = cleaned.match(/^.*?(?<!\d)[.!?](?=\s|$)/);
    if (match && match[0].trim().length > 0) {
      return match[0].trim();
    }
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }

  const level = conditionLevel || "fair";
  const surface = (sceneType || "inspected surface").trim();
  return `Visual assessment rates overall ${surface} condition as ${level}.`;
}

/**
 * Computes the absolute ordinal rank distance (0..3) between Measured Severity and Visual Condition.
 */
export function getSignalLevelDifference(
  measuredLevel: SeverityLevel,
  visualCondition: VisualConditionLevel
): number {
  return Math.abs(
    MEASURED_SEVERITY_RANK[measuredLevel] - VISUAL_CONDITION_RANK[visualCondition]
  );
}

/**
 * Returns `SIGNAL_MISMATCH_NOTE` when Measured Severity and Visual Condition differ by >= 2 levels
 * (e.g., `low` vs `poor` -> `|0 - 2| = 2`), or `null` otherwise.
 */
export function getSignalDiscrepancyNote(
  measuredLevel: SeverityLevel,
  visualCondition: VisualConditionLevel
): string | null {
  return getSignalLevelDifference(measuredLevel, visualCondition) >= 2
    ? SIGNAL_MISMATCH_NOTE
    : null;
}

/**
 * Formats location (address or lat/lng) if available, otherwise ISO calendar date (`YYYY-MM-DD`).
 */
export function formatReportLocationOrDate(options: {
  location?: GeoLocation;
  createdAt?: string;
}): string {
  if (options.location?.address && options.location.address.trim().length > 0) {
    return options.location.address.trim();
  }
  if (options.location) {
    return `${options.location.latitude.toFixed(4)}, ${options.location.longitude.toFixed(4)}`;
  }
  if (options.createdAt) {
    const parsed = new Date(options.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds a strictly neutral report title ("Road inspection report — <location or date>" or
 * "Construction inspection report — <location or date>") with zero severity or condition terms.
 */
export function buildNeutralReportTitle(options: {
  module: "road" | "construction";
  location?: GeoLocation;
  createdAt?: string;
}): string {
  const base =
    options.module === "construction"
      ? "Construction inspection report"
      : "Road inspection report";
  return `${base} — ${formatReportLocationOrDate(options)}`;
}

/**
 * Ensures any report title is neutral and strips/replaces titles that mention severity, condition, or scores.
 */
export function ensureNeutralReportTitle(
  rawTitle: string | undefined,
  fallbackOptions: {
    module: "road" | "construction";
    location?: GeoLocation;
    createdAt?: string;
  }
): string {
  const trimmed = (rawTitle || "").trim();
  if (!trimmed || TITLE_SEVERITY_OR_CONDITION_REGEX.test(trimmed)) {
    return buildNeutralReportTitle(fallbackOptions);
  }
  return trimmed;
}

/**
 * Normalizes an `InspectionReport` so that `measuredSeverity`, `visualCondition`, neutral `title`,
 * deterministic `estimatedUrgency`, `signalDiscrepancyNote`, and `limitations` are always populated
 * consistently across live runs, cached replays, API JSON responses, UI views, and HTML/PDF exports.
 */
export function normalizeInspectionReport(report: InspectionReport): InspectionReport {
  const breakdown =
    report.severityBreakdown ??
    calculateSeverity(report.afterFindings ?? report.findings).breakdown;

  const measuredSeverity: MeasuredSeverity = {
    score: report.severityScore,
    level: report.severityLevel,
    breakdown,
  };

  const visualLevel = normalizeVisualConditionLevel(
    report.visualCondition?.level ?? report.overallCondition
  );
  const visualExplanation = toSingleSentenceExplanation(
    report.visualCondition?.explanation,
    visualLevel,
    report.sceneType
  );
  const visualCondition: VisualCondition = {
    level: visualLevel,
    explanation: visualExplanation,
  };

  const signalDiscrepancyNote = getSignalDiscrepancyNote(
    measuredSeverity.level,
    visualCondition.level
  );

  const neutralTitle = ensureNeutralReportTitle(report.title, {
    module: report.module,
    location: report.location,
    createdAt: report.createdAt,
  });

  const deterministicUrgency = getUrgencyForSeverity(measuredSeverity.level);

  return {
    ...report,
    title: neutralTitle,
    overallCondition: visualLevel,
    severityBreakdown: breakdown,
    measuredSeverity,
    visualCondition,
    signalDiscrepancyNote,
    limitations: REPORT_LIMITATIONS_TEXT,
    estimatedUrgency: deterministicUrgency,
  };
}
