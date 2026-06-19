"use client";

import {
  BookOpen,
  CalendarCheck,
  ChartNoAxesCombined,
  Dumbbell,
  Flame,
  GraduationCap,
  HeartPulse,
  ListChecks,
  Sparkles,
  Target,
  Utensils,
  WalletCards,
} from "lucide-react";

import type { GeneratedAppIcon } from "@/lib/generated-apps";

const icons = {
  Sparkles,
  Flame,
  WalletCards,
  Utensils,
  BookOpen,
  Target,
  HeartPulse,
  Dumbbell,
  CalendarCheck,
  ListChecks,
  ChartNoAxesCombined,
  GraduationCap,
};

export function GeneratedAppIconView({ name, className, style }: { name: GeneratedAppIcon; className?: string; style?: React.CSSProperties }) {
  const Icon = icons[name] ?? Sparkles;
  return <Icon className={className} style={style} aria-hidden="true" />;
}
