# Discord Tickets Bot - Dokumentacja Projektu

## Przegląd

Discord Tickets to open-source bot do zarządzania zgłoszeniami (ticketami) na serwerach Discord. Bot umożliwia tworzenie, zarządzanie i archiwizowanie zgłoszeń użytkowników poprzez interaktywne panele, przyciski i menu wyboru.

## Stack Technologiczny

### Backend
- **Node.js** (>=18) - środowisko uruchomieniowe
- **Discord.js** - biblioteka do interakcji z Discord API
- **Fastify** - serwer HTTP dla API i frontendu
- **Prisma ORM** - warstwa dostępu do bazy danych
- **@eartharoid/dbf** - framework do budowy botów Discord
- **@eartharoid/i18n** - system internacjonalizacji

### Frontend
- **SvelteKit** - framework frontendowy (submoduł git w `frontend/`)
- **TailwindCSS** - stylowanie
- **adapter-node** - adapter SvelteKit dla Node.js

### Baza Danych
Obsługiwane są trzy silniki (konfigurowane przez `DB_PROVIDER`):
- **MySQL** (domyślny w Docker)
- **PostgreSQL**
- **SQLite**

Schematy Prisma znajdują się w `db/{mysql,postgresql,sqlite}/schema.prisma`.

### Infrastruktura
- **Docker** + **Docker Compose** - konteneryzacja
- **pnpm** - menedżer pakietów

---

## Struktura Projektu

```
discord-ticket-bot/
├── .api/                    # Dokumentacja API i kontekst dla AI
├── db/                      # Schematy Prisma i migracje
│   ├── mysql/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── postgresql/
│   └── sqlite/
├── frontend/                # Frontend SvelteKit (git submodule)
│   ├── src/
│   │   └── routes/
│   │       └── settings/[guild]/
│   │           ├── panels/  # Zarządzanie panelami
│   │           ├── categories/
│   │           ├── tags/
│   │           └── general/
│   └── build/               # Zbudowany frontend (generowany)
├── src/
│   ├── autocomplete/        # Handlery autocomplete dla slash commands
│   ├── buttons/             # Handlery przycisków
│   ├── commands/
│   │   ├── slash/           # Slash commands (/panel, /new, /close, etc.)
│   │   └── user/            # User context menu commands
│   ├── i18n/                # Pliki tłumaczeń (YAML)
│   ├── lib/
│   │   ├── tickets/         # Logika zarządzania ticketami
│   │   │   ├── manager.js
│   │   │   └── utils.js
│   │   └── logging.js       # System logowania
│   ├── listeners/           # Event listeners Discord.js
│   ├── menus/               # Handlery select menu
│   ├── modals/              # Handlery modali
│   └── routes/              # API routes (Fastify)
│       └── api/
│           └── admin/
│               └── guilds/[guild]/
│                   ├── panels.js      # CRUD paneli
│                   ├── panels/send.js # Wysyłanie paneli
│                   ├── categories/
│                   └── settings.js
├── scripts/                 # Skrypty pomocnicze
├── user/                    # Konfiguracja użytkownika (config.yml)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Kluczowe Funkcjonalności

### 1. System Paneli (Panels)

Panele to zapisane konfiguracje wiadomości z przyciskami/menu do tworzenia ticketów.

#### Modele Prisma

```prisma
model Panel {
  id          Int            @id @default(autoincrement())
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  guild       Guild          @relation(fields: [guildId], references: [id], onDelete: Cascade)
  guildId     String         @db.VarChar(19)
  name        String         @db.VarChar(191)
  title       String?        @db.VarChar(256)
  description String?        @db.Text
  image       String?
  thumbnail   String?
  type        PanelType      @default(BUTTON)
  categories  Json
  messages    PanelMessage[]

  @@unique([guildId, name])
  @@map("panels")
}

model PanelMessage {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  panel     Panel    @relation(fields: [panelId], references: [id], onDelete: Cascade)
  panelId   Int
  channelId String   @db.VarChar(19)
  messageId String   @db.VarChar(19)

  @@unique([channelId, messageId])
  @@map("panelMessages")
}

enum PanelType {
  BUTTON
  MENU
  MESSAGE
}
```

#### API Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/admin/guilds/:guild/panels` | Lista paneli |
| POST | `/api/admin/guilds/:guild/panels` | Utwórz panel |
| PUT | `/api/admin/guilds/:guild/panels` | Aktualizuj panel (+ aktualizuj wiadomości) |
| DELETE | `/api/admin/guilds/:guild/panels` | Usuń panel (+ usuń wiadomości) |
| POST | `/api/admin/guilds/:guild/panels/send` | Wyślij panel na kanał |

#### Slash Command `/panel`

```
/panel panel:<id> [channel:<channel>]
```

- `panel` - ID panelu (autocomplete)
- `channel` - opcjonalny kanał docelowy (domyślnie bieżący)

Pliki:
- `src/commands/slash/panel.js` - komenda
- `src/autocomplete/panel.js` - autocomplete dla ID paneli

### 2. System Ticketów

#### Tworzenie Ticketów
- Przez panele (przyciski/menu)
- Przez slash command `/new`
- Przez user context menu

#### Zarządzanie
- `/close` - zamknij ticket
- `/claim` - przejmij ticket
- `/priority` - ustaw priorytet
- `/move` - przenieś do innej kategorii

### 3. Kategorie

Kategorie definiują typy ticketów z własnymi ustawieniami:
- Nazwa i emoji
- Kanał docelowy
- Role staff
- Pytania (questions) do wypełnienia
- Limity i cooldowny

### 4. Internacjonalizacja (i18n)

Pliki tłumaczeń w `src/i18n/*.yml`:
- `en-GB.yml` - angielski (domyślny)
- `pl.yml` - polski
- + 26 innych języków

Użycie w kodzie:
```javascript
const getMessage = client.i18n.getLocale(settings.locale);
getMessage('menus.category.placeholder'); // "Wybierz kategorię zgłoszenia"
```

Domyślny język serwera jest ustawiany na podstawie `guild.preferredLocale` lub fallback do `en-GB`.

---

## Konfiguracja

### Zmienne Środowiskowe (.env)

```env
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_SECRET=your_oauth_secret

# Database
DB_PROVIDER=mysql
DB_CONNECTION_URL=mysql://user:password@mysql:3306/tickets

# HTTP
HTTP_EXTERNAL=https://your-domain.com
HTTP_HOST=0.0.0.0
HTTP_PORT=8080
HTTP_TRUST_PROXY=true

# Encryption
ENCRYPTION_KEY=your_32_char_key

# Optional
DEFAULT_LOCALE=pl
SUPER=your_discord_user_id
```

### Docker Compose

```yaml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: insecure
      MYSQL_DATABASE: tickets
      MYSQL_USER: tickets
      MYSQL_PASSWORD: insecure
    ports:
      - "3306:3306"
    volumes:
      - tickets-mysql:/var/lib/mysql

  bot:
    build: .
    depends_on:
      - mysql
    env_file: .env
    ports:
      - "8080:8080"
```

---

## Budowanie i Uruchamianie

### Lokalnie

```bash
# Zainstaluj zależności
pnpm install

# Zbuduj frontend
pnpm run build:frontend

# Uruchom bota
pnpm start
```

### Docker

```bash
# Zbuduj obraz (automatycznie buduje frontend)
docker compose build

# Uruchom
docker compose up bot
```

### Migracje Bazy Danych

```bash
# Wygeneruj migrację
npx prisma migrate dev --name nazwa_migracji --schema=db/mysql/schema.prisma

# Zastosuj migracje
npx prisma migrate deploy --schema=db/mysql/schema.prisma
```

---

## Frontend (SvelteKit)

Frontend jest submodulem git w folderze `frontend/`.

### Integracja z Backendem

Backend serwuje zbudowany frontend przez Fastify:

```javascript
// src/http.js
const { handler } = await import('../frontend/build/handler.js');
fastify.all('/*', {}, (req, res) => handler(req.raw, res.raw, () => {}));
```

### Strona Paneli (`frontend/src/routes/settings/[guild]/panels/`)

- `+page.js` - ładowanie danych (kategorie, kanały, panele)
- `+page.svelte` - UI z listą paneli, formularzem tworzenia/edycji

Funkcjonalności:
- Lista zapisanych paneli
- Tworzenie nowego panelu (name, type, categories, title, description, images)
- Edycja istniejącego panelu
- Usuwanie panelu
- Wysyłanie panelu na wybrany kanał

---

## Autoryzacja API

API używa JWT z cookies:
- `/auth/callback` - OAuth2 callback z Discord
- Middleware `fastify.authenticate` - weryfikacja JWT
- Middleware `fastify.isAdmin` - sprawdzenie uprawnień administratora

---

## Logowanie Zdarzeń

System loguje akcje administracyjne:

```javascript
logAdminEvent(client, {
  action: 'create', // create, update, delete, send
  guildId,
  target: {
    id: panel.id.toString(),
    name: panel.name,
    type: 'panel',
  },
  userId: req.user.id,
});
```

---

## Ważne Pliki do Edycji

| Cel | Plik |
|-----|------|
| Nowa slash command | `src/commands/slash/nazwa.js` |
| Nowy autocomplete | `src/autocomplete/nazwa.js` |
| Nowy endpoint API | `src/routes/api/...` |
| Tłumaczenia | `src/i18n/*.yml` |
| Schema bazy | `db/{provider}/schema.prisma` |
| Frontend route | `frontend/src/routes/...` |
| Konfiguracja Docker | `Dockerfile`, `docker-compose.yml` |

---

## Konwencje Kodu

- **ES Modules** w frontendzie, **CommonJS** w backendzie
- **Prisma** dla wszystkich operacji bazodanowych
- **Discord.js Builders** dla komponentów (EmbedBuilder, ButtonBuilder, etc.)
- **Fastify** dla API routes z pattern `module.exports.get/post/put/delete`
- **YAML** dla konfiguracji i tłumaczeń
