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
  FolderOpen,
  FileEdit,
  Quote,
  Database,
  BarChart3,
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
  Radar,
  ChartLine,
  ListOrdered,
  Swords,
  Network,
  Link2,
  Anchor,
} from "lucide-react"

/**
 * Sidebar navigation configuration — mirrors existing Odito navigation
 * with Lucide React icons for the premium ElevenLabs-style sidebar.
 */

export const sidebarSections = [
  {
    id: "site-audit",
    label: "Site audit",
    parentLabel: "SEO", // small heading shown once above the whole SEO flow
    items: [
      { id: "overview", label: "Overview", href: "/app/dashboard", icon: LayoutDashboard },
      { id: "onpage", label: "On-Page", href: "/app/onpage", icon: FileText },
      { id: "technical-checks", label: "Technical", href: "/app/technicalchecks", icon: Settings },
      { id: "accessibility", label: "Accessibility", href: "/app/accessibility", icon: Accessibility },
      { id: "pagespeed", label: "Performance", href: "/app/pagespeed", icon: Zap },
      { id: "keywords", label: "Keywords", href: "/app/keywords", icon: Key },
    ],
  },
  {
    id: "domain-overview",
    label: "Rankings & traffic",
    items: [
      { id: "domain-overview", label: "Domain overview", href: "/app/domain-overview", icon: Radar },
      { id: "traffic-history", label: "Traffic", href: "/app/traffic-history", icon: ChartLine },
      {
        id: "keyword-ranking",
        label: "Keyword ranking",
        href: "/app/organic-keywords",
        icon: ListOrdered,
        children: [{ id: "organic-keywords", label: "All keywords", href: "/app/organic-keywords" }],
      },
      { id: "competitors", label: "Competitors", href: "/app/competitors", icon: Swords },
    ],
  },
  {
    id: "off-page",
    label: "Off-page",
    items: [
      { id: "off-page-overview", label: "Backlink overview", href: "/app/backlinks/overview", icon: Network },
      { id: "off-page-backlinks", label: "Backlinks", href: "/app/backlinks/list", icon: Link2 },
      { id: "off-page-anchors", label: "Anchors", href: "/app/backlinks/anchors", icon: Anchor },
      { id: "off-page-referring-domains", label: "Linking sites", href: "/app/referring-domains", icon: Globe },
      { id: "off-page-top-pages", label: "Top linked pages", href: "/app/backlinks/top-pages", icon: FileText },
    ],
  },
  {
    id: "ai-search",
    label: "AI search",
    items: [
      {
        id: "google-ai-overview-overview",
        label: "AI Visibility",
        href: "/app/google-ai-overview",
        icon: Sparkles,
        children: [
          { id: "google-ai-overview-home", label: "Overview", href: "/app/google-ai-overview" },
          { id: "google-ai-overview-questions", label: "Questions", href: "/app/google-ai-overview/questions" },
          { id: "google-ai-overview-results", label: "Answers & citations", href: "/app/google-ai-overview/results" },
          { id: "google-ai-overview-history", label: "History", href: "/app/google-ai-overview/history" },
        ],
      },
      { id: "aeo-hub", label: "AEO", href: "/app/aeo-hub", icon: MessageSquareQuote },
      { id: "aiso", label: "AISO", href: "/app/aiso", icon: BrainCircuit },
      { id: "geo-hub", label: "GEO", href: "/app/geo-hub", icon: Globe },
    ],
  },
  {
    id: "google-data",
    label: "Google data",
    items: [
      { id: "google-visibility-search-console", label: "Search Console", href: "/app/google-visibility/search-console", icon: Search },
      { id: "google-visibility-analytics", label: "Analytics", href: "/app/google-visibility/analytics", icon: BarChart3 },
      {
        id: "google-visibility-business-profile",
        label: "Business Profile",
        href: "/app/google-visibility/business-profile",
        icon: Building,
        children: [
          { id: "google-visibility-business-profile-overview", label: "Overview", href: "/app/google-visibility/business-profile" },
          { id: "google-visibility-business-profile-reviews", label: "Reviews", href: "/app/google-visibility/business-profile/reviews" },
          { id: "google-visibility-business-profile-posts", label: "Posts", href: "/app/google-visibility/business-profile/posts" },
        ],
      },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    hidden: true, // not shown in the sidebar for now; the pages and routes still exist. Remove this line to show it again.
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
    hidden: true, // not shown in the sidebar for now; the pages and routes still exist. Remove this line to show it again.
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
