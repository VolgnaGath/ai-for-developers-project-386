# AGENTS.md

Call Calendar — бронирование звонков: владелец публикует типы событий, гости бронируют слоты без аккаунта. Перед любой работой читай `CONTEXT.md` (глоссарий доменных терминов): домен — на русском, код и API — на английском.

## Структура

- **Бэкенда нет.** API-контракт — только TypeSpec: `main.tsp` → `npm run generate` → `tsp-output/schema/openapi.yaml` (закоммичен). После правок `main.tsp` перегенерируй и закоммить и сгенерированный файл.
- **Фронтенд** — npm workspace `frontend/` (Vite + React 19 + Mantine 8 + React Router + TanStack Query). Вход: `frontend/src/main.tsx`; маршруты: `frontend/src/app/router.tsx`; страницы: `frontend/src/pages/`; API-клиент и общие модули: `frontend/src/shared/`.
- `FRONTEND_PLAN.md` — план и принятые решения фронта; `docs/adr/` — ADR (в т.ч. вся календарная логика живёт в `PublicConfig.timezone`).

## Команды (из корня)

- `npm run dev` — Vite dev на порту 5173 (`strictPort`; порт занят — не запустится, не меняй порт).
- `npm run typecheck` — проверка типов фронта.
- `npm run build` — прод-сборка фронта (`tsc -b && vite build`).
- `npm test` — юнит-тесты фронта (Vitest).
- `npm run e2e` — Playwright e2e (поднимает отдельный Vite на 5199, MSW перехватывает запросы; браузеры ставит `npx playwright install chromium`).
- `npm run check` — компиляция TypeSpec без генерации.
- `npm run generate` — генерация OpenAPI из `main.tsp`.
- `npm run api:mock` — мок-сервер Prism (`prism mock tsp-output/schema/openapi.yaml -p 4010`), совпадает с `VITE_API_BASE_URL` в `.env.example`.

## Готовые ловушки

- Адрес API задаётся только через `VITE_API_BASE_URL` (`frontend/.env.example`); Vite-прокси нет — прод-сборка работает с отдельно запущенным backend.
- Мок-сервер Prism (`npm run api:mock`, порт 4010) работает на примерах из `main.tsp` (`@example`/`@opExample`). Это ограничение Prism: примеры слотов статичны и со временем выходят из окна бронирования; stateful/негативные сценарии покрыты MSW в e2e (`frontend/src/test/mocks/handlers.ts`). Новые примеры добавляй в `main.tsp` и перегенерируй OpenAPI.
- **Нет lint.** Тесты: Vitest (юниты) и Playwright+MSW (e2e). Проверка после правок: `npm run typecheck` + `npm run check`; для фронта — ещё `npm test` и `npm run e2e`.
- Не создавай ручные копии типов `EventType`/`Booking`/`Slot` — они генерятся из OpenAPI и ре-экспортируются из `shared/api`.
- `.github/workflows/hexlet-check.yml` — системный CI Hexlet, не редактируй его и README-бейдж; тесты Hexlet идут на каждый push.

## Рабочий процесс

Каждое изменение — отдельный commit и push в `main`.
