# Frame — filmjournaal

Een offline-first PWA met React + TypeScript. De filmcollectie staat lokaal in `localStorage`; TMDb wordt alleen gebruikt voor online zoeksuggesties en posters.

## Lokaal starten

```sh
npm install
npm run dev
```

Maak een productiebuild met `npm run build`. De statische site staat daarna in `dist/`.

## Offline gebruiken op iPhone

Een PWA moet eerst vanaf een HTTPS-adres worden geopend (of lokaal via `localhost`) zodat Safari de app-shell kan downloaden en cachen. Publiceer de inhoud van `dist/` op een HTTPS-host, open die URL op je iPhone terwijl je online bent en wacht tot de pagina geladen is. Kies daarna in Safari **Deel → Zet op beginscherm**. Open de app minstens één keer online na een nieuwe release; daarna kan de interface zonder server of internet worden gestart. Filmgegevens blijven lokaal op het toestel opgeslagen. TMDb zoeken en posters ophalen werken alleen online.

Een bladwijzer naar een ontwikkelserver (`npm run dev`) is niet voldoende: die URL is alleen bereikbaar zolang die server actief is. De productie-PWA werkt offline dankzij de service worker nadat de bestanden voor het eerst zijn geladen.

## TMDb instellen

Open **Filmgegevens instellen** en plak je TMDb API Read Access Token (Bearer). Die token wordt in de browser op dit toestel bewaard. Een token in client-side code/opslag is niet geheim; gebruik deze opzet voor persoonlijk gebruik. Een openbare dienst hoort TMDb-aanvragen via een backend te sturen.

Zoeksuggesties en posterafbeeldingen vragen internet. Handmatig films toevoegen en de opgeslagen collectie bekijken blijven offline beschikbaar.

## Trakt-kijkgeschiedenis synchroniseren

Open **TMDb-instellingen**, vul onder **Trakt-synchronisatie** de Client ID en Client Secret van je Trakt API-app in en kies **Trakt-account koppelen**. Open de getoonde Trakt-activatielink, voer de code in en keer terug naar Frame om de koppeling te bevestigen. Daarna kun je **Synchroniseer kijkgeschiedenis** gebruiken. Dit is eenrichtingsverkeer: Trakt-films worden in Frame als gezien toegevoegd of gemarkeerd; lokale beoordelingen en notities blijven behouden. Er worden geen gegevens vanuit Frame naar Trakt gestuurd.

De Trakt Client Secret en toegangstoken worden lokaal in de browser opgeslagen. Omdat Frame een statische client-side app is, zijn deze gegevens niet echt geheim en kunnen ze op dit toestel uitleesbaar zijn. Gebruik deze koppeling alleen voor persoonlijk gebruik; voor een openbare dienst hoort OAuth via een backend te lopen. Synchroniseren vereist internet; de geïmporteerde collectie blijft daarna lokaal beschikbaar.

## Componenten

- `MovieDialog` beheert het formulier en validatie voor toevoegen/bewerken.
- `MovieSearchCombobox` biedt toegankelijke TMDb-autocomplete en toetsenbordbediening.
- `RatingInput`, `MovieCard` en `MovieGrid` zijn herbruikbare presentatielaag-componenten.
- `SettingsDialog` beheert de API-tokeninstelling.
- `useMovieSearch` regelt debounce, annuleren van verouderde verzoeken en laad-/fout-/offline-status.
- `movieRepository` en `tmdb` houden opslag en netwerkverzoeken buiten de componenten.

TMDb attribution: “This product uses the TMDB API but is not endorsed or certified by TMDB.”
