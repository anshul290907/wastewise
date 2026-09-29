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

type StudentPage = "overview" | "report" | "classify" | "guide" | "rewards" | "leaderboard" | "campus-map" | "profile" | "settings";
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
  const createdAt = new Date(report.createdAt);
  const age = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(age / 60_000);
  const time = minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1_440 ? `${Math.floor(minutes / 60)} hr ago` : createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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


const initialReports: Report[] = [];

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
  const reportsQuery = trpc.reports.list.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 10_000 });
  const leaderboardQuery = trpc.leaderboard.list.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 10_000 });
  const [studentPage, setStudentPage] = useState<StudentPage>("overview");
  const [adminPage, setAdminPage] = useState<AdminPage>("overview");
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [points, setPoints] = useState(0);
  const [toast, setToast] = useState("");
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!leaderboardQuery.data) return;
    setPoints(leaderboardQuery.data.find((entry) => entry.isCurrentUser)?.totalPoints ?? 0);
  }, [leaderboardQuery.data]);

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
              <Icon size={17} /><span>{label}</span>{label === "Student reports" && <span className="nav-count">{reports.length}</span>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="prototype-note"><div className="live-dot" /><div><strong>Report workflow connected</strong><span>Reports saved to campus database</span></div></div>
          <button className="nav-utility" onClick={() => role === "student" ? goStudent("settings") : goAdmin("settings")}><Settings size={16} /> Settings</button>
          <button className="nav-utility" onClick={() => void logout()}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumb"><span>WasteWise</span><ChevronRight size={14} /><strong>{role === "student" ? studentPage === "settings" ? "Settings" : menuStudent.find((item) => item.id === studentPage)?.label : menuAdmin.find((item) => item.id === adminPage)?.label}</strong></div>
          <div className="topbar-actions">
            <div className="campus-select"><span className="status-pip" /> {instituteName} <ChevronDown size={14} /></div>
            <button className="icon-button notification-button" onClick={() => { setShowNotifications((s) => !s); setShowProfile(false); }} aria-label="Notifications"><Bell size={18} /><span /></button>
            <button className="profile-trigger" onClick={() => { setShowProfile((s) => !s); setShowNotifications(false); }}><span className="avatar avatar-green">{userInitials}</span><span className="profile-copy"><strong>{user.name}</strong><small>{role === "student" ? "Student account" : "Campus administrator"}</small></span><ChevronDown size={14} /></button>
            {showNotifications && <div className="popover notification-popover"><div className="popover-heading"><strong>Recent report activity</strong><span>{reports.length}</span></div>{reports.length ? reports.slice(0, 3).map((report) => <NotificationItem key={report.id} title={`${report.issue} Â· ${report.status}`} detail={`${report.id} Â· ${report.time}`} />) : <div className="empty-state">No report updates yet.</div>}</div>}
            {showProfile && <div className="popover profile-popover"><div className="profile-popover-head"><span className="avatar avatar-green">{userInitials}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div><button onClick={() => { setShowProfile(false); role === "student" ? goStudent("profile") : notify("Account preferences opened"); }}><UserRound size={15} /> Profile & preferences</button><button onClick={() => notify("Your activity report is being prepared.")}><Download size={15} /> Download activity</button><button onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div>}
          </div>
        </header>
        <div className="page-wrap">
          {reportsQuery.isLoading ? <div className="panel empty-state">Loading saved reportsâ€¦</div> : reportsQuery.isError ? <div className="panel empty-state map-state-error"><AlertTriangle size={18} /><strong>Reports could not be loaded</strong><span>{reportsQuery.error.message}</span><button className="button button-secondary" onClick={() => void reportsQuery.refetch()}><RefreshCw size={15} /> Try again</button></div> : role === "student" ? <StudentWorkspace points={points} reports={reports} setReports={setReports} go={goStudent} notify={notify} page={studentPage} userName={user.name} userEmail={user.email} profileImageUrl={user.profileImageUrl} instituteName={instituteName} instituteSlug={instituteSlug} /> : <AdminWorkspace reports={reports} setReports={setReports} notify={notify} page={adminPage} go={goAdmin} instituteName={instituteName} instituteSlug={instituteSlug} />}
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

function StudentWorkspace({ page, go, notify, points, reports, setReports, userName, userEmail, profileImageUrl, instituteName, instituteSlug }: { page: StudentPage; go: (p: StudentPage) => void; notify: (s: string) => void; points: number; reports: Report[]; setReports: React.Dispatch<React.SetStateAction<Report[]>>; userName: string; userEmail: string; profileImageUrl: string | null; instituteName: string; instituteSlug: string }) {
  if (page === "settings") return <StudentSettingsPage go={go} userName={userName} userEmail={userEmail} instituteName={instituteName} />;
  if (page === "report") return <ReportPage go={go} notify={notify} setReports={setReports} userName={userName} />;
  if (page === "classify") return <ClassifyPage go={go} notify={notify} />;

  if (page === "guide") return <GuidePage notify={notify} />;
  if (page === "rewards") return <RewardsPage points={points} />;
  if (page === "leaderboard") return <LeaderboardPage instituteName={instituteName} />;
  if (page === "campus-map") return <CampusMapPage instituteName={instituteName} instituteSlug={instituteSlug} notify={notify} />;
  if (page === "profile") return <ProfilePage go={go} userName={userName} userEmail={userEmail} profileImageUrl={profileImageUrl} instituteName={instituteName} points={points} reports={reports} />;
  return <StudentOverview go={go} notify={notify} points={points} reports={reports} userName={userName} />;
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

function StudentOverview({ go, notify, points, reports, userName }: { go: (p: StudentPage) => void; notify: (s: string) => void; points: number; reports: Report[]; userName: string }) {
  const { greeting, date } = getDashboardDateInfo();
  const [activityFilter, setActivityFilter] = useState("All activity"); const resolvedReports = reports.filter((report) => report.status === "Resolved").length;
  const activities = reports.slice(0, 4).map((report) => ({ icon: CircleAlert, title: `${report.issue} report`, detail: `${report.location} Â· ${report.status}`, time: report.time, tone: "coral" }));
  return <>
    <div className="eyebrow">{date}</div><h1>{greeting}, {userName.split(" ")[0]} <span className="wave">✦</span></h1>
    <div className="stat-grid four"><StatCard label="WasteWise points" value={points.toLocaleString()} detail="Points from recorded contributions" icon={Sparkles} tone="amber" /><StatCard label="Reports submitted" value={String(reports.length)} detail="Your saved campus reports" icon={ClipboardList} tone="coral" /><StatCard label="Issues resolved" value={String(resolvedReports)} detail="Based on your report statuses" icon={CheckCircle2} tone="mint" /><StatCard label="Open reports" value={String(reports.length - resolvedReports)} detail="Awaiting campus follow-up" icon={Recycle} tone="sky" /></div>
    <div className="section-heading"><div><div className="eyebrow">MAKE AN IMPACT</div><h2>What would you like to do?</h2></div><span className="muted-caption">Takes less than 2 minutes</span></div>
    <div className="quick-grid"><QuickAction icon={ClipboardList} label="Report an issue" detail="Flag a campus problem" tone="coral" onClick={() => go("report")} /><QuickAction icon={ScanLine} label="Classify waste" detail="Know your bin in a snap" tone="sky" onClick={() => go("classify")} /><QuickAction icon={MapIcon} label="Campus map" detail="View configured campus locations" tone="mint" onClick={() => go("campus-map")} /><QuickAction icon={BookOpen} label="Learn segregation" detail="Build better habits" tone="amber" onClick={() => go("guide")} /></div>
    <div className="content-grid two-thirds"><section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Everything you’ve done for a cleaner campus.</p></div><select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}><option>All activity</option><option>This week</option><option>This month</option></select></div><div className="activity-list">{activities.length ? activities.map(({ icon: Icon, title, detail, time, tone }) => <div className="activity-row" key={title}><div className={`activity-icon ${tone}`}><Icon size={16} /></div><div className="activity-main"><strong>{title}</strong><span>{detail}</span></div><time>{time}</time><ChevronRight size={15} className="row-chevron" /></div>) : <div className="empty-state">Your saved report activity will appear here.</div>}</div></section><section className="panel impact-panel"><div className="panel-heading"><div><h3>Waste impact</h3><p>Measurement status</p></div></div><div className="empty-state"><Recycle size={18} /> Waste weight and diversion data are not recorded in this build.</div></section></div>
    <div className="section-heading compact"><div><div className="eyebrow">YOUR OPEN REPORTS</div><h2>Keep an eye on your reports</h2></div><button className="text-button" onClick={() => go("report")}>Report something new <Plus size={14} /></button></div>
    <section className="panel table-panel"><div className="table-head"><span>Report</span><span>Location</span><span>Submitted</span><span>Status</span><span /></div>{reports.length ? reports.slice(0, 3).map((report) => <div className="table-row" key={report.id}><div><strong>{report.issue}</strong><small>{report.id}</small></div><span>{report.location}</span><span>{report.time}</span><StatusPill status={report.status} /><button className="icon-button" onClick={() => notify(`${report.id} is currently ${report.status.toLowerCase()}.`)}><Eye size={15} /></button></div>) : <div className="empty-state">No reports yet. Submit an issue to see its saved status here.</div>}</section>
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
  return <><PageHeader eyebrow="STUDENT REPORTING" title="Report an issue" description="Help your campus team spot problems sooner. Every genuine report earns +10 WasteWise points." action={<button className="button button-secondary" onClick={() => go("overview")}><ArrowLeft size={15} /> Back to overview</button>} /><div className="form-layout"><form className="panel report-form" onSubmit={submit}><div className="form-section"><div className="form-section-title"><span className="step-number">01</span><div><h3>What needs attention?</h3><p>Choose the issue that best describes what you see.</p></div></div><div className="choice-grid">{issueTypes.map((type) => <button type="button" key={type} className={`choice-card ${form.issue === type ? "choice-selected" : ""}`} onClick={() => setForm({ ...form, issue: type })}><span className="choice-radio" />{type}</button>)}</div></div><div className="form-section"><div className="form-section-title"><span className="step-number">02</span><div><h3>Where is it?</h3><p>Pinpoint the location so the right team can respond.</p></div></div><select className="field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>{locations.map((location) => <option key={location}>{location}</option>)}</select></div><div className="form-section"><div className="form-section-title"><span className="step-number">03</span><div><h3>Tell us more</h3><p>A little context helps us act faster.</p></div></div><textarea className="field textarea" placeholder="Add a short description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><div className="upload-row"><label className="upload-box"><Upload size={18} /><span>{fileName || "Attach a photo"}</span><small>Image storage is not connected yet; only the filename is saved.</small><input type="file" accept="image/*" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} /></label><div className="priority-box"><label>Priority</label><div className="priority-options">{["Normal", "Important", "Urgent"].map((priority) => <button type="button" key={priority} className={form.priority === priority ? `priority-${priority.toLowerCase()}` : ""} onClick={() => setForm({ ...form, priority })}>{priority}</button>)}</div></div></div></div><div className="form-footer"><span><ShieldCheck size={15} /> Reports are anonymous to other students</span><button className="button button-primary" type="submit" disabled={createReport.isPending}>{createReport.isPending ? <><RefreshCw size={15} className="spin" /> Saving report…</> : <>Submit report <ArrowUpRight size={15} /></>}</button></div></form><aside className="report-aside"><div className="aside-card aside-green"><div className="aside-icon"><Target size={19} /></div><h3>Good reports get results</h3><p>Include a clear location, what you noticed, and a photo if it’s safe to take one.</p><div className="aside-rule" /><div className="aside-stat"><strong>18 min</strong><span>average response time</span></div></div><div className="aside-card"><div className="eyebrow">YOUR REPORTING STREAK</div><div className="streak-row"><strong>04</strong><span>days</span><div className="streak-dots">{[1, 2, 3, 4, 5, 6, 7].map((d) => <i className={d < 5 ? "streak-fill" : ""} key={d} />)}</div></div><p>Report one genuine issue to keep it going.</p></div></aside></div></>;
}

function ClassifyPage({ go, notify }: { go: (p: StudentPage) => void; notify: (s: string) => void }) {
  const [fileName, setFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);
  const analyze = () => { if (!fileName) { notify("Choose a waste image first."); return; } setAnalyzing(true); setResult(false); window.setTimeout(() => { setAnalyzing(false); setResult(true); }, 1100); };
  return <><PageHeader eyebrow="SIMULATED AI FEATURE" title="Classify your waste" description="Try the classification prototype and compare its sample result with the segregation guide." action={<button className="button button-secondary" onClick={() => go("guide")}><BookOpen size={15} /> Open segregation guide</button>} /><div className="classification-layout"><section className="panel classify-panel"><div className="prototype-banner"><Sparkles size={15} /><span><strong>AI Classification — Prototype Demonstration</strong><small>Mock result for hackathon presentation. A production computer-vision API can plug into this flow later.</small></span></div><label className={`drop-zone ${fileName ? "drop-zone-filled" : ""}`}><input type="file" accept="image/*" onChange={(e) => { setFileName(e.target.files?.[0]?.name || ""); setResult(false); }} />{fileName ? <><div className="preview-placeholder"><Recycle size={32} /></div><strong>{fileName}</strong><span>Selected for prototype demonstration · image not stored</span></> : <><div className="drop-icon"><Upload size={25} /></div><strong>Upload a waste image</strong><span>Drag and drop here, or click to browse</span><small>Image storage is not connected in this build.</small></>}</label><div className="camera-row"><button className="button button-secondary" onClick={() => notify("Camera capture is not connected in this build. Upload an image instead.")}><Camera size={16} /> Camera not connected</button><span>or</span><button className="text-button" onClick={() => setFileName("campus-waste-sample.jpg")}>Use a sample image <ArrowUpRight size={14} /></button></div><button className="button button-primary analyze-button" onClick={analyze} disabled={analyzing}>{analyzing ? <><RefreshCw size={15} className="spin" /> Running demonstration…</> : <><ScanLine size={15} /> Show sample result</>}</button>{result && <div className="classification-result"><div className="result-top"><div className="result-icon"><CheckCircle2 size={21} /></div><div><div className="eyebrow">MOCK AI RESULT</div><h2>Plastic bottle</h2><p>Example output only; this is not model inference.</p></div><span className="confidence"><strong>96%</strong><small>sample score</small></span></div><div className="result-grid"><div><span>Example category</span><strong>Dry Waste</strong></div><div><span>Example recommendation</span><strong><i className="bin-chip blue" />Blue bin</strong></div></div><div className="why-box"><Info size={16} /><span><strong>Why?</strong> Plastic bottles are recyclable dry waste and should be kept separate from wet or organic waste.</span></div><button className="text-button" onClick={() => notify("Feedback submission is not connected in this build.")}>Feedback not connected <MessageSquare size={14} /></button></div>}</section><aside className="classify-aside"><div className="aside-card aside-violet"><div className="aside-icon"><ShieldCheck size={18} /></div><h3>Sort with confidence</h3><p>When in doubt, check the guide or ask your campus sanitation team. Never put batteries in regular bins.</p><button className="aside-link" onClick={() => go("guide")}>View the guide <ArrowUpRight size={14} /></button></div><div className="panel mini-panel"><div className="panel-heading"><div><h3>Classification history</h3><p>Not saved in this build</p></div></div><div className="empty-state">No classification history is stored. AI results are demonstration-only.</div></div></aside></div></>;
}

function GuidePage({ notify }: { notify: (s: string) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("All");
  const allExamples = useMemo(() => guideItems.flatMap((item) => item.examples.map((example) => ({ ...item, example }))), []);
  const result = query ? allExamples.find((item) => item.example.toLowerCase().includes(query.toLowerCase())) : null;
  const filtered = guideItems.filter((item) => selected === "All" || item.category === selected);
  return <><PageHeader eyebrow="LEARN & SHARE" title="What goes where?" description="A quick, practical guide to making the right waste decision every time." action={<button className="button button-secondary" onClick={() => notify("Guide sharing is not connected in this build.")}><ArrowUpRight size={15} /> Share guide</button>} /><section className="guide-search panel"><div className="search-icon-wrap"><Search size={22} /></div><div><div className="eyebrow">SEARCH THE GUIDE</div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What should I do with a battery?" /><p>{result ? `E-Waste → ${result.answer}` : "Try an item like plastic bottle, battery, banana peel, or charger."}</p></div>{query && <button className="icon-button" onClick={() => setQuery("")}><X size={16} /></button>}</section><div className="guide-tabs">{["All", ...guideItems.map((item) => item.category)].map((item) => <button className={selected === item ? "guide-tab-active" : ""} onClick={() => setSelected(item)} key={item}>{item}</button>)}</div><div className="guide-grid">{filtered.map(({ category, icon: Icon, tone, examples, answer }) => <article className={`guide-card ${tone}`} key={category}><div className="guide-card-top"><div className="guide-icon"><Icon size={19} /></div><span className="guide-arrow"><ArrowUpRight size={16} /></span></div><h2>{category}</h2><p>{answer}</p><div className="example-list">{examples.map((example) => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}</div><div className="guide-card-footer"><span>{examples.length} common items</span><CheckCircle2 size={15} /></div></article>)}</div><div className="tip-banner"><div className="tip-icon"><Leaf size={18} /></div><div><strong>One easy habit</strong><p>Keep a small bag for dry recyclables in your room, and empty it at the blue bin before it overflows.</p></div><button className="text-button" onClick={() => notify("Saving tips to your profile is not connected in this build.")}>Save tip <Plus size={14} /></button></div></>;
}

function RewardsPage({ points }: { points: number }) {
  const leaderboardQuery = trpc.leaderboard.list.useQuery();
  const entries = (leaderboardQuery.data ?? []).filter((entry) => !entry.isDemo).slice(0, 5).map((entry, index) => ({ ...entry, rank: index + 1 }));
  return <><PageHeader eyebrow="ACCOUNT CONTRIBUTIONS" title="Your points" description="Points and rankings shown here come from saved account contributions." action={<button className="button button-primary" onClick={() => void leaderboardQuery.refetch()}><RefreshCw size={15} /> Refresh</button>} /><div className="reward-hero"><div><div className="eyebrow light">RECORDED POINT BALANCE</div><div className="points-display">{points.toLocaleString()} <span>pts</span></div><p>Current total from your database-backed contribution record.</p></div><div className="level-progress"><div className="eyebrow light">SCORING</div><p>Saved report: +10 · resolved report: +25 · recorded cleanup contribution: +50.</p><small>Badges, quizzes, and waste-weight rewards are not implemented.</small></div></div><section className="panel leaderboard-panel"><div className="panel-heading"><div><h3>Campus leaderboard</h3><p>Persisted account contributions</p></div></div><div className="leaderboard-head"><span>RANK</span><span>STUDENT</span><span>POINTS</span><span /></div>{leaderboardQuery.isLoading ? <div className="empty-state">Loading contributions…</div> : leaderboardQuery.isError ? <div className="empty-state">Contributions could not be loaded. Try refreshing.</div> : entries.length === 0 ? <div className="empty-state">No account contributions have been recorded yet.</div> : entries.map((entry) => <div className={entry.isCurrentUser ? "leader-row you-row" : "leader-row"} key={entry.id}><strong className="rank">{String(entry.rank).padStart(2, "0")}</strong><Avatar user={entry} /><div><strong>{entry.displayName}</strong>{entry.isCurrentUser && <small>Your current rank</small>}</div><strong className="leader-score">{entry.totalPoints.toLocaleString()}</strong><span className="leader-trend">—</span></div>)}</section></>;
}

function LeaderboardPage({ instituteName }: { instituteName: string }) {
  const leaderboardQuery = trpc.leaderboard.list.useQuery();
  const entries = (leaderboardQuery.data ?? []).filter((entry) => !entry.isDemo).map((entry, index) => ({ ...entry, rank: index + 1 }));
  const podium = entries.slice(0, 3);
  return <><PageHeader eyebrow="CAMPUS CONTRIBUTIONS" title="Leaderboard" description={`Recognizing the people making ${instituteName} cleaner, one contribution at a time.`} /><div className="leaderboard-rules"><span><strong>+10</strong> report submitted</span><span><strong>+25</strong> report verified</span><span><strong>+50</strong> cleanup contribution</span><span>Only persisted account contributions are listed</span></div>{leaderboardQuery.isLoading ? <div className="panel empty-state">Loading contribution rankings…</div> : leaderboardQuery.isError ? <div className="panel empty-state">Contribution rankings could not be loaded. Please try again.</div> : entries.length === 0 ? <div className="panel empty-state">No account contributions have been recorded yet.</div> : <><section className="podium-grid">{[1, 0, 2].map((position) => { const entry = podium[position]; return <div className={`podium-card podium-${position + 1}`} key={entry?.id ?? position}>{entry ? <><div className="podium-crown">{position === 0 ? "♛" : position + 1}</div><Avatar user={entry} size="large" /><strong>{entry.displayName}</strong><span>{entry.totalPoints.toLocaleString()} pts</span><small>{`${entry.reportsSubmitted} reports · ${entry.verifiedContributions} verified`}</small></> : <span className="podium-empty">Awaiting contribution</span>}<div className="podium-step">{position + 1}</div></div>; })}</section><section className="panel leaderboard-full"><div className="panel-heading"><div><h3>All contributors</h3><p>Ranked by total points · live from the WasteWise database</p></div><Trophy size={18} className="leaderboard-trophy" /></div><div className="leaderboard-table-head"><span>RANK</span><span>CONTRIBUTOR</span><span>REPORTS</span><span>VERIFIED</span><span>POINTS</span></div>{entries.map((entry) => <div className={`leaderboard-data-row ${entry.isCurrentUser ? "current-user-row" : ""}`} key={entry.id}><strong className="rank-number">{String(entry.rank).padStart(2, "0")}</strong><Avatar user={entry} /><div className="leader-name"><strong>{entry.displayName}{entry.isCurrentUser && <em>You</em>}</strong><small>Authenticated contributor</small></div><span>{entry.reportsSubmitted}</span><span>{entry.verifiedContributions}</span><strong className="leader-score">{entry.totalPoints.toLocaleString()}</strong></div>)}</section></>}</>;
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
  return <><PageHeader eyebrow="CAMPUS OPERATIONS / MAP" title={`${instituteName} campus map`} description="Explore the selected campus reference point and locations configured by its administrator." action={<button className="button button-secondary" onClick={() => { map?.panTo(config.center); map?.setZoom(config.zoom); notify(`Centered on the ${instituteName} map.`); }}><LocateFixed size={15} /> Center campus</button>} /><div className="map-page-grid"><section className="panel live-map-panel"><div className="map-page-toolbar"><div><h3>Interactive campus map</h3><p>Zoom, pan, and select a marker for more detail.</p></div><span className={`map-accuracy-note ${config.isVerified ? "map-source-verified" : ""}`}><Info size={13} /> {config.isVerified ? "Verified campus data" : "Approximate map reference"}</span></div><div className="google-map-wrap"><MapView key={instituteSlug} initialCenter={config.center} initialZoom={config.zoom} onMapReady={(readyMap) => { setMap(readyMap);  locations.forEach((location) => { const marker = L.circleMarker([location.lat, location.lng], { radius: 8 }).addTo(readyMap); marker.bindPopup(`<strong>${escapeHtml(location.name)}</strong><br/><small>${escapeHtml(location.detail)}</small>`); marker.on("click", () => { setSelected(location.id); }); }); }} /></div><div className="map-disclaimer"><ShieldCheck size={14} /><span>{config.isVerified ? "This map configuration is marked verified by an administrator." : `The map search point and configured markers are approximate. They do not confirm official ${instituteName} boundaries or facilities.`}{config.sourceUrl && <> <a href={config.sourceUrl} target="_blank" rel="noreferrer">View OpenStreetMap source</a></>}</span></div></section><aside className="panel map-location-list"><div className="panel-heading"><div><h3>Map locations</h3><p>{locations.length} locations configured for {instituteName}</p></div></div><div className="map-type-legend"><span><i className="map-type-dot campus" /> Campus reference</span><span><i className="map-type-dot landmark" /> Landmark</span><span><i className="map-type-dot bin" /> Waste bin</span><span><i className="map-type-dot collection" /> Collection</span><span><i className="map-type-dot hotspot" /> Hotspot</span></div>{locations.map((location) => <button key={location.id} className={`map-location-row ${selected === location.id ? "map-location-selected" : ""}`} onClick={() => centerSelected(location)}><i className={`map-type-dot ${location.type}`} /><span><strong>{location.name}</strong><small>{location.detail}</small></span><ChevronRight size={15} /></button>)}</aside></div></>;
}

type CampusSearchResult = { place_id: number; display_name: string; lat: string; lon: string; type: string };

function AdminSettingsPage({ instituteName, instituteSlug, notify }: { instituteName: string; instituteSlug: string; notify: (message: string) => void }) {
  const [name, setName] = useState(instituteName);
  const [locationQuery, setLocationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CampusSearchResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<CampusSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const lastSearchAt = useRef(0);
  const mapQuery = trpc.campusMap.config.useQuery({ instituteSlug });
  const utils = trpc.useUtils();
  const update = trpc.institute.update.useMutation({
    onSuccess: async () => {
      notify("Campus name and map reference saved for everyone on this WasteWise deployment.");
      setSearchResults([]);
      setSelectedPlace(null);
      await Promise.all([utils.institute.config.invalidate(), utils.campusMap.config.invalidate()]);
    },
    onError: (error) => notify(error.message),
  });
  const searchCampus = async () => {
    const query = locationQuery.trim();
    if (query.length < 3) { setSearchError("Enter a college location or a city, such as IIT Delhi, New Delhi."); return; }
    const waitMs = 1_000 - (Date.now() - lastSearchAt.current);
    if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    lastSearchAt.current = Date.now();
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    setSelectedPlace(null);
    try {
      const params = new URLSearchParams({ format: "jsonv2", q: `${query}, India`, countrycodes: "in", limit: "5", addressdetails: "0" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Map search returned ${response.status}. Try again shortly.`);
      const results = await response.json() as CampusSearchResult[];
      setSearchResults(results);
      if (results.length === 0) setSearchError("No matching places found. Try adding the city or state to your search.");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Could not search the map right now.");
    } finally {
      setSearching(false);
    }
  };
  const selectedLat = selectedPlace ? Number(selectedPlace.lat) : null;
  const selectedLng = selectedPlace ? Number(selectedPlace.lon) : null;
  const currentCenter = mapQuery.data?.center;
  const unchanged = name.trim() === instituteName && Boolean(currentCenter && selectedLat === currentCenter.lat && selectedLng === currentCenter.lng);
  return <><PageHeader eyebrow="ADMIN / SETTINGS" title="Institute settings" description="Choose the active Indian college and set the map reference students and staff will see." /><div className="settings-layout"><section className="panel settings-card"><div className="settings-section"><div className="settings-icon"><Settings size={18} /></div><div><h3>Active campus</h3><p>The selected college name and map center are saved in TiDB and shown throughout this WasteWise deployment.</p></div></div><label className="settings-field"><span>Institute / college name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. NSUT, IIT Delhi, DTU" maxLength={160} /><small>Type the official college name that should appear in the app.</small></label><label className="settings-field"><span>Find this campus on the map</span><div className="campus-map-search"><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCampus(); } }} placeholder="College, area, city or state" /><button type="button" className="button button-secondary" onClick={() => void searchCampus()} disabled={searching || locationQuery.trim().length < 3}><Search size={15} /> {searching ? "Searching…" : "Search map"}</button></div><small>Search runs only when you press the button. Results use OpenStreetMap place data.</small></label>{searchError && <div className="campus-search-message" role="status">{searchError}</div>}{searchResults.length > 0 && <div className="campus-search-results" aria-label="Map search results">{searchResults.map((place) => <button type="button" key={place.place_id} className={selectedPlace?.place_id === place.place_id ? "campus-result-selected" : ""} onClick={() => setSelectedPlace(place)}><strong>{place.display_name}</strong><small>{place.type} · {Number(place.lat).toFixed(5)}, {Number(place.lon).toFixed(5)}</small></button>)}</div>}{selectedPlace && <div className="campus-search-message campus-search-selected"><CheckCircle2 size={15} /> Map reference selected: {selectedPlace.display_name}</div>}<div className="settings-actions"><span>{selectedPlace ? "Map point selected" : currentCenter ? `Current map point: ${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)}` : "Search and select a campus map point to save"}</span><button className="button button-primary" disabled={update.isPending || name.trim().length < 2 || !selectedPlace || selectedLat === null || selectedLng === null || unchanged} onClick={() => selectedLat !== null && selectedLng !== null && update.mutate({ name, centerLat: selectedLat, centerLng: selectedLng })}>{update.isPending ? "Saving…" : "Save college & map"}</button></div><div className="campus-search-attribution">Search results © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Map points are approximate and require campus review.</div></section><aside className="panel settings-preview"><div className="eyebrow">LIVE PREVIEW</div><div className="settings-preview-brand"><span className="brand-mark"><Recycle size={17} /></span><div><strong>WasteWise</strong><small>SMART CAMPUS OS</small></div></div><div className="settings-preview-campus"><span className="status-pip" /> {name.trim() || "Your institute"}</div>{selectedPlace ? <p className="campus-preview-location"><MapIcon size={14} /> {selectedPlace.display_name}</p> : currentCenter && <p className="campus-preview-location"><MapIcon size={14} /> Saved map point: {currentCenter.lat.toFixed(4)}, {currentCenter.lng.toFixed(4)}</p>}<p>Changing the active campus updates its app label and map reference. This deployment still uses one shared report and user workspace; it does not create separate college accounts or separate report databases.</p><a className="text-button" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map data attribution</a></aside></div></>;
}

function StudentSettingsPage({ go, userName, userEmail, instituteName }: { go: (page: StudentPage) => void; userName: string; userEmail: string; instituteName: string }) {
  return <><PageHeader eyebrow="ACCOUNT SETTINGS" title="Settings" description="Your account and report update preferences for this WasteWise session." /><div className="settings-layout"><section className="panel settings-card"><div className="settings-section"><div className="settings-icon"><UserRound size={18} /></div><div><h3>Google account</h3><p>Your account details are managed by Google sign-in.</p></div></div><div className="settings-field"><span>Name</span><strong>{userName}</strong></div><div className="settings-field"><span>Email</span><strong>{userEmail}</strong></div><div className="settings-actions"><span>Signed in with Google</span><button className="button button-secondary" onClick={() => go("profile")}>View profile</button></div></section><aside className="panel settings-preview"><div className="eyebrow">CAMPUS & REPORT UPDATES</div><div className="settings-preview-campus"><span className="status-pip" /> {instituteName}</div><p>Report statuses refresh automatically while the app is open. Email and push notifications are not configured.</p><div className="settings-actions"><a className="text-button" href="/privacy">Privacy policy</a><a className="text-button" href="/terms">Terms of service</a></div></aside></div></>;
}

function ProfilePage({ go, userName, userEmail, profileImageUrl, instituteName, points, reports }: { go: (page: StudentPage) => void; userName: string; userEmail: string; profileImageUrl: string | null; instituteName: string; points: number; reports: Report[] }) {
  const resolved = reports.filter((report) => report.status === "Resolved").length;
  return <><PageHeader eyebrow="YOUR PROFILE" title={userName} description="Your account details and saved campus report activity." /><div className="profile-layout"><section className="panel profile-card"><div className="profile-cover" /><div className="profile-main"><div className="profile-large-avatar">{profileImageUrl ? <img src={profileImageUrl} alt="" /> : userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><h2>{userName}</h2><p>{userEmail}</p><span className="profile-campus"><MapIcon size={13} /> {instituteName}</span></div></div><div className="profile-stats"><div><strong>{points.toLocaleString()}</strong><span>Contribution points</span></div><div><strong>{reports.length}</strong><span>Reports submitted</span></div><div><strong>{resolved}</strong><span>Reports resolved</span></div></div></section><section className="panel support-card"><div className="support-icon"><Bell size={19} /></div><h3>Report updates</h3><p>Report statuses refresh while the app is open. Email and push notifications are not configured.</p></section></div><div className="profile-layout lower"><section className="panel"><div className="panel-heading"><div><h3>Recent report activity</h3><p>Saved reports and their current status.</p></div></div><div className="history-list">{reports.length ? reports.slice(0, 5).map((report) => <div key={report.id}><span className="history-month">LOG</span><div><strong>{report.issue} Â· {report.location}</strong><small>{report.id} Â· {report.time}</small></div><b>{report.status}</b></div>) : <div className="empty-state">Your submitted reports will appear here.</div>}</div></section><section className="panel support-card"><div className="support-icon"><ClipboardList size={19} /></div><h3>Need to report an issue?</h3><p>Send a sanitation or waste issue to the campus report queue.</p><button className="text-button" onClick={() => go("report")}>Open reporting form <ArrowUpRight size={14} /></button></section></div></>;
}

function Preference({ title, detail, enabled }: { title: string; detail: string; enabled?: boolean }) { const [on, setOn] = useState(Boolean(enabled)); return <div className="preference-row"><div><strong>{title}</strong><span>{detail}</span></div><button className={`toggle ${on ? "toggle-on" : ""}`} onClick={() => setOn(!on)} aria-label={`Toggle ${title}`}><i /></button></div>; }

function AdminWorkspace({ page, go, notify, reports, setReports, instituteName, instituteSlug }: { page: AdminPage; go: (p: AdminPage) => void; notify: (s: string) => void; reports: Report[]; setReports: React.Dispatch<React.SetStateAction<Report[]>>; instituteName: string; instituteSlug: string }) {
  const accessQuery = trpc.admin.access.useQuery();
  if (accessQuery.isLoading) return <div className="auth-loading">Checking admin access…</div>;
  if (accessQuery.error) return <div className="auth-loading">This account does not have admin access.</div>;
  if (page === "reports") return <AdminReports reports={reports} setReports={setReports} notify={notify} />;
  if (page === "bins") return <AdminBins notify={notify} />;
  if (page === "collection") return <CollectionPage notify={notify} />;
  if (page === "sanitation") return <SanitationPage notify={notify} />;
  if (page === "analytics") return <AnalyticsPage notify={notify} />;
  if (page === "users") return <UsersPage notify={notify} instituteName={instituteName} />;
  if (page === "settings") return <AdminSettingsPage instituteName={instituteName} instituteSlug={instituteSlug} notify={notify} />;
  return <AdminOverview go={go} notify={notify} reports={reports} instituteName={instituteName} />;
}

function AdminOverview({ go, notify, reports, instituteName }: { go: (p: AdminPage) => void; notify: (s: string) => void; reports: Report[]; instituteName: string }) {
  const openReports = reports.filter((report) => report.status !== "Resolved");
  const urgentReports = openReports.filter((report) => report.priority === "Urgent");
  const resolvedReports = reports.length - openReports.length;
  const date = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return <><div className="admin-title-row"><div><div className="eyebrow">CAMPUS OPERATIONS / DATABASE-BACKED REPORTS</div><h1>{instituteName} report overview</h1><p>Current student reports and their saved resolution status.</p></div><div className="admin-head-actions"><span className="date-button"><CalendarIcon /> {date}</span><button className="button button-primary" onClick={() => go("reports")}><ClipboardList size={15} /> Open report queue</button></div></div><div className="prototype-strip"><strong>Operational data</strong><span>Reports are stored in the database; bin telemetry, collection routes, and waste weights are not connected.</span></div><div className="stat-grid four admin-stats"><StatCard label="Campus reports" value={String(reports.length)} detail="Persisted student reports" icon={ClipboardList} tone="sky" /><StatCard label="Open reports" value={String(openReports.length)} detail="Awaiting resolution" icon={CircleAlert} tone="coral" /><StatCard label="Urgent reports" value={String(urgentReports.length)} detail="Open reports marked urgent" icon={AlertTriangle} tone="amber" /><StatCard label="Resolved reports" value={String(resolvedReports)} detail="Persisted status updates" icon={CheckCircle2} tone="mint" /></div><section className="panel attention-panel"><div className="panel-heading"><div><h3>Recent reports</h3><p>Sorted from the campus database.</p></div><button className="text-button" onClick={() => go("reports")}>View queue <ArrowUpRight size={14} /></button></div>{reports.length ? <div className="attention-list">{reports.slice(0, 5).map((report) => <div className="attention-row" key={report.id}><div className={`attention-mark ${report.priority.toLowerCase()}`}><CircleAlert size={16} /></div><div className="attention-copy"><strong>{report.issue}</strong><span>{report.location} Â· {report.id}</span></div><div className="attention-meta"><StatusPill status={report.status} /><small>{report.time}</small></div><button className="icon-button" onClick={() => notify(`${report.id} is ${report.status.toLowerCase()}.`)} aria-label={`Show status for ${report.id}`}><Eye size={16} /></button></div>)}</div> : <div className="empty-state">No student reports have been submitted yet.</div>}</section></>;
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
  return <><PageHeader eyebrow="OPERATIONS / REPORTS" title="Student reports" description="Triage, assign, and resolve campus issues from one queue." action={<button className="button button-primary" onClick={() => notify("New task composer opened.")}><Plus size={15} /> Create task</button>} /><div className="filter-bar panel"><div className="map-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by issue, location, or report ID" /></div><div className="filter-tabs compact-tabs">{["All reports", "Reported", "Assigned", "In Progress", "Resolved"].map((item) => <button className={filter === item ? "filter-active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="button button-secondary" onClick={() => notify("Advanced filters opened.")}><SlidersHorizontal size={15} /> Filters</button></div><section className="panel table-panel admin-report-table"><div className="table-head"><span>Report</span><span>Location</span><span>Priority</span><span>Reporter</span><span>Status</span><span>Action</span></div>{filtered.length === 0 ? <div className="empty-state">No saved reports match this filter.</div> : null}{filtered.map((report) => <div className="table-row" key={report.id}><div><strong>{report.issue}</strong><small>{report.id} · {report.time}</small></div><span>{report.location}</span><span className={`priority-label ${report.priority.toLowerCase()}`}><i />{report.priority}</span><span>{report.reporter}</span><StatusPill status={report.status} /><button className="small-action" onClick={() => advance(report.id)}>{report.status === "Resolved" ? "View" : report.status === "Reported" ? "Assign" : "Advance"} <ArrowUpRight size={13} /></button></div>)}</section></>;
}

function AdminBins({ notify }: { notify: (s: string) => void }) { return <><PageHeader eyebrow="PLANNED INTEGRATION" title="Smart-bin monitoring" description="Sensor readings and pickup routing are not connected in this build. This screen is a visual prototype for a future IoT integration." /><div className="panel empty-state"><Wifi size={18} /> No live bin telemetry is configured. Student reports remain available in the reports queue.</div></>; }

function CollectionPage({ notify }: { notify: (s: string) => void }) { return <><PageHeader eyebrow="PLANNED INTEGRATION" title="Collection planning" description="Pickup routes, team assignments, and collection weights are not connected to a database in this build." /><div className="panel empty-state"><Route size={18} /> Collection planning is a future integration. Use the persisted student report queue for this demonstration.</div></>; }

function SanitationPage({ notify }: { notify: (s: string) => void }) { return <><PageHeader eyebrow="PLANNED WORKFLOW" title="Sanitation queue" description="Sanitation tasks and staff assignment records are not stored in this build. Reports about sanitation issues are persisted in the student report queue." action={<button className="button button-secondary" onClick={() => notify("Open the Student reports queue to review saved sanitation reports.")}><ClipboardList size={15} /> Report queue</button>} /><div className="panel empty-state"><ClipboardCheck size={18} /> No separate sanitation-task database is configured.</div></>; }
function SanitationColumn({ title, tone, tasks, advance }: { title: string; tone: string; tasks: { title: string; location: string; assignee: string; status: string }[]; advance: (title: string) => void }) { return <section className={`kanban-column ${tone}`}><div className="kanban-heading"><strong>{title}</strong><span>{tasks.length}</span></div><div className="kanban-tasks">{tasks.map((task) => <div className="task-card" key={task.title}><div className="task-card-top"><span className={`task-priority ${tone}`} /><button className="icon-button"><MoreHorizontal size={15} /></button></div><strong>{task.title}</strong><span><MapIcon size={12} /> {task.location}</span><div className="task-footer"><span className="task-assignee">{task.assignee === "Unassigned" ? <UserRound size={13} /> : task.assignee.split(" ").map((w) => w[0]).join("")}</span><button onClick={() => advance(task.title)}>{title === "Resolved" ? "View" : "Advance"} <ArrowUpRight size={12} /></button></div></div>)}</div></section>; }

function AnalyticsPage({ notify }: { notify: (s: string) => void }) { const reportsQuery = trpc.reports.list.useQuery(undefined, { refetchInterval: 10_000 }); const reports = reportsQuery.data ?? []; const open = reports.filter((report) => report.status !== "Resolved").length; const resolved = reports.length - open; return <><PageHeader eyebrow="DATABASE-BACKED METRICS" title="Report analytics" description="Counts below come from saved student reports. Waste weights, diversion rates, and response-time measurements are not recorded." action={<button className="button button-secondary" onClick={() => void reportsQuery.refetch()}><RefreshCw size={15} /> Refresh</button>} /><div className="analytics-kpis"><StatCard label="Total reports" value={String(reports.length)} detail="Persisted in the database" icon={ClipboardList} tone="sky" /><StatCard label="Open reports" value={String(open)} detail="Awaiting resolution" icon={CircleAlert} tone="amber" /><StatCard label="Resolved reports" value={String(resolved)} detail="Saved resolved status" icon={CheckCircle2} tone="mint" /><StatCard label="Waste collected" value="Not measured" detail="No weight data configured" icon={Recycle} tone="coral" /></div><div className="panel empty-state">Only issue-report counts and statuses are available as analytics in this build.</div></>; }
function StreamRow({ tone, label, value, kg }: { tone: string; label: string; value: string; kg: string }) { return <div className="stream-row"><i className={`dot dot-${tone}`} /><span>{label}</span><strong>{value}</strong><small>{kg}</small></div>; }

function UsersPage({ notify, instituteName }: { notify: (s: string) => void; instituteName: string }) { return <><PageHeader eyebrow="ACCOUNT STATUS" title="Manage users" description={`Google-authenticated accounts are saved for ${instituteName}, but a user-management workflow has not been implemented.`} /><div className="panel empty-state"><Users size={18} /> Sign-in and role checks are active. Admin account management is a future integration.</div></>; }

export default App;
