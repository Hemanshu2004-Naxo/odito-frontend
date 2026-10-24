import {
  LayoutDashboard,
  FileText,
  Accessibility,
  Settings,
  Zap,
  Key,
  BrainCircuit,
  ShieldCheck,
  Video,
  Lightbulb,
  Wrench,
  Webhook,
  Link,
  FolderOpen,
  FileEdit,
  Quote,
  Database,
  BarChart3,
  Anchor,
  Link2,
  Eye,
  RefreshCw,
  Cpu,
  CreditCard,
  Tag,
  FileOutput,
  Bell,
  UserPlus,
  ClipboardList,
  History,
  MessageSquareQuote,
  Globe,
  Building,
  Search,
  Megaphone,
  Users,
  Share2,
  Sparkles,
  Bot,
  ListChecks,
  CircleHelp,
} from "lucide-react"

/**
 * Sidebar navigation configuration — mirrors existing Odito navigation
 * with Lucide React icons for the premium ElevenLabs-style sidebar.
 */

export const sidebarSections = [
  {
    id: "audit",
    label: "Audit",
    items: [
      {
        id: "pre-audit",
        label: "Pre Audit",
        href: "/app/pre-audit",
        icon: ClipboardList,
      },
      {
        id: "overview",
        label: "Overview",
        href: "/app/dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "onpage",
        label: "On-Page Issues",
        href: "/app/onpage",
        icon: FileText,
      },
      {
        id: "accessibility",
        label: "Accessibility Issues",
        href: "/app/accessibility",
        icon: Accessibility,
      },
      {
        id: "technical-checks",
        label: "Technical Checks",
        href: "/app/technicalchecks",
        icon: Settings,
      },
      {
        id: "pagespeed",
        label: "PageSpeed",
        href: "/app/pagespeed",
        icon: Zap,
      },
      {
        id: "keywords",
        label: "Keywords",
        href: "/app/keywords",
        icon: Key,
      },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    items: [
      {
        id: "leads-all",
        label: "All Leads",
        href: "/app/leads",
        icon: Users,
      },
    ],
  },
  {
    id: "social-media",
    label: "Social Media",
    items: [
      {
        id: "social-media-overview",
        label: "Overview",
        href: "/app/social",
        icon: Share2,
      },
      {
        id: "social-media-ai",
        label: "Social Media AI",
        href: "/app/social-media",
        icon: Sparkles,
      },
    ],
  },
  {
    id: "google-visibility",
    label: "Google Visibility",
    items: [
      {
        id: "google-visibility-overview",
        label: "Overview",
        href: "/app/google-visibility",
        icon: LayoutDashboard,
      },
      {
        id: "google-visibility-business-profile",
        label: "Business Profile",
        href: "/app/google-visibility/business-profile",
        icon: Building,
        children: [
          {
            id: "google-visibility-business-profile-overview",
            label: "Overview",
            href: "/app/google-visibility/business-profile",
          },
          {
            id: "google-visibility-business-profile-reviews",
            label: "Reviews",
            href: "/app/google-visibility/business-profile/reviews",
          },
          {
            id: "google-visibility-business-profile-posts",
            label: "Posts",
            href: "/app/google-visibility/business-profile/posts",
          },
        ],
      },
      {
        id: "google-visibility-search-console",
        label: "Search Console",
        href: "/app/google-visibility/search-console",
        icon: Search,
      },
      {
        id: "google-visibility-analytics",
        label: "Analytics",
        href: "/app/google-visibility/analytics",
        icon: BarChart3,
      },
      {
        id: "google-visibility-google-ads",
        label: "Google Ads",
        href: "/app/google-visibility/google-ads",
        icon: Megaphone,
      },
    ],
  },
  {
    id: "ai-intelligence",
    label: "AI Intelligence",
    items: [
      {
        id: "aiso",
        label: "AISO Hub",
        href: "/app/aiso",
        icon: BrainCircuit,
      },
      {
        id: "aeo-hub",
        label: "AEO Hub",
        href: "/app/aeo-hub",
        icon: MessageSquareQuote,
      },
      {
        id: "geo-hub",
        label: "GEO Hub",
        href: "/app/geo-hub",
        icon: Globe,
      },
    ],
  },
  {
    id: "chatgpt-visibility",
    label: "ChatGPT Visibility",
    items: [
      {
        id: "chatgpt-visibility-overview",
        label: "Overview",
        href: "/app/chatgpt-visibility",
        icon: Bot,
      },
      {
        id: "chatgpt-visibility-questions",
        label: "Questions",
        href: "/app/chatgpt-visibility/questions",
        icon: CircleHelp,
      },
      {
        id: "chatgpt-visibility-results",
        label: "Answers & citations",
        href: "/app/chatgpt-visibility/results",
        icon: MessageSquareQuote,
      },
      {
        id: "chatgpt-visibility-history",
        label: "History",
        href: "/app/chatgpt-visibility/history",
        icon: History,
      },
    ],
  },
  {
    id: "report",
    label: "Report",
    items: [
      {
        id: "ai-video",
        label: "AI Video Report",
        href: "/app/ai-video",
        icon: Video,
      },
    ],
  },
  {
    id: "history",
    label: "History",
    items: [
      {
        id: "history-logs",
        label: "Optimization Center",
        href: "/app/history-logs",
        icon: History,
      },
      {
        id: "audit-analytics",
        label: "Audit Analytics",
        href: "/app/analytics",
        icon: BarChart3,
      },
      {
        id: "audit-comparison",
        label: "Audit Comparison",
        href: "/app/comparison",
        icon: Cpu,
      },
    ],
  },
]

export const bottomNavItems = [
  {
    id: "settings",
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
]
