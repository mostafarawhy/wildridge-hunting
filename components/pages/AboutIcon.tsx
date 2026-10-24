import {
  CalendarDays,
  Languages,
  Leaf,
  Map,
  MessagesSquare,
  Shield,
  Star,
  Tag,
  Target,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AboutIconName } from "@/lib/settings/about-page";

const ICONS: Record<AboutIconName, LucideIcon> = {
  shield: Shield,
  conversation: MessagesSquare,
  truck: Truck,
  target: Target,
  star: Star,
  map: Map,
  users: Users,
  leaf: Leaf,
  calendar: CalendarDays,
  tag: Tag,
  language: Languages,
};

export default function AboutIcon({
  name,
  size,
}: {
  name: AboutIconName;
  size: number;
}) {
  const Icon = ICONS[name];
  return <Icon size={size} aria-hidden="true" />;
}
