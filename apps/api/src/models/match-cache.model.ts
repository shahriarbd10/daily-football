import { Schema, model } from "mongoose";

const scoreSchema = new Schema(
  {
    home: Number,
    away: Number
  },
  { _id: false }
);

const teamSchema = new Schema(
  {
    id: Number,
    name: String,
    shortName: String,
    crest: String
  },
  { _id: false }
);

const matchCacheSchema = new Schema(
  {
    providerMatchId: { type: String, required: true, index: true, unique: true },
    competitionCode: { type: String, required: true, index: true },
    competitionName: { type: String, required: true },
    areaName: { type: String },
    utcDate: { type: Date, required: true, index: true },
    status: { type: String, required: true, index: true },
    minute: { type: Number },
    venue: { type: String },
    stage: { type: String },
    homeTeam: { type: teamSchema, required: true },
    awayTeam: { type: teamSchema, required: true },
    fullTime: { type: scoreSchema, required: true },
    halfTime: { type: scoreSchema, required: true },
    winner: { type: String },
    lastFetchedAt: { type: Date, required: true, index: true },
    sourceUpdatedAt: { type: Date },
    raw: { type: Schema.Types.Mixed, required: true }
  },
  {
    timestamps: true
  }
);

export const MatchCacheModel = model("MatchCache", matchCacheSchema);
