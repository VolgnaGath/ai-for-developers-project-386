# План реализации фронтенда

## Стек

- React, TypeScript и Vite.
- Mantine Core, Form, Dates и Notifications.
- React Router.
- TanStack Query.
- `openapi-typescript` и `openapi-fetch`.
- Day.js с поддержкой UTC и временных зон.
- Prism CLI для mock API.
- Vitest, Testing Library, MSW и Playwright.
- CSS Modules для точной компоновки по UI-референсам.

## Структура репозитория

```text
/
├── main.tsp
├── tspconfig.yaml
├── tsp-output/
│   └── schema/openapi.yaml
├── package.json
├── README.md
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── app/
        │   ├── App.tsx
        │   ├── router.tsx
        │   ├── providers.tsx
        │   └── theme.ts
        ├── layouts/
        │   ├── PublicLayout.tsx
        │   └── AdminLayout.tsx
        ├── pages/
        │   ├── LandingPage/
        │   ├── EventTypesPage/
        │   ├── BookingPage/
        │   ├── BookingSuccessPage/
        │   ├── AdminBookingsPage/
        │   ├── AdminEventTypesPage/
        │   └── AdminEventTypeFormPage/
        ├── features/
        │   ├── booking/
        │   │   ├── CalendarPicker.tsx
        │   │   ├── SlotList.tsx
        │   │   └── BookingForm.tsx
        │   └── event-types/
        │       └── EventTypeForm.tsx
        ├── shared/
        │   ├── api/
        │   │   ├── generated.ts
        │   │   ├── client.ts
        │   │   ├── config.ts
        │   │   ├── eventTypes.ts
        │   │   ├── bookings.ts
        │   │   └── errors.ts
        │   ├── date/
        │   │   └── timezone.ts
        │   └── ui/
        └── test/
            └── mocks/
```

Корневой проект станет npm workspace, но frontend сохранит отдельный `package.json` и самостоятельный production build.

## Маршруты и API

| Маршрут | Экран | API |
| --- | --- | --- |
| `/` | Лендинг | Не требуется |
| `/book` | Выбор типа события | `GET /event-types` |
| `/book/:id` | Календарь, слоты и форма | `GET /config`, `GET /event-types/{id}`, `GET /event-types/{id}/slots`, `POST /bookings` |
| `/book/success` | Подтверждение брони | Результат `POST /bookings` |
| `/admin` | Перенаправление на встречи | Не требуется |
| `/admin/bookings` | Предстоящие встречи | `GET /admin/bookings`, `GET /admin/event-types` |
| `/admin/event-types` | Управление типами | `GET /admin/event-types`, `DELETE /admin/event-types/{id}` |
| `/admin/event-types/new` | Создание типа | `POST /admin/event-types` |
| `/admin/event-types/:id/edit` | Редактирование типа | `GET`, `PUT /admin/event-types/{id}` |

Административные страницы остаются открытыми, как определено контрактом. Frontend не создает фиктивную авторизацию.

## Адаптация UI-референсов

- Сохранить светлый фон, оранжевый акцент, сине-персиковый градиент лендинга, тонкие границы и скругленные карточки.
- Использовать ширину контента около `1120px` и шапку высотой около `60px`.
- На экране бронирования использовать три колонки: описание, календарь, доступные слоты или форма.
- На планшете и мобильном экраны перестраивать в одну колонку.
- Исключить профиль Host: имени и аватара владельца нет в API.
- Показывать только свободные слоты. API не позволяет достоверно определить занятые интервалы.
- Не добавлять поле заметок: оно отсутствует в `BookingInput`.
- После выбора слота заменять содержимое правой колонки формой имени и необязательного email.
- Добавить состояния загрузки, пустого результата, ошибки и повторного запроса.

## API-интеграция

- Генерировать типы только из `tsp-output/schema/openapi.yaml`.
- Не создавать ручные копии `EventType`, `Booking` и `Slot`.
- Задавать адрес API через `VITE_API_BASE_URL`.
- Не полагаться на Vite proxy: production build должен напрямую работать с отдельно запущенным backend.
- Настроить CORS backend для origin frontend.
- Отображать даты в `PublicConfig.timezone`.
- Передавать в `POST /bookings` исходную строку `Slot.start`, не вычисляя начало или конец слота на frontend.
- При `404` показывать состояние отсутствующего ресурса.
- При `409 slot_unavailable` сбрасывать выбранный слот и обновлять их список.
- При `422 invalid_slot` предлагать выбрать другой слот.
- При `409 event_type_has_bookings` сохранять тип события и показывать причину отказа удаления.
- После мутаций инвалидировать соответствующие кэши TanStack Query.

## Prism

1. Добавить Prism в корневые dev-зависимости.
2. Добавить `npm run api:mock`, запускающий `tsp-output/schema/openapi.yaml` на порту `4010`.
3. Дополнить `main.tsp` примерами config, event types, slots, booking и ошибок без изменения семантики API.
4. Перегенерировать OpenAPI.
5. Использовать MSW для stateful и негативных сценариев: Prism не хранит созданные брони и не блокирует слот после `POST`.

## Этапы реализации

1. Настроить npm workspace и Vite-приложение.
2. Подключить Mantine, тему, роутер и общие layouts.
3. Настроить генерацию API-типов и клиент.
4. Добавить примеры контракту и запуск Prism.
5. Реализовать лендинг и выбор типа события.
6. Реализовать календарь, свободные слоты, форму и подтверждение.
7. Реализовать административный список встреч и CRUD типов событий.
8. Добавить адаптивность, доступность и все состояния запросов.
9. Покрыть логику временных зон, формы и ошибки unit-тестами.
10. Добавить Playwright-сценарии гостевого бронирования и административного CRUD.
11. Обновить README инструкциями запуска с Prism и отдельно запущенным backend.

## Проверка результата

- TypeSpec компилируется без ошибок.
- OpenAPI и сгенерированные TypeScript-типы синхронизированы.
- Frontend проходит typecheck, lint, тесты и production build.
- UI проверен на ширинах `375px`, `768px` и `1400px`.
- Успешный сценарий работает с Prism.
- Ошибочные и конкурентные сценарии работают через MSW.
- Смена `VITE_API_BASE_URL` подключает UI к отдельно запущенному backend без изменения кода.
