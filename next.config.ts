import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Typechecking is a local pre-push gate; the production Ship workflow sets this flag.
    ignoreBuildErrors: process.env.NEXT_SKIP_BUILD_TYPECHECK === "1",
  },
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.clerk.accounts.dev",
      },
      {
        protocol: "https",
        hostname: "*.convex.*",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "hustle-launch-cq",

  project: "hustle-launch",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Disabled deprecated options to fix webpack infinite loop during build
  // See: https://github.com/getsentry/sentry-javascript/issues/12xxx
  // NOTE: These will need proper replacement when Sentry releases alternatives
  automaticVercelMonitors: false,
  disableLogger: true,
});
