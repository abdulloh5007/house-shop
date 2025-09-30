# 🏠 House Shop — Telegram Mini App / Next.js + Firebase

House Shop — это современный магазин с админ‑панелью, собранный на Next.js и Firebase с удобной интеграцией в Telegram Mini Apps. 

- Клиент: каталог товаров, оформление заказа, статус заказа
- Админ: управление товарами, заказами, продажами, аналитика, кошелёк
- Реал‑тайм: статусы заказов и фильтры обновляются без перезагрузки


## 📌 Содержание
- [Технологии](#-технологии)
- [Быстрый старт](#-быстрый-старт)
- [Переменные окружения](#-переменные-окружения)
- [Firebase настройка](#-firebase-настройка)
- [Telegram настройка (опционально)](#-telegram-настройка-опционально)
- [Скрипты](#-скрипты)
- [Архитектура и данные](#-архитектура-и-данные)
- [А��мин: обзор страниц](#-админ-обзор-страниц)
- [Особенности в реальном времени](#-особенности-в-реальном-времени)
- [Сборка и деплой](#-сборка-и-деплой)
- [Лицензия](#-лицензия)


## 🧰 Технологии
- Next.js 15 (App Router, TypeScript)
- React 18
- Tailwind CSS + Radix UI (шаблоны компонентов)
- Firebase: Firestore, Firebase Admin (сервер), Firebase Client SDK (клиент)
- Импорт изображений: imgBB API
- Telegram Mini Apps (опционально для боевого окружения)


## 🚀 Быстрый старт
1) Клонируйте проект

```
git clone https://github.com/username/house-shop.git
cd house-shop
```

2) Установите зависимости
```
npm install
```

3) Создайте .env.local в корне и заполните переменные (см. раздел «Переменные окружения»)

4) Запустите dev‑сервер
```
npm run dev
```
По умолчанию сервер поднимется на http://localhost:9002 (см. package.json).

5) Откройте в браузере
- Клиент: http://localhost:9002
- Админ: http://localhost:9002/admin


## 🔐 Переменные окружения
Создайте файл .env.local и добавьте:

```
# Firebase (client SDK)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (server SDK)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
# ВНИМАНИЕ: переводы \n обязателен, как в примере ниже
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
# ImgBB — хостинг изображений
NEXT_PUBLIC_IMGBB_API_KEY=your_imgbb_api_key

# Telegram (опционально для webhook)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

Примечания:
- FIREBASE_PRIVATE_KEY должен содержать \n вместо реальных переводов строк (уже обрабатывается в коде).
- Для загрузки фотографий товаров требуется ключ imgBB (NEXT_PUBLIC_IMGBB_API_KEY).


## 🔧 Firebase настройка
1) Создайте проект в Firebase Console
2) Активируйте Firestore (режим production или test — на ваше усмотрение)
3) Создайте Web‑приложение и получите client SDK конфиг (значения NEXT_PUBLIC_*)
4) Создайте Service Account (Firebase Admin SDK) и скопируйте:
   - client_email → FIREBASE_CLIENT_EMAIL
   - project_id → FIREBASE_PROJECT_ID
   - private_key → FIREBASE_PRIVATE_KEY (замените переводы строк на \n)

Структура коллекций (упрощённо):
- products/{productId}
- orders/{orderId}
- settings/balance (+ subcollection transactions)
- settings/animations
- users/{userId}


## 🤖 Telegram настройка (опционально)
Проект поддерживает интеграцию с Telegram Mini Apps.
- Создайте бота в @BotFather и получите TELEGRAM_BOT_TOKEN
- Установите webhook на ваш прод‑домен: `https://YOUR_DOMAIN/api/bot/webhook`
- Для локальной отладки можно использовать Cloudflare Tunnel, ngrok и т.п.

Маршруты авторизации Telegram в проекте находятся в:
- src/app/api/auth/telegram-id-signin/route.ts
- src/app/api/auth/telegram-phone-signin/route.ts
- src/app/api/verify-telegram/route.ts


## 📜 Скрипты
В package.json доступны команды:
- dev — запуск dev‑сервера (Turbopack) на 9002
- build — сборка
- start — запуск собранного приложения
- lint — линтер
- typecheck — проверка типов TypeScript

Примеры:
```
npm run dev
npm run build && npm run start
```


## 🧱 Архитектура и данные
- App Router: src/app/... (страницы клиента и админа)
- API маршруты: src/app/api/...
- Firebase client: src/lib/firebase-client.ts
- Firebase admin: src/lib/firebase-admin.ts
- UI компоненты: src/components/ui/*
- Локализация: src/lib/locales/{ru,uz}.json

Главные сущности:
- Product: цена, остаток, размеры, скидки, изображения
- Order: товары, дата, пользователь, статус (pending/accepted/declined)
- Sale/Transaction: продажи по товарам и движения кошелька


## 🛠 Админ: обзор страниц
Ниже обзор основных страниц админ‑панели (все пути начинаются с /admin):

- /admin — товары
  - Список товаров с карточками и галереей
  - Управление скидками (проценты, перерасчёт цен)
  - Быстрая «ручная продажа» (фиксирует продажу и уменьшает остатки)
  - Удаление товара

- /admin/new — добавление товара
  - Форма с валидацией
  - Загрузка изображений в imgBB (через /api/admin/upload-product-images)

- /admin/edit/[productId] — редактирование товара
  - Изменение цены, количества, размеров, изображений

- /admin/orders — список заказов с фильтрами и реальным временем
  - Фильтры снизу: Новый / Одобренные / Отказанные (нижняя навигация)
  - Лента обновляется в реальном времени из Firestore

- /admin/orders/[orderId] — детали заказа
  - Состав заказа, покупатель, суммы
  - Кнопки Принять / Отказать с лоадером
  - Результат (статус + время решения) появляется мгновенно за счёт Firestore onSnapshot

- /admin/orders/chart — графики по заказам (прибыль/доход)

- /admin/analytics — общая аналитика
- /admin/analytics/[productId] — аналитика по конкретному товару

- /admin/wallet — кошелёк
  - Баланс, транзакции, синхронизация с продажами

- /admin/transaction — управление/откат транзакций

- /admin/settings — настройки анимаций
  - Хранится в Firestore: settings/animations
  - Используется на страницах, включая /order-success

- /admin/users — список пользователей


## 🔄 Особенности в реальном времени
- Детали заказа (админ):
  - Кнопки принятия/отказа запускают AJAX‑запросы к API
  - UI показывает лоадер на нажатой кнопке
  - После ответа сервер обновляет Firestore, а клиентская подписка (onSnapshot) мгновенно отрисовывает новый статус и снимает лоадер

- Список заказов (админ):
  - Подписка на коллекцию orders; фильтры по статусам работают без перезагрузки

- Оформление заказа (клиент):
  - Кнопка «Заказать» показывает лоадер во время обработки /api/admin/process-sale
  - После успеха — ручной переход на /order-success?orderId=...
  - Исключён ложный редирект на главную при очистке корзины (учтён переход на success)


## 🏗️ Сборка и деплой
- Локально
  - dev: `npm run dev` → http://localhost:9002
  - prod: `npm run build && npm run start`
- Переменные окружения
  - Используйте .env.local локально и переменные окружения платформы на проде
- Домен/HTTPS
  - Для Telegram webhook необходим публичный HTTPS‑домен


## 📄 Лицензия
MIT License © 2025
