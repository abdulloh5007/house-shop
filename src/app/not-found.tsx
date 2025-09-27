import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-6xl font-bold text-gray-800 dark:text-white">404</h1>
        <p className="text-2xl text-gray-600 dark:text-gray-300 mt-4">Страница не найдена</p>
        <p className="text-md text-gray-500 dark:text-gray-400 mt-2">
          Извините, мы не можем найти страницу, которую вы ищете.
        </p>
        <Link href="/" passHref>
          <Button className="mt-6">
            На главную
          </Button>
        </Link>
      </div>
    </div>
  );
}