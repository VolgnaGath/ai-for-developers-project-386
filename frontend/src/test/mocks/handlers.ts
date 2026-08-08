import { http, HttpResponse } from 'msw';
import type { Booking, BookingInput, PublicConfig, Slot } from '../../shared/api/bookings';
import type { EventType, EventTypeInput } from '../../shared/api/eventTypes';
import { todayInZone } from '../../shared/date/timezone';

const CONFIG_TIMEZONE = 'Europe/Moscow';
const SLOT_TIMES = ['09:00', '10:00', '11:00'];
const SLOT_DAYS_AHEAD = 3;

export interface MockDb {
  config: PublicConfig;
  eventTypes: EventType[];
  bookings: Booking[];
  unavailableStarts: Set<string>;
  nextBookingId: number;
  nextEventTypeId: number;
  conflictOnNextBooking: boolean;
  invalidSlotOnNextBooking: boolean;
}

function createMockDb(): MockDb {
  const config: PublicConfig = {
    timezone: CONFIG_TIMEZONE,
    bookingWindowDays: 14,
    slotStepMinutes: 15,
    workingHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
  };

  const eventTypes: EventType[] = [
    {
      id: 'event-type-consultation',
      title: 'Консультация',
      description: 'Разбор проекта и ответы на вопросы',
      durationMinutes: 30,
    },
    {
      id: 'event-type-onboarding',
      title: 'Онбординг',
      durationMinutes: 15,
    },
  ];

  const start = todayInZone(CONFIG_TIMEZONE).add(1, 'day').hour(14).minute(0).second(0).millisecond(0);
  const end = start.add(30, 'minute');

  const booking: Booking = {
    id: 'booking-1',
    eventTypeId: 'event-type-consultation',
    guestName: 'Иван Петров',
    guestEmail: 'ivan.petrov@example.com',
    start: start.toISOString(),
    end: end.toISOString(),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  return {
    config,
    eventTypes,
    bookings: [booking],
    unavailableStarts: new Set([booking.start]),
    nextBookingId: 2,
    nextEventTypeId: 2,
    conflictOnNextBooking: false,
    invalidSlotOnNextBooking: false,
  };
}

let mockDb: MockDb = createMockDb();

export function getMockDb(): MockDb {
  return mockDb;
}

export function resetMockDb(): MockDb {
  mockDb = createMockDb();
  return mockDb;
}

function generateSlots(eventType: EventType): Slot[] {
  const timezone = getMockDb().config.timezone;
  const slots: Slot[] = [];
  for (let offset = 0; offset < SLOT_DAYS_AHEAD; offset++) {
    const day = todayInZone(timezone).add(offset, 'day');
    for (const time of SLOT_TIMES) {
      const [hours, minutes] = time.split(':').map(Number);
      const start = day.hour(hours).minute(minutes).second(0).millisecond(0);
      const end = start.add(eventType.durationMinutes, 'minute');
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }
  return slots;
}

export const handlers = [
  http.get('/config', () => HttpResponse.json(getMockDb().config)),

  http.get('/event-types', () => HttpResponse.json(getMockDb().eventTypes)),

  http.get('/event-types/:eventTypeId', ({ params }) => {
    const eventType = getMockDb().eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(eventType);
  }),

  http.get('/event-types/:eventTypeId/slots', ({ request, params }) => {
    const db = getMockDb();
    const eventType = db.eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const inRange =
      from && to
        ? (slot: Slot) => slot.start >= from && slot.start < to
        : () => true;
    return HttpResponse.json(
      generateSlots(eventType).filter((slot) => !db.unavailableStarts.has(slot.start) && inRange(slot)),
    );
  }),

  http.post('/bookings', async ({ request }) => {
    const db = getMockDb();
    const input = (await request.json()) as BookingInput;

    if (db.conflictOnNextBooking) {
      db.conflictOnNextBooking = false;
      db.unavailableStarts.add(input.start);
      return HttpResponse.json({ code: 'slot_unavailable' }, { status: 409 });
    }

    if (db.invalidSlotOnNextBooking) {
      db.invalidSlotOnNextBooking = false;
      return HttpResponse.json({ code: 'invalid_slot' }, { status: 422 });
    }

    if (db.unavailableStarts.has(input.start)) {
      return HttpResponse.json({ code: 'slot_unavailable' }, { status: 409 });
    }

    const eventType = db.eventTypes.find((et) => et.id === input.eventTypeId);
    const durationMinutes = eventType?.durationMinutes ?? 30;
    const start = new Date(input.start);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const booking: Booking = {
      id: `booking-${db.nextBookingId++}`,
      eventTypeId: input.eventTypeId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      start: input.start,
      end: end.toISOString(),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    db.unavailableStarts.add(input.start);
    return HttpResponse.json(booking);
  }),

  http.get('/admin/event-types', () => HttpResponse.json(getMockDb().eventTypes)),

  http.post('/admin/event-types', async ({ request }) => {
    const db = getMockDb();
    const input = (await request.json()) as EventTypeInput;
    const eventType: EventType = {
      id: `event-type-${db.nextEventTypeId++}`,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
    };
    db.eventTypes.push(eventType);
    return HttpResponse.json(eventType);
  }),

  http.get('/admin/event-types/:eventTypeId', ({ params }) => {
    const eventType = getMockDb().eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(eventType);
  }),

  http.put('/admin/event-types/:eventTypeId', async ({ params, request }) => {
    const db = getMockDb();
    const index = db.eventTypes.findIndex((et) => et.id === String(params.eventTypeId));
    if (index === -1) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const input = (await request.json()) as EventTypeInput;
    const eventType: EventType = {
      id: db.eventTypes[index].id,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
    };
    db.eventTypes[index] = eventType;
    return HttpResponse.json(eventType);
  }),

  http.delete('/admin/event-types/:eventTypeId', ({ params }) => {
    const db = getMockDb();
    const eventType = db.eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const hasBookings = db.bookings.some((booking) => booking.eventTypeId === eventType.id);
    if (hasBookings) {
      return HttpResponse.json({ code: 'event_type_has_bookings' }, { status: 409 });
    }
    db.eventTypes = db.eventTypes.filter((et) => et.id !== eventType.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/admin/bookings', ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const bookings = getMockDb()
      .bookings.filter((booking) => (from ? booking.start >= from : true))
      .sort((a, b) => a.start.localeCompare(b.start));
    return HttpResponse.json(bookings);
  }),
];
