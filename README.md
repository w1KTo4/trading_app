# Trading App MVP (Paper Trading)

Projekt zawiera dwa katalogi:
- `backend` - Spring Boot (Java 17, PostgreSQL, JWT, WebSocket)
- `frontend` - React 18 + Vite

## Uruchomienie lokalnie (bez Dockera)

1. Backend:
```bash
cd backend
./mvnw spring-boot:run
```
na Windows (PowerShell):
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

2. Frontend:
```bash
cd frontend
npm install
npm run dev
```

Backend domyœlnie dzia³a na `http://localhost:8080`, frontend na `http://localhost:5173`.

## Uruchomienie przez Docker Compose

W katalogu g³ównym projektu:
```bash
docker-compose up --build
```

Us³ugi:
- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`
- postgres: `localhost:5432`

## Domyœlni u¿ytkownicy (seed)

- `test@test.com` / `test123` (USER, saldo startowe 100000)
- `admin@test.com` / `test123` (ADMIN, saldo startowe 100000)

## Przyk³adowe curl

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

3. Z³o¿enie zlecenia MARKET (podmieñ TOKEN):
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accountId":1,"symbol":"AAPL","side":"BUY","type":"MARKET","quantity":1}'
```

## Uwagi implementacyjne MVP

- Matching i execution dzia³aj¹ transakcyjnie (`@Transactional`) i s¹ celowo uproszczone.
- Margin jest liczony w prostym modelu notional/leverage, z margin call od progu 80% u¿ytego marginesu wzglêdem balansu.
- Symulator rynku generuje ticki co 1s (ma³a zmiennoœæ ~ +/-0.2%), zapisuje je do `market_prices` i pushuje przez WebSocket do `/topic/prices`.
- Potwierdzenia zleceñ wysy³ane s¹ na `/user/queue/orders` (plus fallback topic per-email).
