# Trading App MVP (Paper Trading)

Projekt zawiera dwa katalogi:
- `backend` - Spring Boot (Java 17, MySQL/XAMPP, JWT, WebSocket)
- `frontend` - React 18 + Vite

## Start od zera na nowym komputerze

1. Zainstaluj:
- `Git`
- `Java 17` (JDK)
- `Node.js 20+`
- `XAMPP` (uruchamiany tylko modul MySQL)

2. Sklonuj projekt:
```bash
git clone <URL_REPO>
cd trading_app
```

3. Sprawdz wersje:
```bash
java -version
node -v
npm -v
```

### Szybki start w 6 krokach (z ngrok)

1. Sklonuj repo i wejdz do katalogu projektu.
```cmd
git clone <URL_TWOJEGO_REPO>
cd trading_app
```

2. Uruchom MySQL w XAMPP (przycisk `Start` przy `MySQL`).

3. Uruchom ngrok w osobnym terminalu i skopiuj adres `https://...ngrok-free.dev`.
```cmd
ngrok http 8080
```

4. Uruchom backend z ustawionymi zmiennymi TrustPay (w drugim terminalu).
```cmd
cd backend
set TRUSTPAY_PUBLIC_BASE_URL=https://TWOJ-URL.ngrok-free.dev
set TRUSTPAY_STORE_NAME=TU_DOKLADNY_STORE_NAME_Z_TRUSTPAY
set WEBHOOK_SECRET_TRUSTPAY=TU_DOKLADNY_SECRET_Z_TRUSTPAY
set TRUSTPAY_REQUIRE_WEBHOOK_SIGNATURE=false
set APP_CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:*,http://127.0.0.1:*,https://trustpay-iota.vercel.app
.\mvnw.cmd spring-boot:run
```

5. Uruchom frontend (w trzecim terminalu).
```cmd
cd frontend
npm install
npm run dev
```

6. Otworz aplikacje i zaloguj sie:
- frontend: `http://localhost:5173`
- konto testowe: `test@test.com` / `test123`

## Uruchomienie lokalnie z XAMPP

1. Uruchom XAMPP i wlacz modul `MySQL`.
2. Domyslna konfiguracja backendu:
   - host: `localhost`
   - port: `3306`
   - baza: `tradingdb`
   - uzytkownik: `root`
   - haslo: puste
3. Bazy nie musisz tworzyc recznie. Backend ma `createDatabaseIfNotExist=true`.

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

## Dane rynkowe i wykresy

Aplikacja dziala w modelu hybrydowym bez platnych kluczy API:
- przy starcie backend bootstrappuje historie swiec (domyslnie 400 swiec 15m) z publicznego Binance REST,
- w runtime ceny sa odswiezane przez delayed provider (Binance REST) i pushowane po WebSocket,
- gdy provider chwilowo nie odpowiada, wlacza sie fallback symulacyjny z realistyczniejsza dynamika ruchu,
- endpoint swiec ma dodatkowy fallback, ktory dopelnia historie do sensownej liczby swiec (zamiast jednej swiecy na starcie),
- symbole aktywnie ogladane na froncie trafiaja do `focus symbols` i dostaja szybsze odswiezanie.

Domyslna lista instrumentow obejmuje wiele klas aktywow:
- krypto,
- indeksy,
- surowce i metale,
- forex,
- akcje,
- ETF.

Krypto korzysta z zewnetrznych snapshotow Binance (gdy dostepne), a pozostale klasy sa automatycznie podtrzymywane przez symulator tickow i maja pelne wykresy swiec tak jak krypto.

Przykladowe zmienne do strojenia feedu:

```powershell
$env:MARKET_DATA_ENABLED="true"
$env:MARKET_DATA_BASE_URL="https://api.binance.com"
$env:MARKET_DATA_BOOTSTRAP_TIMEFRAME="15m"
$env:MARKET_DATA_BOOTSTRAP_CANDLES="400"
cd backend
.\mvnw.cmd spring-boot:run
```

## TrustPay (wplaty) + wyplaty

Logika konta startuje od `0.00` i zasilanie odbywa sie przez TrustPay (kod 6-cyfrowy) oraz webhook.

Wazne:
- webhook musi byc publicznie dostepny (localhost bez tunelu nie odbierze webhooka z TrustPay),
- `TRUSTPAY_PUBLIC_BASE_URL` musi wskazywac na publiczny URL backendu (nie frontendu),
- w aplikacji kwoty konta i P&L sa prezentowane jako PLN, a ceny instrumentow zostaja w USD.
- wyplata w tej wersji jest wewnetrzna (zmniejsza saldo w aplikacji), nie robi realnego przelewu bankowego.

Przykladowe zmienne:

```powershell
$env:TRUSTPAY_ENABLED="true"
$env:TRUSTPAY_SUBMIT_URL="https://trustpay-backend-1orv.onrender.com/api/v1/payments/submit-code"
$env:TRUSTPAY_STORE_NAME="TwojStoreName"
$env:WEBHOOK_SECRET_TRUSTPAY="twoj-sekret-z-trustpay"
$env:TRUSTPAY_PUBLIC_BASE_URL="https://twoj-publiczny-backend-host"
$env:TRUSTPAY_REQUIRE_WEBHOOK_SIGNATURE="false"
$env:APP_CORS_ALLOWED_ORIGIN_PATTERNS="http://localhost:*,http://127.0.0.1:*,https://trustpay-iota.vercel.app"
cd backend
.\mvnw.cmd spring-boot:run
```

Jesli `WEBHOOK_SECRET_TRUSTPAY` nie jest ustawiony, backend uzyje domyslnego sekretu developerskiego (`TRUSTPAY_DEV_WEBHOOK_SECRET`, domyslnie `trustpay-local-dev-secret`), zeby nie blokowac flow testowego.

### TrustPay lokalnie (ngrok) - krok po kroku

1. Uruchom backend lokalnie na `8080`.
2. W osobnym terminalu uruchom tunel:
```bash
ngrok http 8080
```
3. Skopiuj adres `https://...ngrok-free.dev` i ustaw go jako `TRUSTPAY_PUBLIC_BASE_URL`.
4. Ustaw zmienne i uruchom backend ponownie.

PowerShell:
```powershell
$env:TRUSTPAY_PUBLIC_BASE_URL="https://twoj-adres.ngrok-free.dev"
$env:TRUSTPAY_STORE_NAME="TwojStoreName"
$env:WEBHOOK_SECRET_TRUSTPAY="TwojSekret"
$env:TRUSTPAY_REQUIRE_WEBHOOK_SIGNATURE="false"
cd backend
.\mvnw.cmd spring-boot:run
```

CMD:
```cmd
set TRUSTPAY_PUBLIC_BASE_URL=https://twoj-adres.ngrok-free.dev
set TRUSTPAY_STORE_NAME=TwojStoreName
set WEBHOOK_SECRET_TRUSTPAY=TwojSekret
set TRUSTPAY_REQUIRE_WEBHOOK_SIGNATURE=false
cd backend
.\mvnw.cmd spring-boot:run
```

5. Nie zamykaj ngrok podczas testow.

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

Przy starcie backendu wykonywane sa `schema.sql` i `data.sql`, wiec baza jest odtwarzana z danymi startowymi. Restart backendu resetuje dane do stanu poczatkowego.

## Domyslni uzytkownicy (seed)

- `test@test.com` / `test123` (USER, saldo startowe 0)
- `admin@test.com` / `test123` (ADMIN, saldo startowe 0)

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
  -d '{"accountId":1,"symbol":"BTCUSD","side":"BUY","type":"MARKET","quantity":0.01}'
```

## Uwagi implementacyjne MVP

- Matching i execution dzialaja transakcyjnie (`@Transactional`) i sa celowo uproszczone.
- Margin jest liczony w prostym modelu notional/leverage, z margin call od progu 80% uzytego marginesu wzgledem balansu.
- Ticki sa zapisywane do `market_prices` i pushowane przez WebSocket do `/topic/prices`.
- Potwierdzenia zlecen sa wysylane na `/user/queue/orders` (plus fallback topic per-email).
