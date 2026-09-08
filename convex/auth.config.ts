const config = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN ?? "https://clerk.getat.me",
      applicationID: "convex",
    },
  ],
};

export default config;
