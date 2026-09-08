import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature") as string;

    const result = await ctx.runAction(internal.stripe.fulfill, {
      payload: await request.text(),
      signature,
    });

    if (result.success) {
      return new Response(null, {
        status: 200,
      });
    } else {
      return new Response("Webhook Error", {
        status: 400,
      });
    }
  }),
});

http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const headerPayload = request.headers;

    try {
      const result = await ctx.runAction(internal.clerk.fulfill, {
        payload: payloadString,
        headers: {
          id: headerPayload.get("svix-id")!,
          timestamp: headerPayload.get("svix-timestamp")!,
          signature: headerPayload.get("svix-signature")!,
        },
      });

      switch (result.type) {
        case "user.created":
          await ctx.runMutation(internal.users.createUser, {
            userId: result.data.id,
            handle: undefined,
          });
          break;
        case "user.updated":
          await ctx.runMutation(internal.users.internalUpdateUser, {
            userId: result.data.id,
            email: result.data.email_addresses?.[0]?.email_address,
            first: result.data.first_name ?? undefined,
            last: result.data.last_name ?? undefined,
          });
          break;
        case "user.deleted":
          if (result.data.id) {
            await ctx.runMutation(internal.users.internalDeleteUser, {
              userId: result.data.id,
            });
          }
          break;
      }

      return new Response(null, {
        status: 200,
      });
    } catch (err) {
      console.error(err);
      return new Response("Webhook Error", {
        status: 400,
      });
    }
  }),
});

export default http;
