// Needs force-dynamic because page uses Clerk auth context
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "GetAt.Me — The Relationship-First Link-In-Bio",
  description:
    "Turn your audience into fans & customers. Beautiful link pages with bookings, payments, referrals, and live messaging.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "GetAt.Me",
  url: "https://getat.me",
  description:
    "The modern link-in-bio platform for creators, consultants, and service-led businesses. Bookings, payments, referrals, and messaging from a single link.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "29",
    offerCount: "3",
  },
  creator: {
    "@type": "Organization",
    name: "HurleyUS",
    url: "https://hurleyus.com",
  },
  featureList: [
    "Custom link-in-bio pages",
    "Online booking & scheduling",
    "Payment processing",
    "Referral tracking",
    "Live messaging",
    "Analytics dashboard",
    "Custom themes & branding",
  ],
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import AddPostForm from "@/components/forms/user/add-post";
import { Container } from "@/components/layout/container";
import { HomeFeed } from "@/components/views/posts/home-feed";
import {
  PiPaletteLight,
  PiLinkLight,
  PiCalendarLight,
  PiStarLight,
  PiChatCircleLight,
  PiChartBarLight,
  PiArrowRightLight,
  PiShootingStarLight,
  PiCheckCircleLight,
  PiUsersLight,
  PiRocketLight,
} from "react-icons/pi";

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SignedOut>
        <div className="flex flex-col min-h-dvh min-w-dvw">
          {/* Hero Section */}
          <section className="relative flex-1 flex items-center justify-center px-4 py-32 md:py-40 overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />
            <div className="absolute -top-40 left-1/2 h-[700px] w-[1000px] -translate-x-1/2 rounded-full bg-radial-[at_50%_0%] from-primary/20 via-transparent to-transparent blur-3xl animate-pulse-soft" />
            <div className="absolute bottom-0 left-0 h-72 w-72 bg-radial-[at_0%_100%] from-secondary/15 to-transparent blur-3xl" />
            <div className="absolute top-1/3 right-0 h-48 w-48 bg-radial-[at_100%_50%] from-primary/10 to-transparent blur-3xl" />

            <div className="relative max-w-5xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary animate-fade-in">
                <PiRocketLight className="h-4 w-4" />
                <span>Launch your link page in minutes</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] animate-fade-in-up">
                Turn your audience into
                <br />
                <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                  fans & customers
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in-up-delay-1">
                Get At Me gives you a beautiful, high-converting link page with bookings, payments,
                referrals, and live messaging -- everything you need to grow your brand from a
                single link.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up-delay-2">
                <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                  <Button size="lg" className="text-base px-8 h-12">
                    Create Your Free Page
                    <PiArrowRightLight className="ml-2 h-4 w-4" />
                  </Button>
                </SignUpButton>
                <Button asChild variant="outline" size="lg" className="text-base px-8 h-12">
                  <Link href="/pricing">See Plans & Pricing</Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground animate-fade-in-up-delay-3">
                No credit card required. Free forever on the starter plan.
              </p>
            </div>
          </section>

          {/* Social Proof Bar */}
          <section className="border-y border-border/30 bg-card/20 py-8 px-4">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-primary">One Link</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  To Rule Them All
                </p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-border/40" />
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">Bookings + Payments</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Built Right In
                </p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-border/40" />
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">Real-Time</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Chat & Referrals
                </p>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-24 md:py-32 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center space-y-4 mb-16">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                  <PiShootingStarLight className="h-4 w-4" />
                  <span>Built Different</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                  More than a link page
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Every feature is designed to help you build real relationships with your audience,
                  not just collect clicks.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    icon: PiPaletteLight,
                    title: "Custom Branding",
                    description:
                      "Color themes, cover photos, and typography presets that match your brand. Your page, your identity.",
                  },
                  {
                    icon: PiLinkLight,
                    title: "Dynamic Links",
                    description:
                      "Add, organize, and highlight links with drag-and-drop simplicity. Segment by category and schedule time-sensitive offers.",
                  },
                  {
                    icon: PiCalendarLight,
                    title: "Booking Forms",
                    description:
                      "Let visitors book time directly from your page. Syncs with Google Calendar so you never double-book.",
                  },
                  {
                    icon: PiStarLight,
                    title: "Ratings & Reviews",
                    description:
                      "Collect and showcase testimonials. Social proof displayed prominently builds trust at first glance.",
                  },
                  {
                    icon: PiChatCircleLight,
                    title: "Live Messaging",
                    description:
                      "Real-time conversations triggered from your profile. Convert interest into action while the visitor is engaged.",
                  },
                  {
                    icon: PiChartBarLight,
                    title: "Analytics",
                    description:
                      "Track traffic, clicks, referrals, and booking trends. Data-driven insights to grow your brand strategically.",
                  },
                ].map((feature, index) => (
                  <Card
                    key={index}
                    className="group relative overflow-hidden border-border/40 bg-card/30 backdrop-blur-xs transition-all duration-300 hover:border-primary/40 hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="text-lg font-bold">{feature.title}</CardTitle>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                          <feature.icon className="h-5 w-5" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="text-center mt-12">
                <Button asChild variant="outline" size="lg" className="text-base">
                  <Link href="/features">
                    Explore All Features
                    <PiArrowRightLight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="py-24 md:py-32 px-4 border-t border-border/30 bg-card/10">
            <div className="max-w-5xl mx-auto">
              <div className="text-center space-y-4 mb-16">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                  Up and running in
                  <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {" "}
                    three steps
                  </span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  No coding required. No complicated setup. Just create, customize, and share.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    step: "01",
                    icon: PiUsersLight,
                    title: "Create Your Account",
                    description:
                      "Sign up free and claim your personalized handle. Your page lives at getat.me/yourname.",
                  },
                  {
                    step: "02",
                    icon: PiPaletteLight,
                    title: "Customize Your Page",
                    description:
                      "Add links, choose a theme, upload your cover photo. Make it unmistakably you.",
                  },
                  {
                    step: "03",
                    icon: PiRocketLight,
                    title: "Share & Grow",
                    description:
                      "Drop your link anywhere -- bio, email signature, business card. Watch your audience convert.",
                  },
                ].map((item, index) => (
                  <div key={index} className="relative text-center space-y-4 p-6">
                    <div className="text-6xl font-black text-primary/10 absolute top-0 right-4 select-none">
                      {item.step}
                    </div>
                    <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="relative overflow-hidden py-28 md:py-36 px-4 border-t border-border/30">
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
            <div className="absolute top-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 bg-radial-[at_50%_0%] from-primary/15 via-transparent to-transparent blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-48 w-96 bg-radial-[at_50%_100%] from-secondary/10 to-transparent blur-3xl" />

            <div className="relative max-w-3xl mx-auto text-center space-y-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 animate-float">
                <PiCheckCircleLight className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to stand out?</h2>
              <p className="text-xl text-muted-foreground max-w-xl mx-auto">
                Join creators, consultants, and service pros who chose connection over clicks. Your
                link page starts free.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
                  <Button size="lg" className="text-base px-8 h-12">
                    Create Your Page Now
                    <PiArrowRightLight className="ml-2 h-4 w-4" />
                  </Button>
                </SignUpButton>
              </div>
            </div>
          </section>
        </div>
      </SignedOut>
      <SignedIn>
        <Container size="boxed" className="space-y-6 pt-20 justify-start items-stretch w-full">
          <h1>Welcome back!</h1>
          <AddPostForm />
          <HomeFeed />
        </Container>
      </SignedIn>
    </>
  );
}
