import { ArrowRight, BookOpen, ClipboardList, Recycle, ShieldCheck, Sparkles } from "lucide-react";
import { startLogin } from "../const";
import { trpc } from "../lib/trpc";

export default function PublicHome() {
  const instituteQuery = trpc.institute.config.useQuery();
  const instituteName = instituteQuery.data?.name ?? "your campus";
  return <div className="public-home">
    <header className="public-header">
      <a className="public-brand" href="/"><span className="brand-mark"><Recycle size={19} strokeWidth={2.7} /></span><span><strong>WasteWise</strong><small>SMART CAMPUS OS</small></span></a>
      <nav className="public-nav"><a href="#how-it-works">How it works</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><button className="button button-primary public-signin" onClick={() => startLogin()}>Sign in with Google <ArrowRight size={15} /></button></nav>
    </header>
    <main>
      <section className="public-hero">
        <div className="public-hero-copy"><div className="public-kicker"><span className="status-pip" /> {instituteName.toUpperCase()} · CAMPUS SUSTAINABILITY</div><h1>A cleaner campus, powered by <em>small actions.</em></h1><p>WasteWise helps students report sanitation issues, learn correct waste segregation, and see how everyday choices improve campus wellbeing at {instituteName}.</p><div className="public-hero-actions"><button className="button button-primary" onClick={() => startLogin()}>Get started with Google <ArrowRight size={15} /></button><a className="public-text-link" href="#how-it-works">Learn how it works <ArrowRight size={14} /></a></div><div className="public-trust"><ShieldCheck size={15} /> Secure Google sign-in · Built for campus communities</div></div>
        <div className="public-hero-art"><div className="public-orbit orbit-one" /><div className="public-orbit orbit-two" /><div className="public-hero-card"><div className="public-hero-card-icon"><Recycle size={28} /></div><span>THIS MONTH</span><strong>8,420 kg</strong><small>waste diverted across campus</small><div className="public-progress"><i /></div><b>+14.2% <small>vs last month</small></b></div><div className="public-leaf leaf-one">✦</div><div className="public-leaf leaf-two">✦</div></div>
      </section>
      <section className="public-purpose" id="how-it-works"><div><div className="public-kicker">ONE WORKSPACE · THREE SIMPLE ACTIONS</div><h2>Make {instituteName === "your campus" ? "campus" : `${instituteName} campus`} care part of your everyday routine.</h2></div><p>WasteWise brings reporting, education, and campus operations into one approachable workspace. It is a student project designed to make sustainability visible, practical, and collaborative.</p></section>
      <section className="public-features"><Feature icon={ClipboardList} tone="coral" title="Report an issue" text="Tell the campus team about overflowing bins, leaks, sanitation issues, or incorrect segregation." /><Feature icon={BookOpen} tone="sky" title="Learn what goes where" text="Use clear guidance to identify wet, dry, e-waste, and sanitary waste correctly." /><Feature icon={Sparkles} tone="mint" title="See your impact" text="Track participation, points, and the collective progress toward a cleaner campus." /></section>
      <section className="public-cta"><div><div className="public-kicker">READY TO TAKE PART?</div><h2>Every report and every correct bin choice helps.</h2></div><button className="button button-primary" onClick={() => startLogin()}>Enter WasteWise <ArrowRight size={15} /></button></section>
    </main>
    <footer className="public-footer"><span>© 2026 WasteWise student project</span><span><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></span></footer>
  </div>;
}

function Feature({ icon: Icon, tone, title, text }: { icon: typeof Recycle; tone: string; title: string; text: string }) {
  return <article className="public-feature"><div className={`public-feature-icon ${tone}`}><Icon size={19} /></div><h3>{title}</h3><p>{text}</p><a href="/" onClick={event => { event.preventDefault(); startLogin(); }}>Try it <ArrowRight size={13} /></a></article>;
}
