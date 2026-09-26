import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleGauge,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Crosshair,
  Download,
  Droplets,
  Eye,
  FileText,
  Filter,
  Gauge,
  Info,
  LayoutDashboard,
  Leaf,
  LocateFixed,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Recycle,
  RefreshCw,
  Route,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  UserCheck,
  UserRound,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "./_core/hooks/useAuth";
import { startLogin } from "./const";
import { trpc } from "./lib/trpc";
import LegalPage from "./pages/LegalPage";
import PublicHome from "./pages/PublicHome";
import { MapView } from "./components/Map";

type StudentPage = "overview" | "report" | "classify" | "bins" | "guide" | "rewards" | "leaderboard" | "campus-map" | "profile";
type AdminPage = "overview" | "reports" | "bins" | "collection" | "sanitation" | "analytics" | "users" | "settings";
type Report = {
  id: string;
  issue: string;
  location: string;
  priority: "Normal" | "Important" | "Urgent";
  status: "Reported" | "Assigned" | "In Progress" | "Resolved";
  time: string;
  reporter: string;
};

type StoredReport = {
  id: string;
  reporterName: string;
  issue: string;
  location: string;
  priority: Report["priority"];
  status: Report["status"];
  createdAt: Date;
};

function storedReportToView(report: StoredReport): Report {
  const age = Math.max(0, Date.now() - new Date(report.createdAt).getTime());
  const minutes = Math.floor(age / 60_000);
  const time = minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;
  return { id: report.id, issue: report.issue, location: report.location, priority: report.priority, status: report.status, time, reporter: report.reporterName };
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(value: string, success: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    notify(success);
  } catch {
    notify("Clipboard access is unavailable in this browser.");
  }
}

type Bin = {
  id: string;
  location: string;
  type: string;
  fill: number;
  lastCollection: string;
  status: "Normal" | "Almost full" | "Needs collection";
  accent: string;
};

const initialReports: Report[] = [
  { id: "WW-2026-0142", issue: "Overflowing bin", location: "Cafeteria", priority: "Urgent", status: "In Progress", time: "12 min ago", reporter: "Ananya Sharma" },
  { id: "WW-2026-0141", issue: "Water leakage", location: "Hostel A", priority: "Important", status: "Assigned", time: "28 min ago", reporter: "Rohan Mehta" },
  { id: "WW-2026-0140", issue: "Dirty washroom", location: "Library", priority: "Normal", status: "Resolved", time: "1 hr ago", reporter: "Priya Nair" },
  { id: "WW-2026-0139", issue: "Wrong segregation", location: "Academic Block", priority: "Important", status: "Reported", time: "2 hrs ago", reporter: "Kabir Singh" },
];

const bins: Bin[] = [
  { id: "BIN-A-014", location: "Cafeteria · East Wing", type: "Wet waste", fill: 92, lastCollection: "Today, 08:40", status: "Needs collection", accent: "coral" },
  { id: "BIN-B-006", location: "Library · Ground Floor", type: "Dry waste", fill: 78, lastCollection: "Yesterday, 17:20", status: "Almost full", accent: "amber" },
  { id: "BIN-E-003", location: "Innovation Lab", type: "E-waste", fill: 36, lastCollection: "Sep 04, 12:05", status: "Normal", accent: "blue" },
  { id: "BIN-W-021", location: "Hostel A · Block 2", type: "Wet waste", fill: 62, lastCollection: "Today, 07:15", status: "Almost full", accent: "amber" },
  { id: "BIN-B-019", location: "Main Gate", type: "Dry waste", fill: 28, lastCollection: "Today, 09:30", status: "Normal", accent: "green" },
  { id: "BIN-H-008", location: "Sports Complex", type: "Sanitary", fill: 84, lastCollection: "Yesterday, 13:15", status: "Needs collection", accent: "coral" },
];

const locations = ["Main Gate", "Academic Block", "Library", "Hostel A", "Hostel B", "Cafeteria", "Sports Complex", "Administrative Block", "Parking Area"];
const issueTypes = ["Overflowing bin", "Wrong waste segregation", "Open garbage dumping", "Dirty washroom", "Sanitation issue", "Water leakage", "Other"];

const guideItems = [
  { category: "Wet Waste", icon: Droplets, tone: "mint", examples: ["banana peel", "vegetable waste", "food scraps", "tea leaves"], answer: "Compost it or place it in the green wet-waste bin." },
  { category: "Dry Waste", icon: Recycle, tone: "sky", examples: ["plastic bottles", "paper", "cardboard", "metal cans"], answer: "Empty, rinse, and place it in the blue dry-waste bin." },
  { category: "E-Waste", icon: Zap, tone: "violet", examples: ["batteries", "chargers", "electronic components", "old phones"], answer: "Use the designated E-waste collection point. Never mix with regular bins." },
  { category: "Hazardous / Sanitary", icon: ShieldCheck, tone: "rose", examples: ["used sanitary products", "medical waste", "contaminated materials"], answer: "Wrap securely and use the red sanitary-waste collection point." },
];

const menuStudent: { id: StudentPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "report", label: "Report Waste", icon: ClipboardList },
  { id: "campus-map", label: "Map", icon: MapIcon },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "profile", label: "Profile", icon: UserRound },
];

const menuAdmin: { id: AdminPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Campus overview", icon: LayoutDashboard },
  { id: "reports", label: "Student reports", icon: ClipboardList },
  { id: "bins", label: "Bin monitoring", icon: Boxes },
  { id: "collection", label: "Smart collection", icon: Route },
  { id: "sanitation", label: "Sanitation queue", icon: ClipboardCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "users", label: "Manage users", icon: Users },
  { id: "settings", label: "Institute settings", icon: Settings },
];

function AuthenticatedApp() {
  const { user, loading, error, logout } = useAuth();
  const instituteQuery = trpc.institute.config.useQuery();
  const reportsQuery = trpc.reports.list.useQuery(undefined, { enabled: Boolean(user) });
  const [studentPage, setStudentPage] = useState<StudentPage>("overview");
  const [adminPage, setAdminPage] = useState<AdminPage>("overview");
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [points, setPoints] = useState(1840);
  const [toast, setToast] = useState("");
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (reportsQuery.data) setReports(reportsQuery.data.map(storedReportToView));
  }, [reportsQuery.data]);

  if (loading) return <div className="auth-loading">Loading your WasteWise account…</div>;
  if (!user) return <LoginScreen error={error instanceof Error ? error.message : null} />;

  const role = user.role;
  const instituteName = instituteQuery.data?.name ?? "your campus";
  const instituteSlug = instituteQuery.data?.slug ?? "nsut";
  const userInitials = user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const goStudent = (page: StudentPage) => {
    setStudentPage(page);
    setMobileNavOpen(false);
  };

  const goAdmin = (page: AdminPage) => {
    setAdminPage(page);
    setMobileNavOpen(false);
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast"><CheckCircle2 size={16} /> {toast}</div>}
      <aside className={`sidebar ${isMobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark"><Recycle size={19} strokeWidth={2.7} /></div>
          <div><div className="brand-name">WasteWise</div><div className="brand-sub">SMART CAMPUS OS</div></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="role-switcher">
          <div className="role-active role-account">{role === "student" ? <UserRound size={15} /> : <ShieldCheck size={15} />} {role === "student" ? "Student" : "Admin"}</div>
        </div>
        <div className="side-label">{role === "student" ? "YOUR CAMPUS" : "OPERATIONS"}</div>
        <nav className="side-nav">
          {(role === "student" ? menuStudent : menuAdmin).map(({ id, label, icon: Icon }) => (
            <button key={id} className={(role === "student" ? studentPage === id : adminPage === id) ? "nav-active" : ""} onClick={() => role === "student" ? goStudent(id as StudentPage) : goAdmin(id as AdminPage)}>
              <Icon size={17} /><span>{label}</span>{label === "Student reports" && <span className="nav-count">18</span>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="prototype-note"><div className="live-dot" /><div><strong>Prototype mode</strong><span>Simulated campus data</span></div></div>
          <button className="nav-utility" onClick={() => notify("Settings panel is ready for campus preferences.")}><Settings size={16} /> Settings</button>
          <button className="nav-utility" onClick={() => void logout()}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumb"><span>WasteWise</span><ChevronRight size={14} /><strong>{role === "student" ? menuStudent.find((item) => item.id === studentPage)?.label : menuAdmin.find((item) => item.id === adminPage)?.label}</strong></div>
          <div className="topbar-actions">
            <div className="campus-select"><span className="status-pip" /> {instituteName} <ChevronDown size={14} /></div>
            <button className="icon-button notification-button" onClick={() => { setShowNotifications((s) => !s); setShowProfile(false); }} aria-label="Notifications"><Bell size={18} /><span /></button>
            <button className="profile-trigger" onClick={() => { setShowProfile((s) => !s); setShowNotifications(false); }}><span className="avatar avatar-green">{userInitials}</span><span className="profile-copy"><strong>{user.name}</strong><small>{role === "student" ? "Student account" : "Campus administrator"}</small></span><ChevronDown size={14} /></button>
            {showNotifications && <div className="popover notification-popover"><div className="popover-heading"><strong>Notifications</strong><span>3 new</span></div><NotificationItem title="Cafeteria report assigned" detail="WW-2026-0142 · 8 min ago" /><NotificationItem title="You earned 20 points" detail="Cleanliness drive verified" /><NotificationItem title="Weekly impact digest" detail="Your campus is 12% cleaner" /></div>}
            {showProfile && <div className="popover profile-popover"><div className="profile-popover-head"><span className="avatar avatar-green">{userInitials}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div><button onClick={() => { setShowProfile(false); role === "student" ? goStudent("profile") : notify("Account preferences opened"); }}><UserRound size={15} /> Profile & preferences</button><button onClick={() => notify("Your activity report is being prepared.")}><Download size={15} /> Download activity</button><button onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div>}
          </div>
        </header>
        <div className="page-wrap">
          {role === "student" ? <StudentWorkspace points={points} setPoints={setPoints} reports={reports} setReports={setReports} go={goStudent} notify={notify} page={studentPage} userName={user.name} userEmail={user.email} profileImageUrl={user.profileImageUrl} instituteName={instituteName} instituteSlug={instituteSlug} /> : <AdminWorkspace reports={reports} setReports={setReports} notify={notify} page={adminPage} go={goAdmin} instituteName={instituteName} />}
        </div>
      </main>
    </div>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return <PublicHome />;
  if (path === "/privacy") return <LegalPage kind="privacy" />;
  if (path === "/terms") return <LegalPage kind="terms" />;
  return <AuthenticatedApp />;
}

function NotificationItem({ title, detail }: { title: string; detail: string }) {
  return <div className="notification-item"><div className="notification-icon"><Activity size={14} /></div><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

function LoginScreen({ error }: { error: string | null }) {
  const configQuery = trpc.auth.googleConfig.useQuery();
  const instituteQuery = trpc.institute.config.useQuery();
  const configured = configQuery.data?.configured === true;
  const instituteName = instituteQuery.data?.name ?? "your campus";
  return <div className="auth-gate"><div className="auth-card"><div className="brand-mark"><Recycle size={22} strokeWidth={2.7} /></div><div className="brand-name">WasteWise</div><div className="brand-sub">SMART CAMPUS OS</div><h1>Welcome to WasteWise</h1><p>Sign in with your Google account to access your {instituteName} campus workspace.</p>{error && <div className="auth-error">{error}</div>}<button className="button button-primary auth-login-button" disabled={configQuery.isLoading || !configured} onClick={() => startLogin()}><UserRound size={16} /> {configured ? "Continue with Google" : "Google Sign-In needs setup"}</button>{!configQuery.isLoading && !configured && <small className="auth-help">The server is waiting for Google OAuth credentials. Add the environment variables from the setup guide, then restart the server.</small>}<div className="auth-legal-links"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></div></div></div>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function StatCard({ label, value, detail, icon: Icon, tone, trend }: { label: string; value: string; detail: string; icon: typeof Activity; tone: string; trend?: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{trend && <b className="trend">{trend}</b>}{detail}</small></div></div>;
}

function StudentWorkspace({ page, go, notify, points, setPoints, reports, setReports, userName, userEmail, profileImageUrl, instituteName, instituteSlug }: { page: StudentPage; go: (p: StudentPage) => void; notify: (s: string) => void; points: number; setPoints: React.Dispatch<React.SetStateAction<number>>; reports: Report[]; setReports: React.Dispatch<React.SetStateAction<Report[]>>; userName: string; userEmail: string; profileImageUrl: string | null; instituteName: string; instituteSlug: string }) {
  if (page === "report") return <ReportPage go={go} notify={notify} setReports={setReports} userName={userName} />;
  if (page === "classify") return <ClassifyPage go={go} notify={notify} />;
  if (page === "bins") return <BinsPage notify={notify} instituteName={instituteName} />;
  if (page === "guide") return <GuidePage notify={notify} />;
  if (page === "rewards") return <RewardsPage points={points} notify={notify} />;
  if (page === "leaderboard") return <LeaderboardPage instituteName={instituteName} />;
  if (page === "campus-map") return <CampusMapPage instituteName={instituteName} instituteSlug={instituteSlug} notify={notify} />;
  if (page === "profile") return <ProfilePage notify={notify} userName={userName} userEmail={userEmail} profileImageUrl={profileImageUrl} instituteName={instituteName} />;
  return <StudentOverview go={go} notify={notify} points={points} setPoints={setPoints} reports={reports} userName={userName} />;
}

function getDashboardDateInfo() {
  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 12 ? "Good morning" :
    hour < 18 ? "Good afternoon" :
    "Good evening";

  const date = now
    .toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();

  return { greeting, date };
}

function StudentOverview({ go, notify, points, setPoints, reports, userName }: { go: (p: StudentPage) => void; notify: (s: string) => void; points: number; setPoints: React.Dispatch<React.SetStateAction<number>>; reports: Report[]; userName: string }) {
  const { greeting, date } = getDashboardDateInfo();
  const [activityFilter, setActivityFilter] = useState("All activity");
  const activities = [
    { icon: ScanLine, title: "Plastic bottle classified", detail: "Dry Waste · 96% confidence", time: "Today, 10:42", tone: "sky" },
    { icon: CircleAlert, title: "Overflowing bin reported", detail: "Cafeteria · WW-2026-0138", time: "Yesterday, 16:28", tone: "coral" },
    { icon: Trophy, title: "Segregation quiz completed", detail: "+5 points earned", time: "Sep 04, 13:10", tone: "amber" },
    { icon: Users, title: "Cleanliness drive completed", detail: "+20 points earned", time: "Sep 02, 08:30", tone: "mint" },
  ];
  return <>
    <div className="eyebrow">{date}</div><h1>{greeting}, {userName.split(" ")[0]} <span className="wave">✦</span></h1>
    <div className="stat-grid four"><StatCard label="WasteWise points" value={points.toLocaleString()} detail="Top 18% on campus" icon={Sparkles} tone="amber" trend="+120 · " /><StatCard label="Reports submitted" value="12" detail="3 resolved this month" icon={ClipboardList} tone="coral" trend="+3 · " /><StatCard label="Issues resolved" value="09" detail="75% resolution rate" icon={CheckCircle2} tone="mint" trend="+12% · " /><StatCard label="Monthly contribution" value="18.4 kg" detail="Waste diverted" icon={Recycle} tone="sky" trend="+4.2 kg · " /></div>
    <div className="section-heading"><div><div className="eyebrow">MAKE AN IMPACT</div><h2>What would you like to do?</h2></div><span className="muted-caption">Takes less than 2 minutes</span></div>
    <div className="quick-grid"><QuickAction icon={ClipboardList} label="Report an issue" detail="Flag a campus problem" tone="coral" onClick={() => go("report")} /><QuickAction icon={ScanLine} label="Classify waste" detail="Know your bin in a snap" tone="sky" onClick={() => go("classify")} /><QuickAction icon={MapIcon} label="Find a bin" detail="See nearby collection points" tone="mint" onClick={() => go("bins")} /><QuickAction icon={BookOpen} label="Learn segregation" detail="Build better habits" tone="amber" onClick={() => go("guide")} /></div>
    <div className="content-grid two-thirds"><section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Everything you’ve done for a cleaner campus.</p></div><select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}><option>All activity</option><option>This week</option><option>This month</option></select></div><div className="activity-list">{activities.map(({ icon: Icon, title, detail, time, tone }) => <div className="activity-row" key={title}><div className={`activity-icon ${tone}`}><Icon size={16} /></div><div className="activity-main"><strong>{title}</strong><span>{detail}</span></div><time>{time}</time><ChevronRight size={15} className="row-chevron" /></div>)}</div><button className="text-button" onClick={() => notify("Activity history is fully synced for this demo.")}>View full activity <ArrowUpRight size={14} /></button></section><section className="panel impact-panel"><div className="panel-heading"><div><h3>Your impact</h3><p>September 2026</p></div><button className="icon-button" onClick={() => notify("Impact data refreshed.")}><RefreshCw size={15} /></button></div><div className="impact-chart"><div className="chart-y"><span>24 kg</span><span>18</span><span>12</span><span>6</span><span>0</span></div><div className="bars">{[9, 13, 11, 18, 15, 21, 24].map((height, index) => <div className="bar-col" key={index}><div className={`bar ${index === 6 ? "bar-current" : ""}`} style={{ height: `${height * 3.2}px` }} /><span>{["M", "T", "W", "T", "F", "S", "S"][index]}</span></div>)}</div></div><div className="impact-footer"><span><i className="dot dot-mint" />Waste diverted</span><strong>18.4 kg <small>this month</small></strong></div></section></div>
    <div className="section-heading compact"><div><div className="eyebrow">YOUR OPEN REPORTS</div><h2>Keep an eye on your reports</h2></div><button className="text-button" onClick={() => go("report")}>Report something new <Plus size={14} /></button></div>
    <section className="panel table-panel"><div className="table-head"><span>Report</span><span>Location</span><span>Submitted</span><span>Status</span><span /></div>{reports.slice(0, 3).map((report) => <div className="table-row" key={report.id}><div><strong>{report.issue}</strong><small>{report.id}</small></div><span>{report.location}</span><span>{report.time}</span><StatusPill status={report.status} /><button className="icon-button" onClick={() => notify(`${report.id} is currently ${report.status.toLowerCase()}.`)}><Eye size={15} /></button></div>)}</section>
  </>;
}

function QuickAction({ icon: Icon, label, detail, tone, onClick }: { icon: typeof Activity; label: string; detail: string; tone: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className={`quick-icon ${tone}`}><Icon size={19} /></span><span><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight size={16} className="action-arrow" /></button>;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "Resolved" || status === "Normal" ? "success" : status === "In Progress" || status === "Assigned" || status === "Almost full" ? "warning" : "danger";
  return <span className={`status-pill ${tone}`}><i />{status}</span>;
}

function ReportPage({ go, notify, setReports, userName }: { go: (p: StudentPage) => void; notify: (s: string) => void; setReports: React.Dispatch<React.SetStateAction<Report[]>>; userName: string }) {
  const [submitted, setSubmitted] = useState<Report | null>(null);
  const utils = trpc.useUtils();
  const createReport = trpc.reports.create.useMutation({
    onSuccess: (report) => {
      setReports((existing) => [storedReportToView(report), ...existing.filter((item) => item.id !== report.id)]);
      setSubmitted(storedReportToView(report));
      void utils.reports.list.invalidate();
      void utils.leaderboard.list.invalidate();
    },
    onError: (error) => notify(`Report could not be submitted: ${error.message}`),
  });
  const [form, setForm] = useState({ issue: "Overflowing bin", location: "Cafeteria", priority: "Normal", description: "" });
  const [fileName, setFileName] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (createReport.isPending) return;
    const id = `WW-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
    createReport.mutate({ id, issue: form.issue, location: form.location, priority: form.priority as Report["priority"], description: form.description || undefined, photoName: fileName || null });
  };
  if (submitted) return <div className="success-screen"><div className="success-art"><div className="success-check"><Check size={32} /></div><span className="success-spark spark-one">✦</span><span className="success-spark spark-two">✧</span></div><div className="eyebrow">THANK YOU FOR SPEAKING UP</div><h1>Report submitted<br /><em>successfully.</em></h1><p>Your report is now with the campus operations team. We’ll keep you posted as it moves through the queue.</p><div className="confirmation-card"><div><span>REPORT ID</span><strong>{submitted.id}</strong></div><div><span>ISSUE</span><strong>{submitted.issue}</strong></div><div><span>LOCATION</span><strong>{submitted.location}</strong></div><div><span>STATUS</span><StatusPill status="Reported" /></div><div><span>ESTIMATED RESPONSE</span><strong>25 minutes</strong></div></div><div className="success-actions"><button className="button button-primary" onClick={() => { setSubmitted(null); setForm({ issue: "Overflowing bin", location: "Cafeteria", priority: "Normal", description: "" }); setFileName(""); }}>Submit another report <Plus size={15} /></button><button className="button button-secondary" onClick={() => go("overview")}>Back to overview <ArrowUpRight size={15} /></button></div></div>;
  return <><PageHeader eyebrow="STUDENT REPORTING" title="Report an issue" description="Help your campus team spot problems sooner. Every genuine report earns +10 WasteWise points." action={<button className="button button-secondary" onClick={() => go("overview")}><ArrowLeft size={15} /> Back to overview</button>} /><div className="form-layout"><form className="panel report-form" onSubmit={submit}><div className="form-section"><div className="form-section-title"><span className="step-number">01</span><div><h3>What needs attention?</h3><p>Choose the issue that best describes what you see.</p></div></div><div className="choice-grid">{issueTypes.map((type) => <button type="button" key={type} className={`choice-card ${form.issue === type ? "choice-selected" : ""}`} onClick={() => setForm({ ...form, issue: type })}><span className="choice-radio" />{type}</button>)}</div></div><div className="form-section"><div className="form-section-title"><span className="step-number">02</span><div><h3>Where is it?</h3><p>Pinpoint the location so the right team can respond.</p></div></div><select className="field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>{locations.map((location) => <option key={location}>{location}</option>)}</select></div><div className="form-section"><div className="form-section-title"><span className="step-number">03</span><div><h3>Tell us more</h3><p>A little context helps us act faster.</p></div></div><textarea className="field textarea" placeholder="Add a short description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><div className="upload-row"><label className="upload-box"><Upload size={18} /><span>{fileName || "Attach a photo"}</span><small>JPG, PNG up to 10MB</small><input type="file" accept="image/*" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} /></label><div className="priority-box"><label>Priority</label><div className="priority-options">{["Normal", "Important", "Urgent"].map((priority) => <button type="button" key={priority} className={form.priority === priority ? `priority-${priority.toLowerCase()}` : ""} onClick={() => setForm({ ...form, priority })}>{priority}</button>)}</div></div></div></div><div className="form-footer"><span><ShieldCheck size={15} /> Reports are anonymous to other students</span><button className="button button-primary" type="submit" disabled={createReport.isPending}>{createReport.isPending ? <><RefreshCw size={15} className="spin" /> Saving report…</> : <>Submit report <ArrowUpRight size={15} /></>}</button></div></form><aside className="report-aside"><div className="aside-card aside-green"><div className="aside-icon"><Target size={19} /></div><h3>Good reports get results</h3><p>Include a clear location, what you noticed, and a photo if it’s safe to take one.</p><div className="aside-rule" /><div className="aside-stat"><strong>18 min</strong><span>average response time</span></div></div><div className="aside-card"><div className="eyebrow">YOUR REPORTING STREAK</div><div className="streak-row"><strong>04</strong><span>days</span><div className="streak-dots">{[1, 2, 3, 4, 5, 6, 7].map((d) => <i className={d < 5 ? "streak-fill" : ""} key={d} />)}</div></div><p>Report one genuine issue to keep it going.</p></div></aside></div></>;
}

function ClassifyPage({ go, notify }: { go: (p: StudentPage) => void; notify: (s: string) => void }) {
  const [fileName, setFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);
  const analyze = () => { if (!fileName) { notify("Choose a waste image first."); return; } setAnalyzing(true); setResult(false); window.setTimeout(() => { setAnalyzing(false); setResult(true); }, 1100); };
  return <><PageHeader eyebrow="AI-ASSISTED SORTING" title="Classify your waste" description="Snap a photo and get a practical segregation recommendation in seconds." action={<button className="button button-secondary" onClick={() => go("guide")}><BookOpen size={15} /> Open segregation guide</button>} /><div className="classification-layout"><section className="panel classify-panel"><div className="prototype-banner"><Sparkles size={15} /><span><strong>AI Classification — Prototype Demonstration</strong><small>Mock result for hackathon presentation. A production computer-vision API can plug into this flow later.</small></span></div><label className={`drop-zone ${fileName ? "drop-zone-filled" : ""}`}><input type="file" accept="image/*" onChange={(e) => { setFileName(e.target.files?.[0]?.name || ""); setResult(false); }} />{fileName ? <><div className="preview-placeholder"><Recycle size={32} /></div><strong>{fileName}</strong><span>Ready to analyze · Choose another image</span></> : <><div className="drop-icon"><Upload size={25} /></div><strong>Upload or capture a waste image</strong><span>Drag and drop here, or click to browse</span><small>JPG, PNG up to 10MB</small></>}</label><div className="camera-row"><button className="button button-secondary" onClick={() => notify("Camera capture is available on supported devices.")}><Camera size={16} /> Use camera</button><span>or</span><button className="text-button" onClick={() => setFileName("campus-waste-sample.jpg")}>Use a sample image <ArrowUpRight size={14} /></button></div><button className="button button-primary analyze-button" onClick={analyze} disabled={analyzing}>{analyzing ? <><RefreshCw size={15} className="spin" /> Analyzing waste…</> : <><ScanLine size={15} /> Analyze waste</>}</button>{result && <div className="classification-result"><div className="result-top"><div className="result-icon"><CheckCircle2 size={21} /></div><div><div className="eyebrow">MOCK AI RESULT</div><h2>Plastic bottle</h2><p>Confident match based on the uploaded sample.</p></div><span className="confidence"><strong>96%</strong><small>confidence</small></span></div><div className="result-grid"><div><span>Category</span><strong>Dry Waste</strong></div><div><span>Recommended bin</span><strong><i className="bin-chip blue" />Blue bin</strong></div></div><div className="why-box"><Info size={16} /><span><strong>Why?</strong> Plastic bottles are recyclable dry waste and should be kept separate from wet or organic waste.</span></div><button className="text-button" onClick={() => notify("Thanks — the prototype feedback has been recorded.")}>Report incorrect classification <MessageSquare size={14} /></button></div>}</section><aside className="classify-aside"><div className="aside-card aside-violet"><div className="aside-icon"><ShieldCheck size={18} /></div><h3>Sort with confidence</h3><p>When in doubt, check the guide or ask your campus sanitation team. Never put batteries in regular bins.</p><button className="aside-link" onClick={() => go("guide")}>View the guide <ArrowUpRight size={14} /></button></div><div className="panel mini-panel"><div className="panel-heading"><div><h3>Recent classifications</h3><p>Your last 3 scans</p></div></div>{["Plastic bottle · Dry", "Banana peel · Wet", "Battery · E-waste"].map((item, index) => <div className="mini-row" key={item}><span className={`mini-dot dot-${["sky", "mint", "violet"][index]}`} /><strong>{item.split(" · ")[0]}</strong><span>{item.split(" · ")[1]}</span></div>)}</div></aside></div></>;
}

function BinsPage({ notify, instituteName }: { notify: (s: string) => void; instituteName: string }) {
  const [filter, setFilter] = useState("All bins");
  const filtered = filter === "All bins" ? bins : bins.filter((bin) => bin.type === filter);
  return <><PageHeader eyebrow="CAMPUS MAP" title="Find a bin" description={`See nearby collection points at ${instituteName} and choose the right stream before you drop it.`} action={<button className="button button-primary" onClick={() => notify("Location access requested — showing campus center for this demo.")}><LocateFixed size={15} /> Use my location</button>} /><div className="map-layout"><section className="map-card panel"><div className="map-toolbar"><div className="map-search"><Search size={16} /><input placeholder="Search a campus location" onChange={(e) => notify(e.target.value ? `Searching for ${e.target.value}` : "Search cleared")} /></div><button className="icon-button" onClick={() => notify("Map layers refreshed.")}><RefreshCw size={15} /></button></div><div className="campus-map"><div className="map-grid-lines" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-building b-one"><span>Academic Block</span></div><div className="map-building b-two"><span>Library</span></div><div className="map-building b-three"><span>Cafeteria</span></div><div className="map-building b-four"><span>Hostel A</span></div>{bins.map((bin, i) => <button className={`map-pin pin-${bin.accent}`} style={{ left: `${[23, 51, 71, 39, 17, 78][i]}%`, top: `${[38, 27, 57, 70, 73, 34][i]}%` }} key={bin.id} onClick={() => notify(`${bin.id} · ${bin.fill}% full · ${bin.location}`)}><span><Recycle size={12} /></span></button>)}<div className="map-legend"><span><i className="dot dot-green" /> Normal</span><span><i className="dot dot-amber" /> Almost full</span><span><i className="dot dot-coral" /> Needs collection</span></div><div className="map-label"><Crosshair size={14} /> {instituteName} campus · illustrative sensor view</div></div></section><aside className="bin-list panel"><div className="panel-heading"><div><h3>Collection points</h3><p>42 bins · Prototype sensor data</p></div><Filter size={16} /></div><div className="filter-tabs">{["All bins", "Wet waste", "Dry waste", "E-waste"].map((item) => <button className={filter === item ? "filter-active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="bin-items">{filtered.map((bin) => <div className="bin-item" key={bin.id} onClick={() => notify(`${bin.id} selected on map.`)}><div className={`bin-status ${bin.accent}`}><Recycle size={16} /></div><div className="bin-item-copy"><strong>{bin.location}</strong><span>{bin.type} · {bin.id}</span><div className="fill-track"><i className={`fill-${bin.accent}`} style={{ width: `${bin.fill}%` }} /></div></div><div className="bin-percent"><strong>{bin.fill}%</strong><span>{bin.status}</span></div></div>)}</div><div className="simulated-footer"><Wifi size={14} /> Prototype / Simulated Sensor Data</div></aside></div></>;
}

function GuidePage({ notify }: { notify: (s: string) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("All");
  const allExamples = useMemo(() => guideItems.flatMap((item) => item.examples.map((example) => ({ ...item, example }))), []);
  const result = query ? allExamples.find((item) => item.example.toLowerCase().includes(query.toLowerCase())) : null;
  const filtered = guideItems.filter((item) => selected === "All" || item.category === selected);
  return <><PageHeader eyebrow="LEARN & SHARE" title="What goes where?" description="A quick, practical guide to making the right waste decision every time." action={<button className="button button-secondary" onClick={() => notify("Guide shared — link copied to clipboard in the demo.")}><ArrowUpRight size={15} /> Share guide</button>} /><section className="guide-search panel"><div className="search-icon-wrap"><Search size={22} /></div><div><div className="eyebrow">SEARCH THE GUIDE</div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What should I do with a battery?" /><p>{result ? `E-Waste → ${result.answer}` : "Try an item like plastic bottle, battery, banana peel, or charger."}</p></div>{query && <button className="icon-button" onClick={() => setQuery("")}><X size={16} /></button>}</section><div className="guide-tabs">{["All", ...guideItems.map((item) => item.category)].map((item) => <button className={selected === item ? "guide-tab-active" : ""} onClick={() => setSelected(item)} key={item}>{item}</button>)}</div><div className="guide-grid">{filtered.map(({ category, icon: Icon, tone, examples, answer }) => <article className={`guide-card ${tone}`} key={category}><div className="guide-card-top"><div className="guide-icon"><Icon size={19} /></div><span className="guide-arrow"><ArrowUpRight size={16} /></span></div><h2>{category}</h2><p>{answer}</p><div className="example-list">{examples.map((example) => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}</div><div className="guide-card-footer"><span>{examples.length} common items</span><CheckCircle2 size={15} /></div></article>)}</div><div className="tip-banner"><div className="tip-icon"><Leaf size={18} /></div><div><strong>One easy habit</strong><p>Keep a small bag for dry recyclables in your room, and empty it at the blue bin before it overflows.</p></div><button className="text-button" onClick={() => notify("Tip saved to your profile.")}>Save tip <Plus size={14} /></button></div></>;
}

function RewardsPage({ points, notify }: { points: number; notify: (s: string) => void }) {
  const leaderboardQuery = trpc.leaderboard.list.useQuery();
  const entries = (leaderboardQuery.data ?? []).slice(0, 5);
  return <><PageHeader eyebrow="WASTEWISE REWARDS" title="Your actions add up." description="Every useful report, better sort, and campus clean-up moves the whole community forward." action={<button className="button button-primary" onClick={() => void leaderboardQuery.refetch()}><RefreshCw size={15} /> Refresh rank</button>} /><div className="reward-hero"><div><div className="eyebrow light">YOUR CURRENT BALANCE</div><div className="points-display">{points.toLocaleString()} <span>pts</span></div><p>Your contribution score is calculated from verified campus actions.</p></div><div className="level-progress"><div className="level-label"><span>Segregation Champion</span><strong>Level 3 / 4</strong></div><div className="progress-track"><i style={{ width: "72%" }} /></div><small>72% to next badge</small></div></div><div className="reward-grid"><section className="panel"><div className="panel-heading"><div><h3>Earn more points</h3><p>Simple actions that create visible impact.</p></div></div><div className="earn-list"><EarnRow icon={ClipboardList} title="Genuine issue report" points="+10" done /><EarnRow icon={BookOpen} title="Complete a segregation quiz" points="+5" done /><EarnRow icon={Users} title="Join a cleanliness drive" points="+20" /><EarnRow icon={Recycle} title="Divert 5 kg of dry waste" points="+50" /></div></section><section className="panel"><div className="panel-heading"><div><h3>Badges earned</h3><p>Achievement data from your account</p></div></div><div className="badge-grid"><Badge icon="🌱" title="Green Starter" done /><Badge icon="♻" title="Segregation Champion" done /><Badge icon="🏆" title="Clean Campus Hero" /><Badge icon="✦" title="Sustainability Leader" locked /></div></section></div><section className="panel leaderboard-panel"><div className="panel-heading"><div><h3>Campus leaderboard</h3><p>Live ranking from the WasteWise database</p></div><button className="text-button" onClick={() => notify("Leaderboard shared with your campus group.")}>Share <ArrowUpRight size={14} /></button></div><div className="leaderboard-head"><span>RANK</span><span>STUDENT</span><span>POINTS</span><span /></div>{entries.map((entry) => <div className={`leader-row ${entry.isCurrentUser ? "you-row" : ""}`} key={entry.id}><strong className="rank">{String(entry.rank).padStart(2, "0")}</strong><Avatar user={entry} /><div><strong>{entry.displayName}</strong>{entry.isCurrentUser && <small>Your current rank</small>}</div><strong className="leader-score">{entry.totalPoints.toLocaleString()}</strong><span className="leader-trend">{entry.rank <= 3 ? "↑" : "—"}</span></div>)}</section></>;
}

function EarnRow({ icon: Icon, title, points, done }: { icon: typeof Activity; title: string; points: string; done?: boolean }) {
  return <div className="earn-row"><div className="earn-icon"><Icon size={17} /></div><div><strong>{title}</strong><span>{done ? "Completed this month" : "Available now"}</span></div><b>{points}</b>{done ? <CheckCircle2 size={16} className="earned-check" /> : <ChevronRight size={16} />}</div>;
}
function Badge({ icon, title, done, locked }: { icon: string; title: string; done?: boolean; locked?: boolean }) { return <div className={`badge-card ${done ? "badge-done" : ""} ${locked ? "badge-locked" : ""}`}><div className="badge-emoji">{locked ? <LockKeyhole size={17} /> : icon}</div><strong>{title}</strong><span>{locked ? "460 pts to unlock" : done ? "Earned" : "Keep going"}</span></div>; }

function LeaderboardPage({ instituteName }: { instituteName: string }) {
  const leaderboardQuery = trpc.leaderboard.list.useQuery();
  const entries = leaderboardQuery.data ?? [];
  const podium = entries.slice(0, 3);
  return <><PageHeader eyebrow="CAMPUS CONTRIBUTIONS" title="Leaderboard" description={`Recognizing the people making ${instituteName} cleaner, one contribution at a time.`} /><div className="leaderboard-rules"><span><strong>+10</strong> report submitted</span><span><strong>+25</strong> report verified</span><span><strong>+50</strong> cleanup contribution</span><span className="leaderboard-demo-note">Demo entries are marked for development</span></div>{leaderboardQuery.isLoading ? <div className="panel empty-state">Loading contribution rankings…</div> : <><section className="podium-grid">{[1, 0, 2].map((position) => { const entry = podium[position]; return <div className={`podium-card podium-${position + 1}`} key={entry?.id ?? position}>{entry ? <><div className="podium-crown">{position === 0 ? "♛" : position + 1}</div><Avatar user={entry} size="large" /><strong>{entry.displayName}</strong><span>{entry.totalPoints.toLocaleString()} pts</span><small>{entry.isDemo ? "Demo profile" : `${entry.reportsSubmitted} reports · ${entry.verifiedContributions} verified`}</small></> : <span className="podium-empty">Awaiting contribution</span>}<div className="podium-step">{position + 1}</div></div>; })}</section><section className="panel leaderboard-full"><div className="panel-heading"><div><h3>All contributors</h3><p>Ranked by total points · live from the WasteWise database</p></div><Trophy size={18} className="leaderboard-trophy" /></div><div className="leaderboard-table-head"><span>RANK</span><span>CONTRIBUTOR</span><span>REPORTS</span><span>VERIFIED</span><span>POINTS</span></div>{entries.map((entry) => <div className={`leaderboard-data-row ${entry.isCurrentUser ? "current-user-row" : ""}`} key={entry.id}><strong className="rank-number">{String(entry.rank).padStart(2, "0")}</strong><Avatar user={entry} /><div className="leader-name"><strong>{entry.displayName}{entry.isCurrentUser && <em>You</em>}</strong><small>{entry.isDemo ? "Demo seed profile" : "Authenticated contributor"}</small></div><span>{entry.reportsSubmitted}</span><span>{entry.verifiedContributions}</span><strong className="leader-score">{entry.totalPoints.toLocaleString()}</strong></div>)}</section></>}</>;
}

function Avatar({ user, size = "normal" }: { user: { displayName: string; profileImageUrl?: string | null }; size?: "normal" | "large" }) {
  const initials = user.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`leader-avatar ${size === "large" ? "leader-avatar-large" : ""}`}>{user.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : initials}</span>;
}

function CampusMapPage({ instituteName, instituteSlug, notify }: { instituteName: string; instituteSlug: string; notify: (message: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const mapInput = useMemo(() => ({ instituteSlug }), [instituteSlug]);
  const mapQuery = trpc.campusMap.config.useQuery(mapInput);
  const config = mapQuery.data;
  const locations = config?.locations ?? [];
  const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[character] ?? character);
  const centerSelected = (location: typeof locations[number]) => {
    setSelected(location.id);
    map?.panTo({ lat: location.lat, lng: location.lng });
    map?.setZoom(Math.max(config?.zoom ?? 16, 17));
  };
  if (mapQuery.isLoading) return <><PageHeader eyebrow="CAMPUS OPERATIONS / MAP" title={`${instituteName} campus map`} description="Loading the map configuration for this institute…" /><div className="panel map-state-card"><RefreshCw size={18} className="spin" /><strong>Loading map locations</strong><span>Checking the server for the configured campus map.</span></div></>;
  if (mapQuery.error) return <><PageHeader eyebrow="CAMPUS OPERATIONS / MAP" title={`${instituteName} campus map`} description="The campus map could not be loaded." /><div className="panel map-state-card map-state-error"><AlertTriangle size={18} /><strong>Map configuration unavailable</strong><span>{mapQuery.error.message}</span><button className="button button-secondary" onClick={() => void mapQuery.refetch()}><RefreshCw size={15} /> Try again</button></div></>;
  if (!config) return <><PageHeader eyebrow="CAMPUS OPERATIONS / MAP" title={`${instituteName} campus map`} description="No map configuration has been published for this institute yet." /><div className="panel map-state-card"><MapIcon size={20} /><strong>Map coming soon for {instituteName}</strong><span>An administrator can add this institute’s center, source, and location records without changing the frontend.</span></div></>;
  return <><PageHeader eyebrow="CAMPUS OPERATIONS / MAP" title={`${instituteName} campus map`} description="Explore campus landmarks, waste bins, collection points, and reported hotspots from the current institute map configuration." action={<button className="button button-secondary" onClick={() => { map?.panTo(config.center); map?.setZoom(config.zoom); notify(`Centered on the ${instituteName} map.`); }}><LocateFixed size={15} /> Center campus</button>} /><div className="map-page-grid"><section className="panel live-map-panel"><div className="map-page-toolbar"><div><h3>Interactive campus map</h3><p>Zoom, pan, and select a marker for more detail.</p></div><span className={`map-accuracy-note ${config.isVerified ? "map-source-verified" : ""}`}><Info size={13} /> {config.isVerified ? "Verified campus data" : "Approximate planning data"}</span></div><div className="google-map-wrap"><MapView initialCenter={config.center} initialZoom={config.zoom} onMapReady={(readyMap) => { setMap(readyMap);  locations.forEach((location) => { const marker = L.circleMarker([location.lat, location.lng], { radius: 8 }).addTo(readyMap); marker.bindPopup(`<strong>${escapeHtml(location.name)}</strong><br/><small>${escapeHtml(location.detail)}</small>`); marker.on("click", () => { setSelected(location.id); }); }); }} /></div><div className="map-disclaimer"><ShieldCheck size={14} /><span>{config.isVerified ? "This map configuration is marked verified by an administrator." : `Markers are approximate or illustrative and are not presented as official ${instituteName} facilities data.`}{config.sourceUrl && <> <a href={config.sourceUrl} target="_blank" rel="noreferrer">View source</a></>}</span></div></section><aside className="panel map-location-list"><div className="panel-heading"><div><h3>Map locations</h3><p>{locations.length} locations configured for {instituteName}</p></div></div><div className="map-type-legend"><span><i className="map-type-dot campus" /> Campus area</span><span><i className="map-type-dot landmark" /> Landmark</span><span><i className="map-type-dot bin" /> Waste bin</span><span><i className="map-type-dot collection" /> Collection</span><span><i className="map-type-dot hotspot" /> Hotspot</span></div>{locations.map((location) => <button key={location.id} className={`map-location-row ${selected === location.id ? "map-location-selected" : ""}`} onClick={() => centerSelected(location)}><i className={`map-type-dot ${location.type}`} /><span><strong>{location.name}</strong><small>{location.detail}</small></span><ChevronRight size={15} /></button>)}</aside></div></>;
}

function AdminSettingsPage({ instituteName, notify }: { instituteName: string; notify: (message: string) => void }) {
  const [name, setName] = useState(instituteName);
  const utils = trpc.useUtils();
  const update = trpc.institute.update.useMutation({ onSuccess: () => { notify("Institute name updated across WasteWise."); void utils.institute.config.invalidate(); }, onError: (error) => notify(error.message) });
  return <><PageHeader eyebrow="ADMIN / SETTINGS" title="Institute settings" description="Manage the campus identity used throughout the WasteWise experience." /><div className="settings-layout"><section className="panel settings-card"><div className="settings-section"><div className="settings-icon"><Settings size={18} /></div><div><h3>Campus identity</h3><p>Students and administrators will see this name in navigation, reports, maps, leaderboards, and empty states.</p></div></div><label className="settings-field"><span>Institute / campus name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. NSUT, IIT Delhi, DTU" maxLength={160} /><small>Default: NSUT · This setting is stored on the server.</small></label><div className="settings-actions"><span>{name.trim().length}/160 characters</span><button className="button button-primary" disabled={update.isPending || name.trim().length < 2 || name.trim() === instituteName} onClick={() => update.mutate({ name })}>{update.isPending ? "Saving…" : "Save institute name"}</button></div></section><aside className="panel settings-preview"><div className="eyebrow">LIVE PREVIEW</div><div className="settings-preview-brand"><span className="brand-mark"><Recycle size={17} /></span><div><strong>WasteWise</strong><small>SMART CAMPUS OS</small></div></div><div className="settings-preview-campus"><span className="status-pip" /> {name.trim() || "Your institute"}</div><p>Changing this setting updates the campus label without changing source code or user roles.</p></aside></div></>;
}

function ProfilePage({ notify, userName, userEmail, profileImageUrl, instituteName }: { notify: (s: string) => void; userName: string; userEmail: string; profileImageUrl: string | null; instituteName: string }) {
  const [saved, setSaved] = useState(false);
  const initials = userName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  return <><PageHeader eyebrow="YOUR PROFILE" title={userName} description="Your WasteWise identity, preferences, and contribution history." action={<button className="button button-primary" onClick={() => { setSaved(true); notify("Profile changes saved."); }}><Check size={15} /> {saved ? "Saved" : "Save changes"}</button>} /><div className="profile-layout"><section className="panel profile-card"><div className="profile-cover" /><div className="profile-main"><div className="profile-large-avatar">{profileImageUrl ? <img src={profileImageUrl} alt="" /> : initials}</div><div><h2>{userName}</h2><p>{userEmail}</p><span className="profile-campus"><MapIcon size={13} /> {instituteName}</span></div><button className="icon-button" onClick={() => notify("Avatar upload is ready in the full product.")}><Camera size={16} /></button></div><div className="profile-stats"><div><strong>1,840</strong><span>WasteWise points</span></div><div><strong>12</strong><span>Reports submitted</span></div><div><strong>18.4 kg</strong><span>Waste diverted</span></div></div></section><section className="panel preferences"><div className="panel-heading"><div><h3>Preferences</h3><p>Control how WasteWise keeps you in the loop.</p></div></div><Preference title="Report status updates" detail="Get notified when your reports move forward." enabled /><Preference title="Weekly impact digest" detail="A short summary every Sunday evening." enabled /><Preference title="Public leaderboard" detail="Show your name when you rank in the top 10." /></section></div><div className="profile-layout lower"><section className="panel"><div className="panel-heading"><div><h3>Contribution history</h3><p>Your campus impact over time.</p></div><button className="icon-button" onClick={() => notify("History exported as CSV in the full product.")}><Download size={15} /></button></div><div className="history-list"><div><span className="history-month">SEP</span><div><strong>18.4 kg dry waste diverted</strong><small>Through 7 correct segregation actions</small></div><b>+120 pts</b></div><div><span className="history-month">AUG</span><div><strong>14.2 kg dry waste diverted</strong><small>Through 5 correct segregation actions</small></div><b>+95 pts</b></div><div><span className="history-month">JUL</span><div><strong>Joined WasteWise</strong><small>{instituteName} campus</small></div><b>+50 pts</b></div></div></section><section className="panel support-card"><div className="support-icon"><MessageSquare size={19} /></div><h3>Need help?</h3><p>Have a question about waste segregation or a report you submitted?</p><button className="text-button" onClick={() => notify("Support request started — a campus guide will reply soon.")}>Talk to a campus guide <ArrowUpRight size={14} /></button></section></div></>;
}
function Preference({ title, detail, enabled }: { title: string; detail: string; enabled?: boolean }) { const [on, setOn] = useState(Boolean(enabled)); return <div className="preference-row"><div><strong>{title}</strong><span>{detail}</span></div><button className={`toggle ${on ? "toggle-on" : ""}`} onClick={() => setOn(!on)} aria-label={`Toggle ${title}`}><i /></button></div>; }

function AdminWorkspace({ page, go, notify, reports, setReports, instituteName }: { page: AdminPage; go: (p: AdminPage) => void; notify: (s: string) => void; reports: Report[]; setReports: React.Dispatch<React.SetStateAction<Report[]>>; instituteName: string }) {
  const accessQuery = trpc.admin.access.useQuery();
  if (accessQuery.isLoading) return <div className="auth-loading">Checking admin access…</div>;
  if (accessQuery.error) return <div className="auth-loading">This account does not have admin access.</div>;
  if (page === "reports") return <AdminReports reports={reports} setReports={setReports} notify={notify} />;
  if (page === "bins") return <AdminBins notify={notify} />;
  if (page === "collection") return <CollectionPage notify={notify} />;
  if (page === "sanitation") return <SanitationPage notify={notify} />;
  if (page === "analytics") return <AnalyticsPage notify={notify} />;
  if (page === "users") return <UsersPage notify={notify} instituteName={instituteName} />;
  if (page === "settings") return <AdminSettingsPage instituteName={instituteName} notify={notify} />;
  return <AdminOverview go={go} notify={notify} reports={reports} instituteName={instituteName} />;
}

function AdminOverview({ go, notify, reports, instituteName }: { go: (p: AdminPage) => void; notify: (s: string) => void; reports: Report[]; instituteName: string }) {
  const [date, setDate] = useState("Today, Sep 06");
  return <><div className="admin-title-row"><div><div className="eyebrow">CAMPUS OPERATIONS / LIVE VIEW</div><h1>Good morning, Dr. Verma <span className="wave">✦</span></h1><p>Here’s what needs your attention across {instituteName} today.</p></div><div className="admin-head-actions"><button className="date-button" onClick={() => setDate(date === "Today, Sep 06" ? "This week" : "Today, Sep 06")}><CalendarIcon /> {date}<ChevronDown size={14} /></button><button className="button button-primary" onClick={() => go("reports")}><Plus size={15} /> Create task</button></div></div><div className="prototype-strip"><div className="live-dot" /><strong>Prototype / Simulated Sensor Data</strong><span>Last synced 2 minutes ago</span><button onClick={() => notify("All simulated sensors synced just now.")}><RefreshCw size={14} /> Sync now</button></div><div className="stat-grid four admin-stats"><StatCard label="Total bins" value="42" detail="Across 9 campus zones" icon={Boxes} tone="sky" trend="+2 · " /><StatCard label="Active reports" value="18" detail="6 need your attention" icon={ClipboardList} tone="coral" trend="3 urgent · " /><StatCard label="Bins to collect" value="07" detail="Priority route ready" icon={Trash2} tone="amber" trend="2 critical · " /><StatCard label="Waste collected today" value="1,240 kg" detail="82% of daily target" icon={PackageCheck} tone="mint" trend="+14% · " /></div><div className="admin-grid"><section className="panel attention-panel"><div className="panel-heading"><div><h3>Needs attention</h3><p>Prioritized by urgency and campus traffic.</p></div><button className="text-button" onClick={() => go("reports")}>View all <ArrowUpRight size={14} /></button></div><div className="attention-list">{reports.slice(0, 4).map((report) => <div className="attention-row" key={report.id}><div className={`attention-mark ${report.priority.toLowerCase()}`}><CircleAlert size={16} /></div><div className="attention-copy"><strong>{report.issue}</strong><span>{report.location} · {report.id}</span></div><div className="attention-meta"><StatusPill status={report.status} /><small>{report.time}</small></div><button className="icon-button" onClick={() => notify(`${report.id} opened for review.`)}><MoreHorizontal size={16} /></button></div>)}</div></section><section className="panel campus-health"><div className="panel-heading"><div><h3>Campus health</h3><p>Composite cleanliness score</p></div><button className="icon-button" onClick={() => notify("Campus health refreshed.")}><RefreshCw size={15} /></button></div><div className="health-score"><div className="health-ring"><div><strong>82</strong><span>/100</span></div></div><div><strong>Healthy campus</strong><p>Up 6 points from last week</p><span className="health-up"><TrendingUp size={13} /> Trending well</span></div></div><div className="health-bars"><HealthBar label="Waste segregation" value={88} tone="mint" /><HealthBar label="Response time" value={76} tone="amber" /><HealthBar label="Bin availability" value={92} tone="sky" /></div></section></div><div className="section-heading compact admin-section-title"><div><div className="eyebrow">OPERATIONS SNAPSHOT</div><h2>Make today’s route count</h2></div><button className="text-button" onClick={() => go("collection")}>Open collection planner <ArrowUpRight size={14} /></button></div><div className="ops-grid"><OpsCard icon={Route} title="Collection route" value="07 stops" detail="2 critical bins · 42 min est." tone="amber" action={() => go("collection")} /><OpsCard icon={ClipboardCheck} title="Sanitation queue" value="05 open tasks" detail="2 assigned · 1 overdue" tone="coral" action={() => go("sanitation")} /><OpsCard icon={BarChart3} title="Weekly analytics" value="+14.2%" detail="Waste diversion vs last week" tone="mint" action={() => go("analytics")} /></div></>;
}
function CalendarIcon() { return <span className="calendar-icon"><span>SEP</span><strong>06</strong></span>; }
function HealthBar({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="health-bar"><div><span>{label}</span><strong>{value}%</strong></div><div className="fill-track"><i className={`fill-${tone}`} style={{ width: `${value}%` }} /></div></div>; }
function OpsCard({ icon: Icon, title, value, detail, tone, action }: { icon: typeof Activity; title: string; value: string; detail: string; tone: string; action: () => void }) { return <button className="ops-card" onClick={action}><div className={`ops-icon ${tone}`}><Icon size={19} /></div><span>{title}</span><strong>{value}</strong><small>{detail}</small><ArrowUpRight size={16} className="ops-arrow" /></button>; }

function AdminReports({ reports, setReports, notify }: { reports: Report[]; setReports: React.Dispatch<React.SetStateAction<Report[]>>; notify: (s: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All reports");
  const filtered = reports.filter((report) => (filter === "All reports" || report.status === filter) && `${report.issue} ${report.location} ${report.id}`.toLowerCase().includes(query.toLowerCase()));
  const utils = trpc.useUtils();
  const advanceMutation = trpc.reports.advance.useMutation({
    onSuccess: (report) => {
      setReports((items) => items.map((item) => item.id === report.id ? storedReportToView(report) : item));
      void utils.reports.list.invalidate();
      void utils.leaderboard.list.invalidate();
      notify(`${report.id} is now ${report.status}.`);
    },
    onError: (error) => notify(`Report update failed: ${error.message}`),
  });
  const advance = (id: string) => { if (!advanceMutation.isPending) advanceMutation.mutate({ id }); };
  return <><PageHeader eyebrow="OPERATIONS / REPORTS" title="Student reports" description="Triage, assign, and resolve campus issues from one queue." action={<button className="button button-primary" onClick={() => notify("New task composer opened.")}><Plus size={15} /> Create task</button>} /><div className="filter-bar panel"><div className="map-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by issue, location, or report ID" /></div><div className="filter-tabs compact-tabs">{["All reports", "Reported", "Assigned", "In Progress", "Resolved"].map((item) => <button className={filter === item ? "filter-active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="button button-secondary" onClick={() => notify("Advanced filters opened.")}><SlidersHorizontal size={15} /> Filters</button></div><section className="panel table-panel admin-report-table"><div className="table-head"><span>Report</span><span>Location</span><span>Priority</span><span>Reporter</span><span>Status</span><span>Action</span></div>{filtered.map((report) => <div className="table-row" key={report.id}><div><strong>{report.issue}</strong><small>{report.id} · {report.time}</small></div><span>{report.location}</span><span className={`priority-label ${report.priority.toLowerCase()}`}><i />{report.priority}</span><span>{report.reporter}</span><StatusPill status={report.status} /><button className="small-action" onClick={() => advance(report.id)}>{report.status === "Resolved" ? "View" : report.status === "Reported" ? "Assign" : "Advance"} <ArrowUpRight size={13} /></button></div>)}</section></>;
}

function AdminBins({ notify }: { notify: (s: string) => void }) { return <><PageHeader eyebrow="OPERATIONS / BIN MONITORING" title="Bin monitoring" description="A live operational view of 42 campus bins, powered by simulated sensor readings." action={<button className="button button-secondary" onClick={() => notify("Bin readings synced just now.")}><RefreshCw size={15} /> Refresh readings</button>} /><div className="bin-monitor-grid">{bins.map((bin) => <div className="panel monitor-card" key={bin.id}><div className="monitor-top"><div className={`bin-status ${bin.accent}`}><Recycle size={17} /></div><StatusPill status={bin.status} /><button className="icon-button" onClick={() => notify(`${bin.id} actions opened.`)}><MoreHorizontal size={16} /></button></div><div className="monitor-copy"><h3>{bin.id}</h3><p>{bin.location}</p><span>{bin.type}</span></div><div className="gauge"><div className="gauge-track"><i className={`fill-${bin.accent}`} style={{ width: `${bin.fill}%` }} /></div><div><strong>{bin.fill}%</strong><span>fill level</span></div></div><div className="monitor-footer"><span><Clock3 size={13} /> Collected {bin.lastCollection}</span><button onClick={() => notify(`Collection request raised for ${bin.id}.`)}>Request pickup <ArrowUpRight size={13} /></button></div></div>)}</div><div className="simulated-footer centered"><Wifi size={14} /> Prototype / Simulated Sensor Data · Readings are illustrative for the hackathon demonstration</div></>;
}

function CollectionPage({ notify }: { notify: (s: string) => void }) { const [assigned, setAssigned] = useState<string[]>([]); const tasks = bins.filter((b) => b.status !== "Normal"); return <><PageHeader eyebrow="OPERATIONS / COLLECTION" title="Smart collection planner" description="Prioritize routes using fill level, traffic importance, and time since collection." action={<button className="button button-primary" onClick={() => notify("Optimized route saved for today.")}><Route size={15} /> Optimize route</button>} /><div className="collection-layout"><section className="panel route-panel"><div className="route-header"><div><h3>Today’s priority route</h3><p>6 stops · 42 min estimated · Starts at 09:30</p></div><span className="route-status"><span className="live-dot" /> Ready to dispatch</span></div><div className="route-line">{tasks.map((bin, index) => <div className="route-stop" key={bin.id}><div className={`route-marker ${bin.accent}`}>{index + 1}</div><div><strong>{bin.location}</strong><span>{bin.id} · {bin.fill}% full</span></div><div className="route-stop-right"><StatusPill status={bin.status} /><button className="icon-button" onClick={() => notify(`${bin.location} highlighted on route map.`)}><Eye size={15} /></button></div></div>)}</div><div className="route-total"><span>Total estimated collection</span><strong>86 kg</strong></div></section><aside className="collection-side"><div className="panel assignment-card"><div className="panel-heading"><div><h3>Assign team</h3><p>Choose an available worker.</p></div></div>{["Rajesh Kumar", "Sonal Desai", "Imran Sheikh"].map((name, index) => <button className={`worker-row ${assigned.includes(name) ? "worker-selected" : ""}`} key={name} onClick={() => setAssigned((list) => list.includes(name) ? list.filter((item) => item !== name) : [...list, name])}><span className={`avatar worker-${index}`}>{name.split(" ").map((word) => word[0]).join("")}</span><div><strong>{name}</strong><span>{["On route · 2 stops", "Available now", "On break · back 10:00"][index]}</span></div>{assigned.includes(name) ? <CheckCircle2 size={17} /> : <span className="worker-radio" />}</button>)}<button className="button button-primary full-button" onClick={() => notify(assigned.length ? `${assigned.length} team member(s) assigned to today's route.` : "Select at least one team member first.")}><UserCheck size={15} /> Assign selected team</button></div><div className="aside-card aside-amber"><div className="aside-icon"><Gauge size={18} /></div><h3>Why this order?</h3><p>Cafeteria and Sports Complex are prioritized because their bins are above 80% and sit on high-traffic routes.</p></div></aside></div></>; }

function SanitationPage({ notify }: { notify: (s: string) => void }) { const [tasks, setTasks] = useState([{ title: "Washroom deep clean", location: "Library · 1st floor", assignee: "Sonal Desai", status: "In Progress" }, { title: "Leakage inspection", location: "Hostel A · Block 2", assignee: "Unassigned", status: "Reported" }, { title: "Cafeteria floor sanitization", location: "Cafeteria · East Wing", assignee: "Rajesh Kumar", status: "Assigned" }, { title: "Refill handwash stations", location: "Academic Block", assignee: "Imran Sheikh", status: "Resolved" }]); const advance = (title: string) => { setTasks((items) => items.map((item) => item.title === title ? { ...item, status: item.status === "Reported" ? "Assigned" : item.status === "Assigned" ? "In Progress" : "Resolved" } : item)); notify("Sanitation task advanced."); }; return <><PageHeader eyebrow="OPERATIONS / SANITATION" title="Sanitation queue" description="Track every hygiene task from first report to verified resolution." action={<button className="button button-primary" onClick={() => notify("Sanitation task composer opened.")}><Plus size={15} /> Add task</button>} /><div className="kanban"><SanitationColumn title="Reported" tone="rose" tasks={tasks.filter((t) => t.status === "Reported")} advance={advance} /><SanitationColumn title="Assigned" tone="amber" tasks={tasks.filter((t) => t.status === "Assigned")} advance={advance} /><SanitationColumn title="In Progress" tone="sky" tasks={tasks.filter((t) => t.status === "In Progress")} advance={advance} /><SanitationColumn title="Resolved" tone="mint" tasks={tasks.filter((t) => t.status === "Resolved")} advance={advance} /></div></>; }
function SanitationColumn({ title, tone, tasks, advance }: { title: string; tone: string; tasks: { title: string; location: string; assignee: string; status: string }[]; advance: (title: string) => void }) { return <section className={`kanban-column ${tone}`}><div className="kanban-heading"><strong>{title}</strong><span>{tasks.length}</span></div><div className="kanban-tasks">{tasks.map((task) => <div className="task-card" key={task.title}><div className="task-card-top"><span className={`task-priority ${tone}`} /><button className="icon-button"><MoreHorizontal size={15} /></button></div><strong>{task.title}</strong><span><MapIcon size={12} /> {task.location}</span><div className="task-footer"><span className="task-assignee">{task.assignee === "Unassigned" ? <UserRound size={13} /> : task.assignee.split(" ").map((w) => w[0]).join("")}</span><button onClick={() => advance(task.title)}>{title === "Resolved" ? "View" : "Advance"} <ArrowUpRight size={12} /></button></div></div>)}</div></section>; }

function AnalyticsPage({ notify }: { notify: (s: string) => void }) { const [range, setRange] = useState("Last 30 days"); return <><PageHeader eyebrow="OPERATIONS / ANALYTICS" title="Campus analytics" description="A clear view of the habits, hotspots, and outcomes shaping your campus." action={<button className="date-button" onClick={() => setRange(range === "Last 30 days" ? "This semester" : "Last 30 days")}><CalendarIcon /> {range}<ChevronDown size={14} /></button>} /><div className="analytics-kpis"><StatCard label="Diversion rate" value="68.4%" detail="Target: 72%" icon={Recycle} tone="mint" trend="+8.2% · " /><StatCard label="Avg. response time" value="18 min" detail="Target: under 30 min" icon={Clock3} tone="sky" trend="-6 min · " /><StatCard label="Student participation" value="74%" detail="2,840 active students" icon={Users} tone="amber" trend="+12% · " /><StatCard label="Issues resolved" value="92%" detail="This month" icon={CheckCircle2} tone="coral" trend="+4.6% · " /></div><div className="analytics-grid"><section className="panel large-chart"><div className="panel-heading"><div><h3>Waste diversion trend</h3><p>Kg collected by stream · {range}</p></div><button className="icon-button" onClick={() => notify("Chart data exported.")}><Download size={15} /></button></div><div className="big-chart"><div className="chart-y"><span>1.5k</span><span>1.0k</span><span>500</span><span>0</span></div><div className="chart-area"><div className="chart-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 700 210" preserveAspectRatio="none" className="chart-svg"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#73bd9a" stopOpacity=".32" /><stop offset="100%" stopColor="#73bd9a" stopOpacity="0" /></linearGradient></defs><path d="M0,166 C46,156 54,132 95,141 S156,127 198,139 S254,86 302,104 S355,110 400,80 S456,92 495,60 S554,76 605,43 S660,50 700,18 V210 H0 Z" fill="url(#areaFill)" /><path d="M0,166 C46,156 54,132 95,141 S156,127 198,139 S254,86 302,104 S355,110 400,80 S456,92 495,60 S554,76 605,43 S660,50 700,18" fill="none" stroke="#32876a" strokeWidth="3" /></svg><div className="chart-x"><span>Aug 08</span><span>Aug 15</span><span>Aug 22</span><span>Aug 29</span><span>Sep 06</span></div></div></div><div className="chart-legend"><span><i className="dot dot-mint" />Total diverted</span><strong>8,420 kg <small>+14.2% vs last period</small></strong></div></section><section className="panel stream-panel"><div className="panel-heading"><div><h3>By waste stream</h3><p>This month</p></div></div><div className="stream-donut"><div className="donut-inner"><strong>8,420</strong><span>kg total</span></div></div><div className="stream-legend"><StreamRow tone="mint" label="Wet waste" value="42%" kg="3,536 kg" /><StreamRow tone="sky" label="Dry waste" value="34%" kg="2,863 kg" /><StreamRow tone="violet" label="E-waste" value="12%" kg="1,010 kg" /><StreamRow tone="coral" label="Sanitary" value="12%" kg="1,011 kg" /></div></section></div><div className="insight-banner"><div className="insight-icon"><Sparkles size={18} /></div><div><div className="eyebrow">OPERATIONAL INSIGHT</div><strong>Cafeteria segregation improved 22% after the August student drive.</strong><p>Keep the same nudge active during lunch hours to maintain momentum.</p></div><button className="button button-secondary" onClick={() => notify("Insight saved to your action plan.")}>Add to action plan <ArrowUpRight size={14} /></button></div></>; }
function StreamRow({ tone, label, value, kg }: { tone: string; label: string; value: string; kg: string }) { return <div className="stream-row"><i className={`dot dot-${tone}`} /><span>{label}</span><strong>{value}</strong><small>{kg}</small></div>; }

function UsersPage({ notify, instituteName }: { notify: (s: string) => void; instituteName: string }) { const users = [["Aditi Rao", "Student", "Active", "1,840"], ["Rohan Mehta", "Student", "Active", "1,230"], ["Priya Nair", "Student", "Active", "980"], ["Rajesh Kumar", "Sanitation staff", "On route", "—"], ["Sonal Desai", "Sanitation staff", "Available", "—"]]; return <><PageHeader eyebrow="OPERATIONS / PEOPLE" title="Manage users" description={`Keep ${instituteName} participation and sanitation team access in one place.`} action={<button className="button button-primary" onClick={() => notify("Invite flow opened.")}><Plus size={15} /> Invite user</button>} /><section className="panel user-table"><div className="filter-bar-inner"><div className="map-search"><Search size={16} /><input placeholder="Search people" onChange={(e) => notify(e.target.value ? `Searching for ${e.target.value}` : "Search cleared")} /></div><button className="button button-secondary" onClick={() => notify("Role filters opened.")}><Filter size={15} /> Filter roles</button></div><div className="table-head"><span>Person</span><span>Role</span><span>Status</span><span>Points</span><span /></div>{users.map(([name, role, status, score]) => <div className="table-row" key={name}><div className="user-cell"><span className="avatar avatar-muted">{name.split(" ").map((w) => w[0]).join("")}</span><div><strong>{name}</strong><small>{name.toLowerCase().replace(" ", ".")} · {instituteName}</small></div></div><span>{role}</span><StatusPill status={status === "Active" || status === "Available" ? "Normal" : "In Progress"} /><span className="user-points">{score}</span><button className="icon-button" onClick={() => notify(`${name}'s profile opened.`)}><MoreHorizontal size={16} /></button></div>)}</section></>; }

export default App;
