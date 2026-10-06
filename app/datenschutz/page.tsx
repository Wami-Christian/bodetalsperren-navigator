import Link from "next/link";

export const metadata = { title: "Datenschutz · WamiFishing" };

export default function DatenschutzPage() {
  return <main><section className="page narrow"><div className="panel legal-page">
    <p className="eyebrow">V7.7.2</p>
    <h1>Datenschutzerklärung</h1>
    <p><strong>Verantwortlicher</strong><br/>CCW – Consulting Christian Wamser, Christian Wamser, Tenniswiese 1, 06493 Ballenstedt, Deutschland<br/>E-Mail: <a href="mailto:cw@myccw.de">cw@myccw.de</a> · Telefon: <a href="tel:+493948353402">+49 3948 353402</a></p>

    <h3>Welche Daten WamiFishing verarbeitet</h3>
    <p>Je nach Nutzung verarbeitet WamiFishing insbesondere Name und E-Mail-Adresse, Konto- und Lizenzstatus, Geräte-ID und Geräteinformationen sowie Nutzungszeitpunkte bzw. Nutzungszähler. Bei den Angel-Funktionen können Standortdaten, Favoriten, Fangdaten, Fangfotos, eigene Hotspots, Parkplätze, manuell angelegte Gewässer und weitere vom Nutzer eingegebene Inhalte verarbeitet werden.</p>

    <h3>Cloudspeicherung und lokale Speicherung</h3>
    <p>Ein Teil der App-Daten wird lokal im verwendeten Browser gespeichert. Für angemeldete Nutzer können persönliche Daten und Sicherungen zusätzlich in der Cloud gespeichert werden, damit sie auf freigeschalteten Geräten verfügbar und wiederherstellbar sind. Vorhandene Daten werden bei einer Löschanfrage nicht sofort entfernt; die vollständige Löschung wird über die Administration bestätigt.</p>

    <h3>Freunde und Freigaben</h3>
    <p>Für die Freunde-Funktion werden Anzeigename, Freundescode, Freundschaftsanfragen und bestätigte Verbindungen verarbeitet. Eigene Inhalte bleiben standardmäßig privat. Soweit die App eine Freigabe als „Freunde“ oder „Öffentlich“ anbietet und der Nutzer diese auswählt, können die betreffenden Inhalte entsprechend sichtbar gemacht werden.</p>

    <h3>Jahresfreigabe, Anmeldung und E-Mail</h3>
    <p>Für Zugangsanfragen, Jahresfreigaben und Anmeldecodes werden die angegebenen Konto- und Kontaktdaten verarbeitet. E-Mails von WamiFishing werden über Resend versendet. Die E-Mail-Infrastruktur der Domain myccw.de wird außerdem über IONOS betrieben.</p>

    <h3>Hosting</h3>
    <p>WamiFishing wird über Vercel bereitgestellt. Dabei können technisch notwendige Verbindungs- und Serverdaten verarbeitet werden, um die Anwendung auszuliefern, ihre Sicherheit zu gewährleisten und Fehler zu diagnostizieren.</p>

    <h3>Zwecke der Verarbeitung</h3>
    <p>Die Daten werden verarbeitet, um WamiFishing bereitzustellen, Benutzer und Jahresfreigaben zu verwalten, Geräte zuzuordnen, persönliche Angel-Daten zu speichern und zu synchronisieren, Sicherungen und Wiederherstellungen zu ermöglichen, Freunde- und Freigabefunktionen bereitzustellen sowie notwendige Service- und Anmelde-E-Mails zu versenden.</p>

    <h3>Löschung und Kontoverwaltung</h3>
    <p>Angemeldete Nutzer können in WamiFishing unter „Datenschutz & Konto“ die vollständige Löschung ihres Kontos und der zugehörigen persönlichen Cloud-Daten anfordern. Die Anfrage wird zunächst in der Administration angezeigt. Nach Bestätigung können Konto, Lizenz, registrierte Geräte, persönliche Cloud-Sicherungen, Fänge, Fotos, Hotspots, Parkplätze, Freundeprofil und zugehörige Freigaben endgültig entfernt werden.</p>

    <h3>Betroffenenrechte</h3>
    <p>Betroffene können im Rahmen der gesetzlichen Voraussetzungen insbesondere Auskunft, Berichtigung, Löschung oder Einschränkung der Verarbeitung ihrer personenbezogenen Daten verlangen sowie einer Verarbeitung widersprechen. Anfragen können an <a href="mailto:cw@myccw.de">cw@myccw.de</a> gerichtet werden. Außerdem besteht das Recht, sich bei einer zuständigen Datenschutz-Aufsichtsbehörde zu beschweren.</p>

    <h3>Stand</h3>
    <p>Stand dieser Datenschutzerklärung: 6. Oktober 2026.</p>
    <p><small>Diese Erklärung beschreibt die in WamiFishing vorgesehenen Datenverarbeitungen. Sie ersetzt keine individuelle rechtliche Prüfung des Angebots.</small></p>
    <div className="legal-actions"><Link href="/">← Zurück zu WamiFishing</Link><Link href="/impressum">Impressum</Link></div>
  </div></section></main>;
}
