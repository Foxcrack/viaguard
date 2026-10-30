import * as fs from "fs";
import * as path from "path";
import { InspectionReport } from "@viaguard/core";

const DATA_DIR = path.resolve(process.cwd(), "data");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAllReports(): InspectionReport[] {
  ensureDataDir();
  if (!fs.existsSync(REPORTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(REPORTS_FILE, "utf-8");
    return JSON.parse(raw) as InspectionReport[];
  } catch (err) {
    console.error("[Storage Error] Failed reading reports file:", err);
    return [];
  }
}

function saveAllReports(reports: InspectionReport[]): void {
  ensureDataDir();
  // Atomic write via temp file
  const tmpFile = `${REPORTS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(reports, null, 2), "utf-8");
  fs.renameSync(tmpFile, REPORTS_FILE);
}

export const storage = {
  async save(report: InspectionReport): Promise<void> {
    const reports = loadAllReports();
    const index = reports.findIndex((r) => r.id === report.id);
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.unshift(report);
    }
    saveAllReports(reports);
  },

  async getById(id: string): Promise<InspectionReport | null> {
    const reports = loadAllReports();
    return reports.find((r) => r.id === id) || null;
  },

  async list(filters?: {
    module?: string;
    severity?: string;
    limit?: number;
  }): Promise<InspectionReport[]> {
    let reports = loadAllReports();

    if (filters?.module) {
      reports = reports.filter((r) => r.module === filters.module);
    }
    if (filters?.severity) {
      reports = reports.filter((r) => r.severityLevel === filters.severity);
    }
    if (filters?.limit && filters.limit > 0) {
      reports = reports.slice(0, filters.limit);
    }

    return reports;
  },

  async delete(id: string): Promise<boolean> {
    const reports = loadAllReports();
    const filtered = reports.filter((r) => r.id !== id);
    if (filtered.length !== reports.length) {
      saveAllReports(filtered);
      return true;
    }
    return false;
  },
};
