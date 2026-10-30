import { InspectionReport } from "@viaguard/core";

export interface DemoSample {
  id: string;
  fileName: string;
  url: string;
  module: "road" | "construction";
  variant?: "before" | "after";
  label: string;
}

export interface ProgressState {
  step: string;
  percent: number;
}

export const api = {
  async getHealth() {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("API health check failed");
    return res.json();
  },

  async getSamples(): Promise<DemoSample[]> {
    const res = await fetch("/api/demo/samples");
    if (!res.ok) throw new Error("Failed to load demo samples");
    const data = await res.json();
    return data.samples || [];
  },

  async getReports(filters?: {
    module?: string;
    severity?: string;
    limit?: number;
  }): Promise<InspectionReport[]> {
    const params = new URLSearchParams();
    if (filters?.module) params.set("module", filters.module);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.limit) params.set("limit", filters.limit.toString());
    const res = await fetch(`/api/reports?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load inspection reports");
    const data = await res.json();
    return data.reports || [];
  },

  async getReportById(id: string): Promise<InspectionReport> {
    const res = await fetch(`/api/reports/${id}`);
    if (!res.ok) throw new Error("Report not found");
    return res.json();
  },

  async analyzeRoadDamage(
    file: File | Blob,
    location?: { latitude: number; longitude: number; source: "browser" | "manual" },
    onProgress?: (progress: ProgressState) => void,
    demoMode?: boolean,
    privacyBlur: boolean = true
  ): Promise<InspectionReport> {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("privacyBlur", String(privacyBlur));
    if (location) {
      formData.append("latitude", location.latitude.toString());
      formData.append("longitude", location.longitude.toString());
      formData.append("source", location.source);
    }
    if (demoMode === true) {
      formData.append("demoMode", "true");
    }

    // Use async background job with SSE for responsive progress feedback
    const res = await fetch("/api/road/analyze?async=true", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to initiate road analysis");
    }

    const { jobId } = await res.json();

    return new Promise<InspectionReport>((resolve, reject) => {
      const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          onProgress?.({ step: job.step, percent: job.percent });

          if (job.status === "completed" && job.report) {
            eventSource.close();
            resolve(job.report);
          } else if (job.status === "failed") {
            eventSource.close();
            reject(new Error(job.error || "Inspection analysis failed"));
          }
        } catch (e) {
          console.error("Error parsing progress stream:", e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Fallback: poll job endpoint once if SSE disconnected
        fetch(`/api/jobs/${jobId}`)
          .then((r) => r.json())
          .then((job) => {
            if (job.status === "completed" && job.report) {
              resolve(job.report);
            } else {
              reject(new Error(job.error || "Stream connection failed"));
            }
          })
          .catch(() => reject(new Error("Lost connection to analysis server")));
      };
    });
  },

  async analyzeConstructionProgress(
    beforeFile: File | Blob,
    afterFile: File | Blob,
    onProgress?: (progress: ProgressState) => void,
    demoMode?: boolean,
    privacyBlur: boolean = true
  ): Promise<InspectionReport> {
    const formData = new FormData();
    formData.append("before", beforeFile);
    formData.append("after", afterFile);
    formData.append("privacyBlur", String(privacyBlur));
    if (demoMode === true) {
      formData.append("demoMode", "true");
    }

    const res = await fetch("/api/construction/analyze?async=true", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to initiate construction analysis");
    }

    const { jobId } = await res.json();

    return new Promise<InspectionReport>((resolve, reject) => {
      const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          onProgress?.({ step: job.step, percent: job.percent });

          if (job.status === "completed" && job.report) {
            eventSource.close();
            resolve(job.report);
          } else if (job.status === "failed") {
            eventSource.close();
            reject(new Error(job.error || "Comparative analysis failed"));
          }
        } catch (e) {
          console.error("Error parsing progress stream:", e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        fetch(`/api/jobs/${jobId}`)
          .then((r) => r.json())
          .then((job) => {
            if (job.status === "completed" && job.report) {
              resolve(job.report);
            } else {
              reject(new Error(job.error || "Stream connection failed"));
            }
          })
          .catch(() => reject(new Error("Lost connection to analysis server")));
      };
    });
  },
};
