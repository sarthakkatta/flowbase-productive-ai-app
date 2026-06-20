import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Clock3,
  Layers3,
  MessageSquare,
  Palette,
  PanelLeft,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "Use cases", href: "#use-cases" },
  { label: "FAQ", href: "#faq" },
];

const features = [
  { title: "AI Assistant", text: "Draft, summarize, prioritize, and turn messy notes into next actions.", icon: Bot, color: "#7c5cff" },
  { title: "Command Dashboard", text: "A daily overview of tasks, reminders, documents, and AI insights.", icon: PanelLeft, color: "#ff6b4a" },
  { title: "Smart Calendar", text: "Plan reminders, scheduled tasks, and drafts with category color cues.", icon: CalendarDays, color: "#00a7e1" },
  { title: "Kanban Tasks", text: "Track boards, labels, due dates, shares, and progress across active work.", icon: CheckSquare, color: "#00b894" },
  { title: "Rich Notes", text: "Capture structured writing, task lists, links, and polished long-form thinking.", icon: StickyNote, color: "#f5a524" },
  { title: "Whiteboards", text: "Map ideas visually with flexible boards for planning and workshops.", icon: Palette, color: "#f04f78" },
  { title: "AI Templates", text: "Generate purpose-built mini apps and reusable systems for repeat workflows.", icon: WandSparkles, color: "#bd3ff6" },
  { title: "Collaboration", text: "Shared spaces, live presence, comments, and team-ready workspace flows.", icon: Users, color: "#3f6df6" },
  { title: "Settings & Categories", text: "Tune AI behavior, billing, categories, and workspace preferences.", icon: Settings, color: "#64748b" },
];

const steps = [
  { title: "Gather the work", text: "Bring notes, tasks, ideas, boards, and meetings into one calm operating layer." },
  { title: "Let AI structure it", text: "Ask Flowbase to summarize, sort, generate templates, and suggest next moves." },
  { title: "Ship with your team", text: "Plan in Kanban, collaborate in spaces, and keep the calendar honest." },
];

const aiCapabilities = [
  "Summarize scattered notes into clean briefs",
  "Generate task lists, templates, and launch plans",
  "Rewrite content with your preferred tone",
  "Find priorities across calendar, notes, and boards",
  "Create custom productivity apps from prompts",
  "Keep team context available where work happens",
];

const useCases = [
  { title: "Founders", text: "Run product plans, investor notes, hiring loops, and weekly priorities without tab sprawl." },
  { title: "Students", text: "Turn research, assignments, reminders, and study plans into an organized semester hub." },
  { title: "Teams", text: "Coordinate projects, docs, tasks, and live workspace context from one shared base." },
  { title: "Creators", text: "Plan content pipelines, scripts, campaigns, briefs, and publishing calendars with AI help." },
  { title: "Project Managers", text: "Connect timelines, boards, updates, and decisions in a dashboard built for follow-through." },
  { title: "Personal Productivity", text: "Keep goals, errands, notes, habits, and reminders visible without overbuilding a system." },
];

const testimonials = [
  {
    quote: "Flowbase feels like the workspace I kept trying to assemble from five different tools.",
    name: "Maya Chen",
    role: "Product Lead, Northstar Labs",
  },
  {
    quote: "The AI template builder turned our messy weekly ops process into something the whole team actually uses.",
    name: "Elliot Reyes",
    role: "Founder, Relay Studio",
  },
  {
    quote: "It has the polish of a dashboard and the flexibility of a notebook. That combination is rare.",
    name: "Priya Raman",
    role: "Strategy Consultant",
  },
];

const faqs = [
  { q: "What can the AI Assistant help with?", a: "It can summarize notes, draft project plans, suggest task breakdowns, refine writing, and help generate workspace templates." },
  { q: "Does Flowbase support collaboration?", a: "Yes. The workspace is designed around shared spaces, team boards, comments, live presence, and collaborative planning flows." },
  { q: "Are notes rich text or plain text?", a: "Notes support structured writing, links, task lists, headings, and long-form content for real work rather than quick scraps only." },
  { q: "What is the whiteboard for?", a: "Whiteboards are for mapping systems, brainstorming, planning workshops, and turning visual thinking into actionable follow-through." },
  { q: "How does the template builder work?", a: "Describe the workflow you need, then Flowbase helps generate a reusable AI-powered mini app or template for that process." },
  { q: "Is privacy considered?", a: "The product messaging and settings emphasize team controls, account security, and deliberate AI configuration for workspace data." },
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaf6] text-[#24201c]">
      <Navbar />
      <HeroSection />
      <FeatureSection />
      <HowItWorks />
      <ProductShowcase />
      <AiSection />
      <CollaborationSection />
      <UseCases />
      <Testimonials />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e7e1d6]/80 bg-[#fffffb]/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Flowbase home">
          <span className="grid size-10 place-items-center rounded-lg bg-[#256f63] text-white shadow-sm">
            <PanelLeft className="size-4 text-[#ffe08a]" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-5">Flowbase</span>
            <span className="block text-[11px] font-medium text-[#7c756a]">Think, plan, create</span>
          </span>
        </Link>
        <nav className="order-3 flex w-full flex-wrap items-center gap-1 text-xs font-semibold text-[#665f55] sm:order-none sm:w-auto sm:justify-center" aria-label="Landing navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-10 rounded-lg border-[#e7e1d6] bg-white text-[#5b5349] hover:bg-[#fff6e0]">
            <Link href="#showcase">
              <Play className="mr-2 size-4 text-[#ff6b4a]" aria-hidden="true" />
              Watch Demo
            </Link>
          </Button>
          <Button asChild className="h-10 rounded-lg bg-[#256f63] text-white shadow-sm hover:bg-[#1f5f55]">
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="ml-2 size-4 text-[#ffe08a]" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:px-8 lg:pb-20 lg:pt-20">
        <div className="max-w-2xl">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[#dbe8df] bg-[#fffffb] px-3 py-2 text-xs font-semibold text-[#256f63] shadow-sm">
            <Sparkles className="size-4 text-[#f5a524]" aria-hidden="true" />
            AI productivity for focused teams
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] text-[#24201c] sm:text-5xl lg:text-6xl">
            One calm workspace for notes, tasks, whiteboards, and AI.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#665f55] sm:text-lg">
            Flowbase helps you collect scattered work, organize it with AI, and move from thinking to shipping with a dashboard your team can trust.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-lg bg-[#256f63] text-white shadow-[0_18px_35px_rgba(37,111,99,0.22)] hover:bg-[#1f5f55]">
              <Link href="/sign-up">
                Start for Free
                <ArrowRight className="ml-2 size-4 text-[#ffe08a]" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-lg border-[#e7e1d6] bg-white text-[#4d463e] hover:bg-[#fff6e0]">
              <Link href="#showcase">
                <Play className="mr-2 size-4 text-[#ff6b4a]" aria-hidden="true" />
                Watch Demo
              </Link>
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {["No credit card", "Built for collaboration", "AI templates included"].map((badge) => (
              <span key={badge} className="inline-flex items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 text-xs font-semibold text-[#665f55] shadow-sm">
                <BadgeCheck className="size-4 text-[#00b894]" aria-hidden="true" />
                {badge}
              </span>
            ))}
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -left-4 top-10 h-28 w-28 rounded-full bg-[#ffe08a]/35 blur-3xl" />
      <div className="absolute -right-6 bottom-12 h-32 w-32 rounded-full bg-[#bff4cf]/40 blur-3xl" />
      <Card className="relative overflow-hidden rounded-lg border-[#d8d0c4] bg-[#fffffb]/92 p-3 shadow-[0_24px_80px_rgba(58,74,60,0.18)]">
        <div className="rounded-lg border border-[#e7e1d6] bg-[#f8f7f2]">
          <div className="flex items-center justify-between border-b border-[#e7e1d6] bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#f04f78]" />
              <span className="size-2.5 rounded-full bg-[#f5a524]" />
              <span className="size-2.5 rounded-full bg-[#00b894]" />
            </div>
            <div className="flex w-44 items-center gap-2 rounded-lg border border-[#e7e1d6] bg-[#fffffb] px-3 py-1.5 text-[11px] font-medium text-[#9a9287]">
              <Search className="size-3.5 text-[#ff6b4a]" aria-hidden="true" />
              Search workspace
            </div>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-[160px_minmax(0,1fr)]">
            <aside className="hidden rounded-lg border border-[#e7e1d6] bg-white p-3 md:block">
              {["Dashboard", "AI Assistant", "Calendar", "Kanban", "Notes"].map((item, index) => (
                <div key={item} className={cn("mb-2 flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold", index === 0 ? "bg-[#e6f6e9] text-[#256f63]" : "text-[#7c756a]")}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: ["#ff6b4a", "#7c5cff", "#00a7e1", "#00b894", "#f5a524"][index] }} />
                  {item}
                </div>
              ))}
            </aside>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Tasks" value="18" color="#00b894" />
                <MiniMetric label="Today" value="6" color="#00a7e1" />
                <MiniMetric label="AI drafts" value="12" color="#7c5cff" />
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-lg border border-[#e7e1d6] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Launch board</p>
                    <span className="rounded-md bg-[#fff6e0] px-2 py-1 text-[11px] font-semibold text-[#9a6b00]">In motion</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {["Ideas", "Doing", "Done"].map((column, index) => (
                      <div key={column} className="rounded-lg bg-[#f8f7f2] p-2">
                        <p className="text-[11px] font-semibold text-[#7c756a]">{column}</p>
                        <div className="mt-2 space-y-2">
                          {[0, 1].map((card) => (
                            <div key={card} className="rounded-md border border-[#e7e1d6] bg-white p-2 shadow-sm">
                              <div className="h-2 rounded-full" style={{ backgroundColor: ["#ff6b4a", "#00b894", "#7c5cff"][index], width: card ? "62%" : "84%" }} />
                              <div className="mt-2 h-2 rounded-full bg-[#e7e1d6]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-[#dbe8df] bg-[#256f63] p-4 text-white">
                  <Bot className="size-5 text-[#ffe08a]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">AI insight</p>
                  <p className="mt-2 text-xs leading-5 text-[#e9f1ed]">Three overdue tasks can become one focused sprint for the product launch.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FeatureSection() {
  return (
    <Section id="features" eyebrow="Features" title="Every core workspace surface, connected." text="Flowbase gives each part of your day a clear place, then lets AI move context between them.">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="group rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#cfdccf] hover:shadow-lg">
              <span className="grid size-11 place-items-center rounded-lg" style={{ backgroundColor: `${feature.color}18`, color: feature.color }}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-[#24201c]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#665f55]">{feature.text}</p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section eyebrow="How it works" title="A simple operating rhythm." text="Use Flowbase as the place where raw information becomes organized work.">
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.title} className="rounded-lg border-[#e7e1d6] bg-[#fffffb] p-6 shadow-sm">
            <span className="grid size-10 place-items-center rounded-lg bg-[#256f63] text-sm font-bold text-white">{index + 1}</span>
            <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#665f55]">{step.text}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function ProductShowcase() {
  return (
    <Section id="showcase" eyebrow="Product showcase" title="Mockups shaped around real Flowbase modules." text="No stock screenshots, just product-specific surfaces that mirror the app: dashboard, notes, boards, whiteboards, and AI.">
      <div className="grid gap-4 lg:grid-cols-2">
        <ShowcasePanel title="Dashboard" icon={PanelLeft} color="#ff6b4a" className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="Pending" value="24" color="#f5a524" />
            <MiniMetric label="Complete" value="68%" color="#00b894" />
            <MiniMetric label="Upcoming" value="9" color="#00a7e1" />
            <MiniMetric label="AI actions" value="31" color="#7c5cff" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-lg bg-[#f8f7f2] p-3">
              <div className="h-3 w-36 rounded-full bg-[#24201c]/80" />
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {["Calendar", "Kanban", "Notes"].map((item, index) => (
                  <div key={item} className="rounded-lg border border-[#e7e1d6] bg-white p-3">
                    <div className="h-2 w-16 rounded-full" style={{ backgroundColor: ["#00a7e1", "#00b894", "#f5a524"][index] }} />
                    <p className="mt-3 text-xs font-semibold text-[#665f55]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-[#256f63] p-4 text-white">
              <Sparkles className="size-5 text-[#ffe08a]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Daily briefing ready</p>
              <p className="mt-2 text-xs leading-5 text-[#e9f1ed]">Review one active board, two notes, and today's calendar pressure.</p>
            </div>
          </div>
        </ShowcasePanel>
        <ShowcasePanel title="Notes" icon={StickyNote} color="#f5a524">
          <MockLines color="#f5a524" />
        </ShowcasePanel>
        <ShowcasePanel title="Kanban" icon={CheckSquare} color="#00b894">
          <div className="grid gap-2 sm:grid-cols-3">
            {["Backlog", "Doing", "Done"].map((column) => (
              <div key={column} className="rounded-lg bg-[#f8f7f2] p-2">
                <p className="text-[11px] font-semibold text-[#7c756a]">{column}</p>
                <div className="mt-2 space-y-2">
                  <div className="h-14 rounded-md border border-[#e7e1d6] bg-white" />
                  <div className="h-10 rounded-md border border-[#e7e1d6] bg-white" />
                </div>
              </div>
            ))}
          </div>
        </ShowcasePanel>
        <ShowcasePanel title="Whiteboard" icon={Palette} color="#f04f78">
          <div className="relative h-56 rounded-lg bg-[#f8f7f2]">
            <Node className="left-6 top-7" color="#f04f78" label="Idea" />
            <Node className="right-8 top-12" color="#7c5cff" label="Plan" />
            <Node className="bottom-8 left-1/3" color="#00b894" label="Ship" />
            <div className="absolute left-24 top-20 h-px w-40 rotate-12 bg-[#d8d0c4]" />
            <div className="absolute bottom-20 right-28 h-px w-32 -rotate-12 bg-[#d8d0c4]" />
          </div>
        </ShowcasePanel>
        <ShowcasePanel title="AI Assistant" icon={Bot} color="#7c5cff">
          <div className="space-y-3">
            <div className="rounded-lg bg-[#f3f0ff] p-3 text-sm text-[#4d3ca4]">Summarize this launch plan and create next steps.</div>
            <div className="rounded-lg bg-[#256f63] p-3 text-sm leading-6 text-white">Here is a tighter plan with owners, risks, and a first sprint checklist.</div>
            <div className="flex flex-wrap gap-2">
              {["Draft tasks", "Create template", "Send recap"].map((item) => (
                <span key={item} className="rounded-md border border-[#e7e1d6] bg-white px-2 py-1 text-xs font-semibold text-[#665f55]">{item}</span>
              ))}
            </div>
          </div>
        </ShowcasePanel>
      </div>
    </Section>
  );
}

function AiSection() {
  return (
    <Section eyebrow="AI capabilities" title="AI that works inside the workspace." text="Flowbase keeps assistance close to the work instead of making you shuttle context into another tab.">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg border-[#dbe8df] bg-[#256f63] p-6 text-white shadow-lg">
          <WandSparkles className="size-8 text-[#ffe08a]" aria-hidden="true" />
          <h3 className="mt-5 text-2xl font-semibold">From prompt to process.</h3>
          <p className="mt-3 text-sm leading-7 text-[#e9f1ed]">
            Use AI to turn one-off thoughts into repeatable templates, sharper notes, and action plans your team can carry forward.
          </p>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {aiCapabilities.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-lg border border-[#e7e1d6] bg-white p-4 shadow-sm">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#00b894]" aria-hidden="true" />
              <p className="text-sm leading-6 text-[#4d463e]">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CollaborationSection() {
  return (
    <Section eyebrow="Collaboration" title="Shared context without the meeting-tax." text="Flowbase is built for team workspaces with live collaboration patterns that make handoffs feel natural.">
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "Presence", text: "See who is active in shared spaces and boards.", icon: CircleDot, color: "#00b894" },
          { title: "Comments", text: "Leave focused feedback close to notes, pages, and work items.", icon: MessageSquare, color: "#7c5cff" },
          { title: "Team Workspace", text: "Use shared spaces and boards as the source of truth for active projects.", icon: Layers3, color: "#ff6b4a" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="rounded-lg border-[#e7e1d6] bg-white p-6 shadow-sm">
              <span className="grid size-11 place-items-center rounded-lg" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#665f55]">{item.text}</p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

function UseCases() {
  return (
    <Section id="use-cases" eyebrow="Use cases" title="Flexible enough for different kinds of momentum." text="The workspace is broad on purpose: Flowbase adapts to planning, writing, managing, and creating.">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {useCases.map((item) => (
          <Card key={item.title} className="rounded-lg border-[#e7e1d6] bg-[#fffffb] p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <h3 className="text-base font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#665f55]">{item.text}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Testimonials() {
  return (
    <Section eyebrow="Testimonials" title="Built for people who live in the details." text="Professional placeholder voices for the first marketing pass.">
      <div className="grid gap-4 lg:grid-cols-3">
        {testimonials.map((item) => (
          <Card key={item.name} className="rounded-lg border-[#e7e1d6] bg-white p-6 shadow-sm">
            <p className="text-sm leading-7 text-[#4d463e]">&ldquo;{item.quote}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-[#eef8ef] text-sm font-bold text-[#256f63]">
                {item.name.split(" ").map((part) => part[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-[#7c756a]">{item.role}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function FaqSection() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions before you start." text="A quick pass through the main Flowbase surfaces.">
      <div className="grid gap-3 md:grid-cols-2">
        {faqs.map((item) => (
          <Card key={item.q} className="rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold">{item.q}</h3>
            <p className="mt-2 text-sm leading-6 text-[#665f55]">{item.a}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-lg border border-[#dbe8df] bg-[#256f63] px-6 py-12 text-white shadow-[0_24px_60px_rgba(37,111,99,0.22)] sm:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-sm font-semibold text-[#ffe08a]">Ready when your workspace is.</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Start with a dashboard, then let Flowbase become the place your work gathers itself.</h2>
          </div>
          <Button asChild size="lg" className="rounded-lg bg-white text-[#256f63] hover:bg-[#fff6e0]">
            <Link href="/sign-up">
              Start for Free
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#e7e1d6] bg-[#fffffb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm text-[#665f55]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-[#256f63]">
            <PanelLeft className="size-4 text-[#ffe08a]" aria-hidden="true" />
          </span>
          <span className="font-semibold text-[#24201c]">Flowbase</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-[#00b894]" aria-hidden="true" /> Private by design</span>
          <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-[#f5a524]" aria-hidden="true" /> Built for daily work</span>
          <span className="inline-flex items-center gap-2"><Zap className="size-4 text-[#7c5cff]" aria-hidden="true" /> AI-ready</span>
        </div>
      </div>
    </footer>
  );
}

function Section({
  id,
  eyebrow,
  title,
  text,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold text-[#256f63]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#24201c] sm:text-4xl">{title}</h2>
          <p className="mt-3 text-base leading-7 text-[#665f55]">{text}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function ShowcasePanel({
  title,
  icon: Icon,
  color,
  className,
  children,
}: {
  title: string;
  icon: typeof PanelLeft;
  color: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("rounded-lg border-[#e7e1d6] bg-white p-5 text-[#24201c] shadow-sm", className)}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-[#24201c]">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[#e7e1d6] bg-white p-3 shadow-sm">
      <div className="mb-3 h-1.5 w-9 rounded-full" style={{ backgroundColor: color }} />
      <p className="text-[11px] font-semibold uppercase text-[#7c756a]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#24201c]">{value}</p>
    </div>
  );
}

function MockLines({ color }: { color: string }) {
  return (
    <div className="rounded-lg bg-[#f8f7f2] p-4">
      <div className="h-3 w-48 rounded-full" style={{ backgroundColor: color }} />
      <div className="mt-4 space-y-3">
        <div className="h-2 rounded-full bg-[#d8d0c4]" />
        <div className="h-2 w-11/12 rounded-full bg-[#d8d0c4]" />
        <div className="h-2 w-4/5 rounded-full bg-[#d8d0c4]" />
      </div>
      <div className="mt-5 rounded-lg border-l-4 border-[#f5a524] bg-white p-3 text-sm text-[#665f55]">
        Convert research notes into a launch memo and task checklist.
      </div>
    </div>
  );
}

function Node({ className, color, label }: { className: string; color: string; label: string }) {
  return (
    <div className={cn("absolute rounded-lg border border-[#e7e1d6] bg-white px-4 py-3 text-sm font-semibold text-[#4d463e] shadow-sm", className)}>
      <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
