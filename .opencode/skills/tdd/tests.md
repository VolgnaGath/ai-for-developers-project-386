# Хорошие и плохие тесты

## Хорошие тесты

**Интеграционные**: тестируй через реальные интерфейсы, а не моки внутренних частей.

```typescript
// ХОРОШО: проверяет наблюдаемое поведение
test("пользователь может записать встречу с валидной формой", async () => {
  const form = createBookingForm();
  form.add({ date: "2026-08-10", time: "10:00" });
  const result = await submitBooking(form);
  expect(result.status).toBe("confirmed");
});
```

Характеристики:

- Проверяют поведение, важное для пользователей/вызывающего кода
- Используют только публичный API
- Переживают внутренние рефакторинги
- Описывают ЧТО, а не КАК
- Одно логическое утверждение на тест

## Плохие тесты

**Тесты деталей реализации**: связаны с внутренней структурой.

```typescript
// ПЛОХО: проверяет детали реализации
test("форма вызывает service.process", async () => {
  const mockService = jest.mock(service);
  await submitBooking(form);
  expect(mockService.process).toHaveBeenCalledWith(form.data);
});
```

Красные флаги:

- Мокают внутренних коллабораторов
- Тестируют приватные методы
- Утверждают на количестве вызовов / их порядке
- Тест ломается при рефакторинге без изменения поведения
- Имя теста описывает КАК, а не ЧТО
- Проверка через внешние средства вместо интерфейса

```typescript
// ПЛОХО: в обход интерфейса
test("createUser сохраняет в БД", async () => {
  await createUser({ name: "Алиса" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Алиса"]);
  expect(row).toBeDefined();
});

// ХОРОШО: проверка через интерфейс
test("createUser делает пользователя доступным", async () => {
  const user = await createUser({ name: "Алиса" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Алиса");
});
```

**Тавтологические тесты**: ожидаемое значение повторяет реализацию, поэтому тест проходит по построению.

```typescript
// ПЛОХО: ожидание пересчитывается так же, как код
test("calculateTotal суммирует позиции", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// ХОРОШО: ожидание — независимый известный литерал
test("calculateTotal суммирует позиции", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```
