export type ApiError =
  | { code: 'not_found'; status: 404; message: string }
  | { code: 'slot_unavailable'; status: 409; message: string }
  | { code: 'invalid_slot'; status: 422; message: string }
  | { code: 'event_type_has_bookings'; status: 409; message: string }
  | { code: 'unexpected'; status: number; message: string };

const API_ERROR_CODES = [
  'not_found',
  'slot_unavailable',
  'invalid_slot',
  'event_type_has_bookings',
] as const;

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const code = (value as { code?: unknown }).code;
  return API_ERROR_CODES.includes(code as (typeof API_ERROR_CODES)[number]);
}

export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

export function classifyApiError(
  status: number,
  body: { code?: string } | null | undefined,
): ApiError {
  switch (body?.code) {
    case 'not_found':
      return { code: 'not_found', status: 404, message: 'Запрашиваемый ресурс не найден.' };
    case 'slot_unavailable':
      return {
        code: 'slot_unavailable',
        status: 409,
        message: 'Этот слот уже занят. Выберите другой слот.',
      };
    case 'invalid_slot':
      return {
        code: 'invalid_slot',
        status: 422,
        message: 'Выбранный слот недоступен. Выберите другой слот.',
      };
    case 'event_type_has_bookings':
      return {
        code: 'event_type_has_bookings',
        status: 409,
        message: 'Нельзя удалить тип события: у него есть существующие брони.',
      };
    default:
      return {
        code: 'unexpected',
        status,
        message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
      };
  }
}
