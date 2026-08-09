import { test, expect } from '@playwright/test';
import { todayInZone } from '../src/shared/date/timezone';

const TIMEZONE = 'Europe/Moscow';
const GUEST_NAME = 'Иван Смок';

function nextWorkingDay() {
  const day = todayInZone(TIMEZONE).add(1, 'day');
  while (day.day() === 0 || day.day() === 6) {
    day.add(1, 'day');
  }
  return day;
}

test('smoke: гость бронирует слот реального backend, админ видит бронь', async ({ page }) => {
  await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'Выберите тип события' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Консультация, длительность 30 минут' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Онбординг, длительность 15 минут' }),
  ).toBeVisible();

  const date = nextWorkingDay().format('YYYY-MM-DD');
  await page.goto(`/book/evt_consultation?date=${date}`);
  await expect(page.getByRole('button', { name: '09:00–09:30' })).toBeVisible();
  await page.getByRole('button', { name: '09:00–09:30' }).click();

  await expect(page.getByLabel('Имя')).toBeFocused();
  await page.getByLabel('Имя').fill(GUEST_NAME);
  await page.getByLabel('Email').fill('smoke@example.com');
  await page.getByRole('button', { name: 'Забронировать' }).click();

  await expect(page).toHaveURL(/\/book\/success/);
  await expect(page.getByRole('heading', { name: 'Бронь подтверждена' })).toBeVisible();
  await expect(page.getByText(GUEST_NAME)).toBeVisible();

  await page.goto('/admin/bookings');
  await expect(page.getByRole('heading', { name: 'Предстоящие встречи' })).toBeVisible();
  await expect(page.getByText(GUEST_NAME)).toBeVisible();
  await expect(page.getByText('Консультация')).toBeVisible();
});
