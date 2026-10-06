import Link from "next/link";

export const metadata = { title: "Impressum · WamiFishing" };

export default function ImpressumPage() {
  return <main><section className="page narrow"><div className="panel legal-page">
    <p className="eyebrow">V7.7.2</p>
    <h1>Impressum</h1>
    <p><strong>Angaben zum Anbieter</strong></p>
    <p>CCW – Consulting Christian Wamser<br/>Christian Wamser<br/>Tenniswiese 1<br/>06493 Ballenstedt<br/>Deutschland</p>
    <p>Telefon: <a href="tel:+493948353402">+49 3948 353402</a><br/>E-Mail: <a href="mailto:cw@myccw.de">cw@myccw.de</a></p>
    <p><strong>Verantwortlich für die Inhalte:</strong><br/>Christian Wamser, Anschrift wie oben.</p>
    <p><small>Die betriebliche Steuernummer wird nicht öffentlich angegeben. Eine Umsatzsteuer-Identifikationsnummer ist derzeit nicht angegeben.</small></p>
    <div className="legal-actions"><Link href="/">← Zurück zu WamiFishing</Link><Link href="/datenschutz">Datenschutz</Link></div>
  </div></section></main>;
}
