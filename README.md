# Trading App MVP (Paper Trading)

Projekt zawiera dwa katalogi:
- `backend` - Spring Boot (Java 17, MySQL/XAMPP, JWT, WebSocket)
- `frontend` - React 18 + Vite

## Uruchomienie lokalnie z XAMPP

1. Uruchom XAMPP i wlacz modul `MySQL`.
2. Domyslna konfiguracja backendu zaklada:
   - host: `localhost`
   - port: `3306`
   - baza: `tradingdb`
   - uzytkownik: `root`
   - haslo: puste
3. Mozesz utworzyc baze `tradingdb` w phpMyAdmin, ale nie musisz. Backend ma `createDatabaseIfNotExist=true`, wiec przy standardowym koncie `root` utworzy ja sam.

4. Uruchom backend:
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

5. Uruchom frontend:
```powershell
cd frontend
npm install
npm run dev
```

Backend domyslnie dziala na `http://localhost:8080`, frontend na `http://localhost:5173`.

## Prawdziwe ceny live

Aplikacja wspiera teraz tryb hybrydowy:
- bez klucza `TWELVE_DATA_API_KEY` backend korzysta z lokalnego symulatora cen,
- po ustawieniu `TWELVE_DATA_API_KEY` backend pobiera prawdziwe ceny rynkowe z Twelve Data dla wspieranych symboli i podbija nimi wykresy oraz ticki live,
- aktywnie oglądane symbole sa synchronizowane z frontu do backendu jako `focus symbols`, zeby dostawaly priorytetowe odswiezanie.

Przyklad uruchomienia backendu z feedem live:

```powershell
$env:TWELVE_DATA_API_KEY="twoj_klucz_api"
cd backend
.\mvnw.cmd spring-boot:run
```

Uwagi:
- akcje i ETF-y dzialaja po symbolu bez zmian, np. `AAPL`, `MSFT`, `SPY`,
- forex, krypto i metale sa mapowane do formatu typu `EUR/USD`, `BTC/USD`, `XAU/USD`,
- czesc indeksow i surowcow korzysta z mapowania do symboli Twelve Data, a niewspierane instrumenty zostaja na fallbacku symulacyjnym.

## Zmiana danych logowania do MySQL

Jesli w XAMPP masz inne dane niz `root` i puste haslo, ustaw zmienne srodowiskowe przed startem backendu.

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/tradingdb?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
$env:SPRING_DATASOURCE_USERNAME="twoj_uzytkownik"
$env:SPRING_DATASOURCE_PASSWORD="twoje_haslo"
cd backend
.\mvnw.cmd spring-boot:run
```

## Uruchomienie przez Docker Compose

W katalogu glownym projektu:

```bash
docker compose up --build
```

Uslugi:
- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`
- mysql: `localhost:3306`

## Wazna uwaga o danych

Przy starcie backendu wykonywane sa `schema.sql` i `data.sql`, wiec baza jest odtwarzana z danymi startowymi. To znaczy, ze restart backendu resetuje dane do stanu poczatkowego.

## Domyslni uzytkownicy (seed)

- `test@test.com` / `test123` (USER, saldo startowe 100000)
- `admin@test.com` / `test123` (ADMIN, saldo startowe 100000)

## Przykladowe curl

1. Rejestracja:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@test.com","password":"test123"}'
```

2. Logowanie (odbierz token):
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

3. Zlozenie zlecenia MARKET (podmien TOKEN):
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accountId":1,"symbol":"AAPL","side":"BUY","type":"MARKET","quantity":1}'
```

## Uwagi implementacyjne MVP

- Matching i execution dzialaja transakcyjnie (`@Transactional`) i sa celowo uproszczone.
- Margin jest liczony w prostym modelu notional/leverage, z margin call od progu 80% uzytego marginesu wzgledem balansu.
- Symulator rynku generuje ticki co 1s (mala zmiennosc ~ +/-0.2%), zapisuje je do `market_prices` i pushuje przez WebSocket do `/topic/prices`.
- Potwierdzenia zlecen wysylane sa na `/user/queue/orders` (plus fallback topic per-email).
