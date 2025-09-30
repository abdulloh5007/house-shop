// app/order-success/page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translations } from "@/lib/translations";
import { cookies } from "next/headers";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase-client";
import TgsPlayer from "@/components/tgs-player";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; status?: string }>;
}) {
  const { orderId, status } = await searchParams;
  const cookieStore = await cookies();
  const lang = (cookieStore.get('lang')?.value as 'ru' | 'uz') || 'ru';
  const t = translations[lang];

  // Load animation from Firestore settings/animations
  let orderSuccessAnimation: string | null = null;
  let orderUnsuccessAnimation: string | null = null;
  try {
    const db = getFirestore(app);
    const animationsDocRef = doc(db, 'settings', 'animations');
    const docSnap = await getDoc(animationsDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      orderSuccessAnimation = data.orderSuccessAnimation || null;
      orderUnsuccessAnimation = data.orderUnsuccessAnimation || null;
    }
  } catch {}

  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[calc(100vh-14rem)]">
      <Card className="w-full max-w-lg text-center p-8">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {status === 'fail' ? (
              orderUnsuccessAnimation ? (
                <div className="w-40 h-40 mx-auto">
                  {/* @ts-expect-error */}
                  <TgsPlayer dataUrl={orderUnsuccessAnimation} loop={true} className="w-full h-full" />
                </div>
              ) : (
                <CheckCircle className="h-16 w-16 text-red-500" />
              )
            ) : (
              orderSuccessAnimation ? (
                <div className="w-40 h-40 mx-auto">
                  {/* @ts-expect-error */}
                  <TgsPlayer dataUrl={orderSuccessAnimation} loop={true} className="w-full h-full" />
                </div>
              ) : (
                <CheckCircle className="h-16 w-16 text-green-500" />
              )
            )}
          </div>
          <CardTitle className="text-xl font-headline">
            {status === 'fail' ? (t.orderFailedTitle || 'Не удалось оформить заказ') : (t.orderConfirmedTitle || 'Заказ оформлен!')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {status === 'fail'
              ? (t.orderFailedDescGeneric || 'Произошла ошибка при оформлении заказа. Попробуйте еще раз.')
              : (t.orderConfirmedDesc || 'Ваш заказ получен. Вы можете отслеживать статус на странице "Мои заказы".')}
          </p>
          {orderId && status !== 'fail' && (
            <p className="text-lg">
              {t.orderLabel || 'Заказ №'}{" "}
              <span className="font-bold text-primary">
                #{orderId.split("_")[1]}
              </span>
            </p>
          )}
          <div className="flex justify-center gap-4 mt-6">
            <Button asChild>
              <Link href="/">{t.continueShopping || 'Продолжить покупки'}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/orders">{t.viewMyOrders || 'Мои заказы'}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
