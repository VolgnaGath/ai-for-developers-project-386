import "@typespec/http";

using TypeSpec.Http;

/**
 * Календарь звонков (MVP).
 *
 * Скоуп v1: без авторизации, без личных кабинетов, без внешних интеграций.
 * Владелец календаря — один заранее заданный профиль (админская часть).
 * Гость бронирует слоты без аккаунта и без входа.
 *
 * Доступность (рабочие часы, таймзона, шаг сетки, окно бронирования) —
 * фиксированный конфиг приложения, а не ресурс API (вариант A).
 * Наружу из конфига выставляется только `GET /config` для рендера календаря.
 */
@service(#{ title: "Call Calendar" })
namespace CallCalendar;

// ─────────────────────────────── Модели ───────────────────────────────

/** Тип события, которым управляет владелец. */
model EventType {
  /** Идентификатор. Генерируется сервером. */
  id: string;

  title: string;
  description?: string;

  /** Длительность встречи. В v1 — только два режима. */
  durationMinutes: 15 | 30;
}

/**
 * Тело запроса на создание/изменение типа события.
 * Без `id` — его проставляет сервер; пользователь задаёт только нейминг.
 */
model EventTypeInput {
  title: string;
  description?: string;
  durationMinutes: 15 | 30;
}

/** Статус брони. В v1 — только подтверждённые: отмены/переноса нет. */
enum BookingStatus {
  confirmed,
}

/** Бронирование гостя. */
model Booking {
  id: string;
  eventTypeId: string;

  @minLength(1)
  guestName: string;

  @format("email")
  guestEmail?: string;

  start: utcDateTime;

  /** = `start` + `durationMinutes` типа события. Проставляет сервер. */
  end: utcDateTime;

  status: BookingStatus;
  createdAt: utcDateTime;
}

/** Тело запроса на бронирование. */
model BookingInput {
  eventTypeId: string;

  /** Начало выбранного слота. Должно совпасть с одним из свободных слотов. */
  start: utcDateTime;

  @minLength(1)
  guestName: string;

  @format("email")
  guestEmail?: string;
}

/** Вычисляемый свободный слот (не хранится, только читается гостем). */
model Slot {
  /** Начало слота. Слоты не пересекаются, смежные допустимы: [start, end). */
  start: utcDateTime;

  end: utcDateTime;
}

/** Рабочие часы владельца — фиксированная часть конфига доступности. */
model WorkingHours {
  /** Дни недели приёма (1 = Пн … 7 = Вс). */
  days: int32[];

  /** Начало рабочего окна в таймзоне конфига, например "09:00". */
  start: string;

  /** Конец рабочего окна в таймзоне конфига, например "18:00". */
  end: string;
}

/** Публичная часть конфига доступности — нужна фронту для рендера календаря. */
model PublicConfig {
  /** Например, "Europe/Moscow". */
  timezone: string;

  /** Горизонт бронирования, в v1 — 14. */
  bookingWindowDays: int32;

  /** Шаг сетки свободных слотов в минутах, в v1 — 15. */
  slotStepMinutes: int32;

  workingHours: WorkingHours;
}

// ─────────────────────────────── Ошибки ───────────────────────────────

@error
model NotFound {
  @statusCode statusCode: 404;
  code: "not_found";
}

/** Слот уже занят к моменту брони (в т.ч. гонка двух гостей за один слот). */
@error
model SlotUnavailable {
  @statusCode statusCode: 409;
  code: "slot_unavailable";
}

/** `start` не бьётся с сеткой слотов или лежит вне окна бронирования. */
@error
model InvalidSlot {
  @statusCode statusCode: 422;
  code: "invalid_slot";
}

/** Нельзя удалить тип события, у которого есть существующие брони. */
@error
model EventTypeHasBookings {
  @statusCode statusCode: 409;
  code: "event_type_has_bookings";
}

// ────────────────────── Владелец (админская часть) ──────────────────────

@route("/admin/event-types")
@get
op listEventTypes(): EventType[];

@route("/admin/event-types")
@post
op createEventType(@body body: EventTypeInput): EventType;

@route("/admin/event-types/{id}")
@get
op getEventType(@path id: string): EventType | NotFound;

@route("/admin/event-types/{id}")
@put
op updateEventType(@path id: string, @body body: EventTypeInput): EventType | NotFound;

/**
 * Удалить тип события.
 * 409 — у типа события есть брони, удаление заблокировано.
 */
@route("/admin/event-types/{id}")
@delete
op deleteEventType(@path id: string): void | NotFound | EventTypeHasBookings;

/** Страница предстоящих встреч — общий список бронирований всех типов. */
@route("/admin/bookings")
@get
op listBookings(@query from?: plainDate, @query to?: plainDate): Booking[];

// ────────────────────── Гость (публичная часть) ──────────────────────

@route("/config")
@get
op getConfig(): PublicConfig;

/** Витрина видов брони: название, описание, длительность. */
@route("/event-types")
@get
op browseEventTypes(): EventType[];

@route("/event-types/{id}")
@get
op viewEventType(@path id: string): EventType | NotFound;

/**
 * Свободные слоты для типа события в диапазоне дат.
 *
 * `from` и `to` — календарные даты, трактуются в таймзоне конфига (`PublicConfig.timezone`).
 * Сервер пересекает [from, to] с окном бронирования (14 дней от «сейчас»)
 * и рабочими часами из конфига, нарезает по длительности типа события
 * с шагом `slotStepMinutes` и вычитает пересечения с непогашенными бронями.
 * Слоты не пересекаются, смежные допустимы: [start, end).
 */
@route("/event-types/{id}/slots")
@get
op listSlots(
  @path id: string,
  @query from: plainDate,
  @query to: plainDate,
): Slot[] | NotFound;

/**
 * Создать бронь на выбранный слот.
 *
 * Сервер не доверяет клиенту и заново проверяет свободность `start`:
 *   409 — слот уже занят, 422 — `start` вне сетки/окна, 404 — нет типа события.
 * При успехе `end` и `status: confirmed` проставляет сервер.
 */
@route("/bookings")
@post
op createBooking(@body body: BookingInput): Booking | SlotUnavailable | InvalidSlot | NotFound;
