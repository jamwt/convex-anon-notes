import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  notes: defineTable({
    note: v.string(),
    owner: v.id("users"),
  }).index("by_owner", ["owner"]),
  users: defineTable({
    kind: v.union(v.literal("anon"), v.literal("auth")),
    identifier: v.string(),
  }).index("by_kind_identifier", ["kind", "identifier"]),
});
