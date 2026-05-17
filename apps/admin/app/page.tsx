import { policyPrecedence } from "@virtual-school/shared";

const setupItems = [
  "Create tenant profile",
  "Import roster",
  "Select policy template",
  "Configure app catalog",
  "Generate enrollment batch",
  "Enroll first device"
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Virtual School MDM</h1>
          <p className="subtitle">Phase 1 Android managed learning device platform</p>
        </div>
        <span className="badge">Milestone 1 Foundation</span>
      </header>

      <section className="grid" aria-label="Platform metrics">
        <article className="card">
          <span className="label">Tenants</span>
          <strong className="metric">0</strong>
        </article>
        <article className="card">
          <span className="label">Managed devices</span>
          <strong className="metric">0</strong>
        </article>
        <article className="card">
          <span className="label">Open alerts</span>
          <strong className="metric">0</strong>
        </article>
        <article className="card">
          <span className="label">Policy modes</span>
          <strong className="metric">{Object.keys(policyPrecedence).length}</strong>
        </article>
      </section>

      <section className="card">
        <h2>First-run setup checklist</h2>
        <ul className="list">
          {setupItems.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <span className="label">Pending</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
