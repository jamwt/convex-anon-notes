import { v } from "convex/values";
import {
  query as baseQuery,
  mutation as baseMutation,
  internalMutation,
  MutationCtx,
  QueryCtx,
  action,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { SessionIdArg, vSessionId } from "convex-helpers/server/sessions";
import { Doc, Id } from "./_generated/dataModel";

// Called by the client when captcha is passed to
// allow an anonymous user to exist.
export const loginAnonWithCaptcha = action({
  args: {
    captchaResponse: v.string(),
    sessionId: vSessionId,
  },
  handler: async (ctx, args) => {
    console.log("validateCaptcha", args.captchaResponse, args.sessionId);
    if (
      await ctx.runQuery(internal.util.anonUserExists, {
        sessionId: args.sessionId,
      })
    ) {
      console.log("Already verified this session.");
      return;
    }
    const response = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${process.env.HCAPTCHA_SECRET}&response=${args.captchaResponse}`,
    });
    const data = await response.json();
    if (data.success) {
      await ctx.runMutation(internal.util.createAnonUser, {
        sessionId: args.sessionId,
      });
    } else {
      // Naughty user!
      throw new Error("Captcha verification failed");
    }
  },
});

export const anonUserExists = internalQuery({
  args: {
    sessionId: vSessionId,
  },
  handler: async (ctx, args) => {
    const anonUser = await ctx.db
      .query("users")
      .withIndex("by_kind_identifier", (q) =>
        q.eq("kind", "anon").eq("identifier", args.sessionId),
      )
      .unique();
    return anonUser !== null;
  },
});

export const createAnonUser = internalMutation({
  args: {
    sessionId: vSessionId,
  },
  handler: async (ctx, args) => {
    const existingSession = await ctx.db
      .query("users")
      .withIndex("by_kind_identifier", (q) =>
        q.eq("kind", "anon").eq("identifier", args.sessionId),
      )
      .unique();

    if (existingSession) {
      console.log("Already created an anon user for this session.");
      return;
    }

    await ctx.db.insert("users", {
      kind: "anon",
      identifier: args.sessionId,
    });
  },
});

// Called by the client when the user logs in with Google.
// We'll reparent any notes from the anon user to the authenticated user.
export const upgradeAnonUser = baseMutation({
  args: {
    sessionId: vSessionId,
  },
  handler: async (ctx, args) => {
    const authInfo = await ctx.auth.getUserIdentity();
    if (!authInfo) {
      throw new Error("Not authenticated.");
    }
    const anonUser = await ctx.db
      .query("users")
      .withIndex("by_kind_identifier", (q) =>
        q.eq("kind", "anon").eq("identifier", args.sessionId),
      )
      .unique();

    // OPTIONALLY -- refuse to upgrade if there is no anon user.
    // Do we insist on captcha before letting people interact with the app?
    // Even if they login?

    // Maybe they already have a user record? Logging in again?
    let authUser = await ctx.db
      .query("users")
      .withIndex("by_kind_identifier", (q) =>
        q.eq("kind", "auth").eq("identifier", authInfo.tokenIdentifier),
      )
      .unique();
    // Create authenticated user record if it doesn't exist.
    if (!authUser) {
      const id = await ctx.db.insert("users", {
        kind: "auth",
        identifier: authInfo.tokenIdentifier,
      });
      authUser = await ctx.db.get(id);
    }
    // If the anon user exists, reparent their notes.
    // this does make the anon session have no notes, but this is appropraite.
    // If the user logs out the expect their now private data to be cleared.
    // this will also merge in notes from multiple anonymous sessions if the
    // person uses a few different devices.
    if (anonUser) {
      await reparentNotes(ctx, anonUser._id, authUser!._id);
    }
  },
});

// If the user created multiple anonymous users (on different devices?), reparent their notes
// upon login.
async function reparentNotes(
  ctx: MutationCtx,
  anonUser: Id<"users">,
  authUser: Id<"users">,
) {
  // Reparent the notes from anonUser to authUser.
  const anonNotes = await ctx.db
    .query("notes")
    .withIndex("by_owner", (q) => q.eq("owner", anonUser))
    .collect();
  for (const note of anonNotes) {
    await ctx.db.patch(note._id, {
      owner: authUser,
    });
  }
}

async function getUser(
  ctx: QueryCtx,
  sessionId: string,
): Promise<Doc<"users">> {
  console.log("getUser", sessionId);
  // Prefer the auth user.
  const authInfo = await ctx.auth.getUserIdentity();
  if (authInfo) {
    const authUser = await ctx.db
      .query("users")
      .withIndex("by_kind_identifier", (q) =>
        q.eq("kind", "auth").eq("identifier", authInfo.tokenIdentifier),
      )
      .unique();
    if (authUser) {
      return authUser;
    }
  }
  // Fallback to the anon user.
  const anonUser = await ctx.db
    .query("users")
    .withIndex("by_kind_identifier", (q) =>
      q.eq("kind", "anon").eq("identifier", sessionId),
    )
    .unique();
  if (!anonUser) {
    throw new Error("User not found");
  }
  return anonUser;
}

// Custom functions which grab the best possible user information.
export const userQuery = customQuery(baseQuery, {
  args: { ...SessionIdArg },
  input: async (ctx, { sessionId }) => {
    const user = await getUser(ctx, sessionId);
    return { ctx: { ...ctx, userId: user._id }, args: {} };
  },
});

export const userMutation = customMutation(baseMutation, {
  args: { ...SessionIdArg },
  input: async (ctx, { sessionId }) => {
    const user = await getUser(ctx, sessionId);
    return { ctx: { ...ctx, userId: user._id }, args: {} };
  },
});
