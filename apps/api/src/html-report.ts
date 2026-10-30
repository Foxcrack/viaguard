import { InspectionReport } from "@viaguard/core";

export function generateHtmlReport(report: InspectionReport): string {
  const severityColors = {
    low: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
    medium: { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
    high: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
    critical: { bg: "#450a0a", text: "#fecaca", border: "#dc2626" },
  };

  const currentSev = severityColors[report.severityLevel] || severityColors.low;

  const findingsRows = report.findings
    .map(
      (f, i) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">#${i + 1} ${f.concept}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${(f.confidence * 100).toFixed(0)}%</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${f.relativeAreaPercent}%</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; color: #64748b;">
          [${f.boundingBox.x1}, ${f.boundingBox.y1}] to [${f.boundingBox.x2}, ${f.boundingBox.y2}]
        </td>
      </tr>
    `
    )
    .join("");

  const diffSection = report.constructionDiff
    ? `
    <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1e293b;">Comparative Progress Analysis</h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569;">${report.constructionDiff.overallAssessment}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; color: #475569;">
            <th style="padding: 6px 10px;">Target Element</th>
            <th style="padding: 6px 10px; text-align: center;">Before Count</th>
            <th style="padding: 6px 10px; text-align: center;">After Count</th>
            <th style="padding: 6px 10px; text-align: center;">Delta Count</th>
            <th style="padding: 6px 10px; text-align: center;">Delta Area (%)</th>
            <th style="padding: 6px 10px; text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${report.constructionDiff.conceptChanges
            .map(
              (c) => `
            <tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${c.concept}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.beforeCount}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.afterCount}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${
                c.deltaCount > 0 ? "#059669" : c.deltaCount < 0 ? "#dc2626" : "#64748b"
              }">${c.deltaCount >= 0 ? "+" : ""}${c.deltaCount}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${
                c.deltaAreaPercent >= 0 ? "+" : ""
              }${c.deltaAreaPercent}%</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; text-transform: uppercase; font-size: 10px; font-weight: 600;">${
                c.status
              }</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title} - Official Inspection Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 32px;
      line-height: 1.5;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .actions-bar {
      margin-bottom: 24px;
      display: flex;
      gap: 12px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
    }
    .btn:hover { background: #f1f5f9; }
    @media print {
      body { padding: 0; }
      .actions-bar { display: none; }
      .container { max-width: 100%; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="actions-bar">
      <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <a class="btn" href="?format=json" target="_blank">📄 View Raw JSON</a>
    </div>

    <div class="header">
      <div>
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 4px;">
          Municipal Civic Works Inspection Division
        </div>
        <h1 style="margin: 0; font-size: 24px; color: #0f172a;">${report.title}</h1>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          Report ID: <strong>${report.id}</strong> | Timestamp: ${new Date(report.createdAt).toLocaleString()}
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge" style="background: ${currentSev.bg}; color: ${currentSev.text}; border: 1px solid ${currentSev.border};">
          ${report.severityLevel.toUpperCase()} SEVERITY (${report.severityScore}/100)
        </span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0;">Executive Summary</h3>
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">${report.summary}</p>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0;">Recommended Public Works Action</h3>
        <p style="margin: 0; font-size: 15px; color: #1e293b; font-weight: 500;">${report.recommendedAction}</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Estimated Urgency</div>
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 12px;">${report.estimatedUrgency}</div>

        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Classification</div>
        <div style="font-weight: 600; color: #0f172a; margin-bottom: 12px;">${report.sceneType} (${report.overallCondition})</div>

        ${
          report.location
            ? `
          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Geolocation (${report.location.source.toUpperCase()})</div>
          <div style="font-family: monospace; font-size: 12px; color: #0f172a;">${report.location.latitude.toFixed(5)}, ${report.location.longitude.toFixed(5)}</div>
        `
            : ""
        }
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; margin: 0 0 12px 0;">Measured Findings Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; color: #475569;">
            <th style="padding: 10px 12px;">Identified Concept</th>
            <th style="padding: 10px 12px; text-align: center;">Model Confidence</th>
            <th style="padding: 10px 12px; text-align: center;">Relative Image Area</th>
            <th style="padding: 10px 12px;">Bounding Coordinates</th>
          </tr>
        </thead>
        <tbody>
          ${findingsRows || "<tr><td colspan='4' style='padding: 16px; text-align: center; color: #64748b;'>No significant structural damage detected in the frame.</td></tr>"}
        </tbody>
      </table>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
        * Note: Relative areas represent percentage coverage of the digital camera sensor frame, not certified geographic square meters.
      </div>
    </div>

    ${diffSection}

    <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8;">
      <div>Viaguard Infrastructure Inspection Platform &bull; Meta Global AI Hackathon 2026</div>
      <div>Vision: muse-spark-1.3 &bull; Segmentation: sam-3.1</div>
    </div>
  </div>
</body>
</html>`;
}
