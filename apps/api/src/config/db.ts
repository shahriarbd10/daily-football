import dns from "node:dns";
import mongoose from "mongoose";

import { env } from "./env.js";

let databaseReady = false;
const publicDnsResolvers = ["8.8.8.8", "1.1.1.1"];

export const connectDatabase = async () => {
  try {
    if (env.mongoUri.startsWith("mongodb+srv://")) {
      dns.setServers(publicDnsResolvers);
    }

    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
      serverSelectionTimeoutMS: 5000
    });
    databaseReady = true;
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (error) {
    databaseReady = false;
    console.error("MongoDB unavailable, continuing with in-memory cache", error);
  }
};

export const isDatabaseReady = () => databaseReady && mongoose.connection.readyState === 1;
