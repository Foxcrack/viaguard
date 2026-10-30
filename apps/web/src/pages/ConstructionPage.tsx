import React from "react";
import { Link } from "react-router-dom";
import { HardHat, ArrowRight } from "lucide-react";

export const ConstructionPage: React.FC = () => {
  return (
    <div className="py-12 max-w-4xl mx-auto text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
        <HardHat className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-white">Construction Progress Module</h1>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        Upload BEFORE and AFTER photos to calculate volumetric diffs, track structural progression, and detect site deterioration.
      </p>
      <Link
        to="/road"
        className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
      >
        <span>Explore Road Damage Module</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};
