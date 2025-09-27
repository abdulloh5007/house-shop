"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OpenInTelegramPage() {
  const router = useRouter();
  const telegramLink = "https://t.me/kiyimdokoni_bot/Market";

  useEffect(() => {
    // Redirect immediately
    window.location.href = telegramLink;
  }, []);

  const handleOpenManually = () => {
    window.location.href = telegramLink;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Перенаправление...</h1>
        <p className="text-md text-gray-600 dark:text-gray-300 mt-4">
          Мы перенаправляем вас в Telegram. Если ничего не произошло, нажмите кнопку ниже.
        </p>
        <Button onClick={handleOpenManually} className="mt-6">
          Открыть в Telegram
        </Button>
      </div>
    </div>
  );
}
