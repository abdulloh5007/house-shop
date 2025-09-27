# 📦 House Shop — Telegram Mini App

**House Shop** — это удобный магазин в формате **Telegram Mini App**, созданный для продавцов.  
В приложении можно просматривать товары, оформлять заказы, управлять продажами и отслеживать полную аналитику в реальном времени.  

---

## 🚀 Возможности

- 🛒 **Каталог товаров**
  - Просмотр доступных товаров.
  - Оформление заказа прямо в Telegram.

- 👨‍💻 **Админ-панель**
  - Управление товарами (добавление, редактирование, удаление).
  - Ручная продажа: админ может отметить товар как проданный.
  - Отмена транзакции (если введено неверное количество).

- 📊 **Аналитика**
  - Сохранение всех транзакций.
  - Подробная статистика по продажам.
  - История заказов.

- 💰 **Кошельки**
  - Просмотр прибыли по продажам.

- 🔔 **В обработке**
  - Возможность покупки товаров за деньги из кошелька.
  - Логика покупка товара
  - Заказы
  
---

## 🛠️ Технологии

- [Next.js](https://nextjs.org/) (TypeScript)  
- [React](https://react.dev/)  
- [Tailwind CSS](https://tailwindcss.com/)  
- [Firebase](https://firebase.google.com/) (Firestore, Authentication, Admin SDK)  
- [Telegram Mini Apps SDK](https://core.telegram.org/bots/webapps)  

---

## 🔑 Аутентификация

- Используется **firebase-admin** для кастомной аутентификации.  
- Номер телефона берётся напрямую из Telegram профиля и используется как ключ для авторизации.  

---

## ⚡ Установка и запуск

# 1. Клонируем репозиторий
```bash
git clone https://github.com/username/house-shop.git
cd house-shop
```

# 2. Устанавливаем зависимости
```bash
npm install
```

# 3. Запускаем dev-сервер
```bash
npm run dev
```
# 4. Открываем в браузере
http://localhost:3000

## 🔑 Переменные окружения

# Создайте файл .env.local и добавьте:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_IMGBB_API=your_imgbb_api

FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_PROJECT_ID=your_project_id

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## 🎯 Для кого

# House Shop создан для продавцов, которые хотят:

покупать и продавать товары,

видеть аналитику,

вести учёт и статистику,

работать прямо в Telegram без лишних приложений.

## 📜 Лицензия

# MIT License © 2025 — Abdulloh Ergashev
