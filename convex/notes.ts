import { v } from "convex/values";
import { userMutation, userQuery } from "./util";

export const createNote = userMutation({
  args: {
    note: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notes", {
      owner: ctx.userId,
      note: args.note,
    });
  },
});

export const getNotes = userQuery({
  args: {},
  handler: async (ctx) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_owner", (q) => q.eq("owner", ctx.userId))
      .collect();
    return notes;
  },
});
