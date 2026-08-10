# Saubere Installation mit GitHub Desktop

1. In GitHub Desktop **Branch → Discard all changes** wählen, falls noch ein unvollständiger Versuch offen ist.
2. **Repository → Show in Explorer** öffnen.
3. Im Repository-Ordner alle sichtbaren Projektdateien und -ordner löschen. Den versteckten Ordner `.git` nicht löschen.
4. Den Inhalt dieses Ordners direkt in das Repository kopieren. Nicht den übergeordneten Ordner als Unterordner hineinkopieren.
5. Die oberste Ebene muss danach `app`, `components`, `data`, `lib`, `public`, `package.json` usw. enthalten.
6. In GitHub Desktop als Zusammenfassung eintragen: `Replace project with HarzFishing Navigator V5.2.1`.
7. **Commit to main**, danach **Push origin**.
8. Vercel baut automatisch neu. Bei einem Fehler die letzten Zeilen der Build Logs kopieren.
