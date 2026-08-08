import { http, HttpResponse } from 'msw';
import { test, expect } from './fixtures';
import { getMockDb } from '../src/test/mocks/handlers';

const CONSULTATION_CARD = 'Консультация, длительность 30 минут';
const ONBOARDING_CARD = 'Онбординг, длительность 15 минут';

test.describe('Гостевое бронирование', () => {
  test('начинает бронирование с лендинга и видит типы событий', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Планируйте звонки без переписки' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Забронировать звонок' }).first().click();
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.getByRole('heading', { name: 'Выберите тип события' })).toBeVisible();
    await expect(page.getByRole('link', { name: CONSULTATION_CARD })).toBeVisible();
    await expect(page.getByRole('link', { name: ONBOARDING_CARD })).toBeVisible();
  });

  test('бронирует свободный слот и видит подтверждение', async ({ page }) => {
    await page.goto('/book');
    await page.getByRole('link', { name: CONSULTATION_CARD }).click();
    await expect(page).toHaveURL(/\/book\/event-type-consultation$/);

    await expect(page.getByRole('group', { name: 'Календарь бронирования' })).toBeVisible();
    await expect(page.getByText('Время: Europe/Moscow')).toBeVisible();

    const slot = page.getByRole('button', { name: '09:00–09:30' });
    await expect(slot).toBeVisible();
    await slot.click();

    await expect(page.getByLabel('Имя')).toBeFocused();
    await page.getByLabel('Имя').fill('Иван Иванов');
    await page.getByLabel('Email').fill('ivan@example.com');
    await page.getByRole('button', { name: 'Забронировать' }).click();

    await expect(page).toHaveURL(/\/book\/success/);
    await expect(page.getByRole('heading', { name: 'Бронь подтверждена' })).toBeVisible();
    await expect(page.getByText('Иван Иванов')).toBeVisible();
    await expect(page.getByText('ivan@example.com')).toBeVisible();

    await page.getByRole('link', { name: 'Забронировать ещё' }).click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test('валидирует имя и email в форме брони', async ({ page }) => {
    await page.goto('/book');
    await page.getByRole('link', { name: CONSULTATION_CARD }).click();
    await page.getByRole('button', { name: '09:00–09:30' }).click();

    await page.getByRole('button', { name: 'Забронировать' }).click();
    await expect(page.getByText('Укажите ваше имя')).toBeVisible();

    await page.getByLabel('Имя').fill('Иван');
    await page.getByLabel('Email').fill('не-почта');
    await page.getByRole('button', { name: 'Забронировать' }).click();
    await expect(page.getByText('Введите корректный email')).toBeVisible();
  });

  test('показывает состояние отсутствующего типа события', async ({ page }) => {
    await page.goto('/book/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Тип события не найден' })).toBeVisible();

    await page.getByRole('link', { name: 'Выбрать другой тип события' }).click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test('показывает «нет свободных слотов» для дня без слотов', async ({ page, network }) => {
    await network.use(
      http.get('/event-types/:eventTypeId/slots', () => HttpResponse.json([])),
    );
    await page.goto('/book/event-type-consultation');
    await expect(page.getByText('На этот день нет свободных слотов.')).toBeVisible();
  });

  test('при 409 сохраняет форму, сбрасывает слот и обновляет список слотов', async ({ page }) => {
    getMockDb().conflictOnNextBooking = true;

    await page.goto('/book');
    await page.getByRole('link', { name: CONSULTATION_CARD }).click();
    await page.getByRole('button', { name: '09:00–09:30' }).click();
    await page.getByLabel('Имя').fill('Иван');
    await page.getByLabel('Email').fill('ivan@example.com');
    await page.getByRole('button', { name: 'Забронировать' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Этот слот уже занят. Выберите другой слот.',
    );
    await expect(page.getByRole('button', { name: '09:00–09:30' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '10:00–10:30' })).toBeVisible();

    await page.getByRole('button', { name: '10:00–10:30' }).click();
    await expect(page.getByLabel('Имя')).toHaveValue('Иван');
    await expect(page.getByLabel('Email')).toHaveValue('ivan@example.com');
  });

  test('при 422 сбрасывает занятый слот и предлагает выбрать другой', async ({ page }) => {
    getMockDb().invalidSlotOnNextBooking = true;

    await page.goto('/book');
    await page.getByRole('link', { name: CONSULTATION_CARD }).click();
    await page.getByRole('button', { name: '09:00–09:30' }).click();
    await page.getByLabel('Имя').fill('Иван');
    await page.getByRole('button', { name: 'Забронировать' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Выбранный слот недоступен. Выберите другой слот.',
    );
    await expect(page.getByRole('button', { name: '09:00–09:30' })).toBeVisible();
  });
});
