import { ArrowLeft, ExternalLink, Recycle } from "lucide-react";

type LegalPageKind = "privacy" | "terms";

const effectiveDate = "September 7, 2026";

export default function LegalPage({ kind }: { kind: LegalPageKind }) {
  const isPrivacy = kind === "privacy";
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <a className="legal-brand" href="/" aria-label="Back to WasteWise home">
          <span className="brand-mark"><Recycle size={19} strokeWidth={2.7} /></span>
          <span><strong>WasteWise</strong><small>SMART CAMPUS OS</small></span>
        </a>
        <a className="legal-back" href="/"><ArrowLeft size={15} /> Back to WasteWise</a>
      </header>
      <main className="legal-main">
        <div className="legal-kicker">WASTEWISE · CAMPUS COMMUNITY</div>
        <h1>{isPrivacy ? "Privacy Policy" : "Terms of Service"}</h1>
        <p className="legal-intro">{isPrivacy
          ? "A simple explanation of how WasteWise handles information when you use this student project."
          : "The straightforward rules for using WasteWise as a campus sanitation and sustainability workspace."}</p>
        <div className="legal-meta">Effective {effectiveDate} · Last updated {effectiveDate}</div>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}

        <section className="legal-contact">
          <h2>Questions</h2>
          <p>For questions about this project or a request concerning your information, contact the WasteWise project administrator through the campus project channel.</p>
        </section>
      </main>
      <footer className="legal-footer">
        <span>© 2026 WasteWise student project</span>
        <span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span>
      </footer>
    </div>
  );
}

function PrivacyContent() {
  return <div className="legal-sections">
    <section><h2>1. Information we collect</h2><p>When you sign in with Google, WasteWise receives basic account information made available by Google, such as your name, email address, profile image, and a Google account identifier. The application also stores your WasteWise account role and the date your account was created or last used.</p><p>If you use campus features, you may also provide information such as issue reports, locations, descriptions, images, waste classifications, and activity or points associated with your account.</p></section>
    <section><h2>2. How we use information</h2><p>We use this information to authenticate you, maintain your account, display your profile, process campus sanitation reports, support administrator workflows, and demonstrate sustainability features for this student project. We do not use your information for advertising or sell it to third parties.</p></section>
    <section><h2>3. Google sign-in</h2><p>Google OAuth is used only to sign you in. WasteWise does not receive or store your Google password. Google handles the authentication step under its own <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy <ExternalLink size={12} /></a>.</p></section>
    <section><h2>4. Sharing and service providers</h2><p>Information may be processed by the hosting, database, and authentication services needed to operate the application. Access is limited to what is necessary for the project. We do not sell personal information or share it for unrelated marketing.</p></section>
    <section><h2>5. Retention and security</h2><p>Account and project data may be retained for as long as the student project requires. We use server-side sessions, protected backend procedures, and environment-held credentials. No online service can guarantee absolute security, so please avoid submitting sensitive personal information in reports.</p></section>
    <section><h2>6. Your choices</h2><p>You may stop using WasteWise at any time and revoke its Google account access from your Google account settings. To request correction or deletion of project data, contact the project administrator. Because this is a student project, requests may require manual handling.</p></section>
    <section><h2>7. Changes to this policy</h2><p>This policy may be updated as the project evolves. Material changes will be reflected on this page with a new effective date.</p></section>
  </div>;
}

function TermsContent() {
  return <div className="legal-sections">
    <section><h2>1. Accepting these terms</h2><p>By accessing WasteWise, you agree to use it responsibly and in accordance with these Terms. If you do not agree, please do not use the application.</p></section>
    <section><h2>2. Project purpose</h2><p>WasteWise is a student project for demonstrating campus sanitation reporting, waste education, sustainability tracking, and operational dashboards. Some campus metrics, charts, maps, and sensor information may be simulated or illustrative rather than live operational data.</p></section>
    <section><h2>3. Your account</h2><p>You are responsible for using your own Google account and keeping your account access secure. Do not impersonate another person, share access improperly, or attempt to bypass role restrictions. Administrator permissions are assigned by the project backend and are not transferable through the user interface.</p></section>
    <section><h2>4. Acceptable use</h2><p>You agree not to misuse the service, submit knowingly false or harmful reports, upload unlawful or malicious content, interfere with the application, probe its security, or access data and functions that are not intended for your role.</p></section>
    <section><h2>5. User submissions</h2><p>You retain responsibility for content you submit. By submitting a report or other content, you give the project permission to store and display it as needed to provide the related WasteWise feature. Do not include passwords, financial information, medical details, or other sensitive information in submissions.</p></section>
    <section><h2>6. Availability and changes</h2><p>WasteWise is provided as-is for educational and demonstration purposes. Features may change, be interrupted, or be removed as the project develops. The application is not a substitute for official emergency, facilities, health, or safety reporting channels.</p></section>
    <section><h2>7. Disclaimer and limitation</h2><p>To the extent allowed by law, the project team is not responsible for losses arising from reliance on simulated information, service interruptions, or user-submitted content. Use official campus channels for urgent sanitation, safety, or maintenance issues.</p></section>
    <section><h2>8. Updates to these terms</h2><p>These Terms may be updated as the project evolves. Continued use after an update means you accept the revised Terms.</p></section>
  </div>;
}
