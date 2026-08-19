import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  HardHat,
  Image as ImageIcon,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Minus,
  Paperclip,
  Phone,
  Play,
  Plus,
  Ruler,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  TriangleAlert,
  Truck,
  Upload,
  User,
  Users,
  Video,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated lucide-react set (named imports keep the bundle tree-shakeable).
 * Keys are the kebab-case names the dc files use. Need another icon?
 * Add its import and a row here.
 */
const ICONS = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  clock: Clock,
  "dollar-sign": DollarSign,
  "external-link": ExternalLink,
  "file-text": FileText,
  filter: Filter,
  flame: Flame,
  "hard-hat": HardHat,
  image: ImageIcon,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  "message-square": MessageSquare,
  minus: Minus,
  paperclip: Paperclip,
  phone: Phone,
  play: Play,
  plus: Plus,
  ruler: Ruler,
  search: Search,
  send: Send,
  settings: Settings,
  "shield-check": ShieldCheck,
  star: Star,
  "triangle-alert": TriangleAlert,
  truck: Truck,
  upload: Upload,
  user: User,
  users: Users,
  video: Video,
  wrench: Wrench,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  /** Pixel size (square). Design uses 16-28. */
  size?: number | string;
  /** 2px at 16-24px, 2.5px above 28px per the design system. */
  strokeWidth?: number;
  /** Defaults to currentColor. */
  color?: string;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; omitted -> decorative (aria-hidden). */
  label?: string;
};

export default function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  color = "currentColor",
  className,
  style,
  label,
}: IconProps) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  const px = typeof size === "string" ? parseInt(size, 10) || 18 : size;
  return (
    <span
      className={className ? `tsws-icon ${className}` : "tsws-icon"}
      style={{ width: px, height: px, color, ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Glyph size={px} strokeWidth={strokeWidth} absoluteStrokeWidth />
    </span>
  );
}

export { Icon };
