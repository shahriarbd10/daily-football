import { Schema, model } from "mongoose";

const competitionCacheSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    emblem: { type: String },
    priority: { type: Number, required: true },
    isInternational: { type: Boolean, default: false },
    lastFetchedAt: { type: Date, required: true }
  },
  {
    timestamps: true
  }
);

export const CompetitionCacheModel = model("CompetitionCache", competitionCacheSchema);
