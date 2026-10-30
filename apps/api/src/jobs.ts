import { InspectionReport } from "@viaguard/core";

export interface PipelineJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  step: string;
  percent: number;
  report?: InspectionReport;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, PipelineJob>();

export const jobManager = {
  createJob(id: string): PipelineJob {
    const job: PipelineJob = {
      id,
      status: "pending",
      step: "Initializing pipeline...",
      percent: 5,
      createdAt: Date.now(),
    };
    jobs.set(id, job);

    // Auto-cleanup jobs older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    for (const [jid, j] of jobs.entries()) {
      if (j.createdAt < oneHourAgo) {
        jobs.delete(jid);
      }
    }

    return job;
  },

  updateJob(
    id: string,
    updates: Partial<Pick<PipelineJob, "status" | "step" | "percent" | "report" | "error">>
  ): PipelineJob | undefined {
    const job = jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, updates);
    return job;
  },

  getJob(id: string): PipelineJob | undefined {
    return jobs.get(id);
  },
};
