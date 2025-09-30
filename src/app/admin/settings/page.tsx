
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { translations } from '@/lib/translations';
import { BackButton } from '@/components/back-button';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { AnimationUploader } from './_components/animation-uploader';

interface AnimationData {
  walletAnimation: string | null;
  walletLoaderAnimation: string | null;
  emptyCartAnimation: string | null;
  productsNotFoundAnimation: string | null;
  orderSuccessAnimation: string | null;
  orderUnsuccessAnimation: string | null;
}

export default function SettingsPage() {
  const { lang } = useLanguage();
  const t = translations[lang];
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [animations, setAnimations] = useState<AnimationData>({
    walletAnimation: null,
    walletLoaderAnimation: null,
    emptyCartAnimation: null,
    productsNotFoundAnimation: null,
    orderSuccessAnimation: null,
    orderUnsuccessAnimation: null,
  });

  const fetchAnimations = useCallback(async () => {
    setIsLoading(true);
    try {
        const db = getFirestore(app);
        const animationsDocRef = doc(db, 'settings', 'animations');
        const docSnap = await getDoc(animationsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as Partial<AnimationData>;
            setAnimations(prev => ({
              walletAnimation: data.walletAnimation ?? prev.walletAnimation,
              walletLoaderAnimation: data.walletLoaderAnimation ?? prev.walletLoaderAnimation,
              emptyCartAnimation: data.emptyCartAnimation ?? prev.emptyCartAnimation,
              productsNotFoundAnimation: data.productsNotFoundAnimation ?? prev.productsNotFoundAnimation,
              orderSuccessAnimation: (data as any).orderSuccessAnimation ?? prev.orderSuccessAnimation,
              orderUnsuccessAnimation: (data as any).orderUnsuccessAnimation ?? (prev as any).orderUnsuccessAnimation ?? null,
            }));
        }
    } catch (error) {
        console.error("Error fetching animations:", error);
        toast({
            title: t.errorTitle,
            description: t.fetchAnimationsError,
            variant: "destructive"
        });
    } finally {
        setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchAnimations();
  }, [fetchAnimations]);


  const handleAnimationChange = (key: keyof AnimationData, dataUrl: string | null) => {
    setAnimations(prev => ({ ...prev, [key]: dataUrl }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const db = getFirestore(app);
        const animationsDocRef = doc(db, 'settings', 'animations');
        await setDoc(animationsDocRef, animations, { merge: true });
        toast({
            title: t.settingsSavedTitle,
            description: t.animationsSuccessfullySaved,
        });
    } catch (error) {
        console.error("Error saving animations:", error);
        toast({
            title: t.errorTitle,
            description: t.saveAnimationsError,
            variant: "destructive"
        });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t.animationSettingsTitle}</h1>
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.save}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
            <AnimationUploader 
                label={t.walletAnimationLabel}
                initialDataUrl={animations.walletAnimation}
                onAnimationChange={(dataUrl) => handleAnimationChange('walletAnimation', dataUrl)}
            />
            <AnimationUploader 
                label={t.walletLoaderAnimationLabel}
                initialDataUrl={animations.walletLoaderAnimation}
                onAnimationChange={(dataUrl) => handleAnimationChange('walletLoaderAnimation', dataUrl)}
            />
            <AnimationUploader 
                label={t.emptyCartAnimationLabel}
                initialDataUrl={animations.emptyCartAnimation}
                onAnimationChange={(dataUrl) => handleAnimationChange('emptyCartAnimation', dataUrl)}
            />
            <AnimationUploader 
                label={t.noProductsAnimationLabel}
                initialDataUrl={animations.productsNotFoundAnimation}
                onAnimationChange={(dataUrl) => handleAnimationChange('productsNotFoundAnimation', dataUrl)}
            />
            <AnimationUploader 
                label={t.orderSuccessAnimationLabel || 'Анимация успешного заказа'}
                initialDataUrl={animations.orderSuccessAnimation}
                onAnimationChange={(dataUrl) => handleAnimationChange('orderSuccessAnimation', dataUrl)}
            />
            <AnimationUploader 
                label={t.orderUnsuccessAnimationLabel || 'Анимация неуспешного заказа'}
                initialDataUrl={(animations as any).orderUnsuccessAnimation || null}
                onAnimationChange={(dataUrl) => handleAnimationChange('orderUnsuccessAnimation', dataUrl)}
            />
        </div>
      )}
    </div>
  );
}
