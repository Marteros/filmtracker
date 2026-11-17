# Frame — filmjournaal

Een offline-first PWA met React + TypeScript. De filmcollectie staat lokaal in `localStorage`; TMDb wordt via een kleine Cloudflare-proxy gebruikt voor online zoeksuggesties, Ontdekken, details en posters.

## Lokaal starten

```sh
npm install
npm run dev
```

Maak een productiebuild met `npm run build`. De statische site staat daarna in `dist/`.

## Offline gebruiken op iPhone

Een PWA moet eerst vanaf een HTTPS-adres worden geopend (of lokaal via `localhost`) zodat Safari de app-shell kan downloaden en cachen. Publiceer de inhoud van `dist/` op een HTTPS-host, open die URL op je iPhone terwijl je online bent en wacht tot de pagina geladen is. Kies daarna in Safari **Deel → Zet op beginscherm**. Open de app minstens één keer online na een nieuwe release; daarna kan de interface zonder server of internet worden gestart. Filmgegevens blijven lokaal op het toestel opgeslagen. TMDb zoeken en posters ophalen werken alleen online.

Een bladwijzer naar een ontwikkelserver (`npm run dev`) is niet voldoende: die URL is alleen bereikbaar zolang die server actief is. De productie-PWA werkt offline dankzij de service worker nadat de bestanden voor het eerst zijn geladen.

## TMDb via de proxy

Frame gebruikt geen TMDb-sleutel in de browser. Alle TMDb-aanvragen gaan via een Cloudflare Worker die de Bearer-token server-side toevoegt. Daardoor hoeven gebruikers niets in te stellen.

De worker staat op `https://filmtracker-proxy.levonmarteros.workers.dev/`. De code staat in `worker/index.js`; de TMDb-token staat als `TMDB_TOKEN` in de Cloudflare-omgeving. De worker laat alleen de endpoints door die Frame gebruikt en accepteert browserverzoeken vanaf `https://marteros.github.io` en lokale ontwikkeladressen.

De proxy verbergt de sleutel, maar is geen authenticatielaag: de worker-URL is openbaar. Houd het gebruik in de gaten en voeg rate limiting toe als dat nodig is.

Zoeksuggesties, Ontdekken, filmdetails, acteurs en posters vragen internet. De opgeslagen collectie blijft offline beschikbaar.

## Trakt-kijkgeschiedenis synchroniseren

Open **Instellingen**, vul onder **Trakt-synchronisatie** de Client ID van je Trakt API-app in en kies **Trakt-account koppelen**. Meld je aan op Trakt en geef Frame toestemming; Trakt stuurt je daarna terug naar Frame. Daarna kun je **Synchroniseer kijkgeschiedenis** gebruiken. Dit is eenrichtingsverkeer: Trakt-films worden in Frame als gezien toegevoegd of gemarkeerd; lokale beoordelingen en notities blijven behouden. Er worden geen gegevens vanuit Frame naar Trakt gestuurd.

Frame gebruikt Trakts PKCE-aanmeldmethode: er is geen Client Secret nodig. De Client ID en persoonlijke toegangstokens worden lokaal in de browser opgeslagen. Synchroniseren vereist internet; de geïmporteerde collectie blijft daarna lokaal beschikbaar.

## Componenten

- `MovieDialog` beheert het formulier en validatie voor toevoegen/bewerken.
- `MovieSearchCombobox` biedt toegankelijke TMDb-autocomplete en toetsenbordbediening.
- `RatingInput`, `MovieCard` en `MovieGrid` zijn herbruikbare presentatielaag-componenten.
- `SettingsDialog` beheert Trakt-synchronisatie en back-up.
- `useMovieSearch` regelt debounce, annuleren van verouderde verzoeken en laad-/fout-/offline-status.
- `movieRepository` en `tmdb` houden opslag en netwerkverzoeken buiten de componenten.

TMDb attribution: “This product uses the TMDB API but is not endorsed or certified by TMDB.”
