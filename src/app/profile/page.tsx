'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Camera, ArrowLeft, Loader2, CheckCircle, Edit, Shield } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useAuth } from '@/components/auth-provider';
import { updateProfile } from 'firebase/auth';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';


// Define the type for the Telegram Web App object
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  isExpanded: boolean;
  expand: () => void;
  ready: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Phone number formatter
const formatPhoneNumber = (phone: string) => {
    const cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.startsWith('998') && cleaned.length === 12) {
        const match = cleaned.match(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/);
        if (match) {
            return `+${match[1]} ${match[2]} ${match[3]} ${match[4]} ${match[5]}`;
        }
    }
    // Fallback for other numbers
    return `+${cleaned}`;
};


export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const { user: authUser, profile, loading, signInWithPhone, refreshUser, signOut } = useAuth();
  const [formData, setFormData] = useState({ name: '', phone: ''});
  const { toast } = useToast();
  const { lang, setLang } = useLanguage();
  const t = translations[lang];
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [retrievedPhone, setRetrievedPhone] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  useEffect(() => {
     if (authUser) {
         setFormData({
            name: authUser.displayName || '',
            phone: authUser.phoneNumber ? formatPhoneNumber(authUser.phoneNumber) : '',
         })
     }
  }, [authUser]);

  // --- Data Fetching and Verification ---
  // This useEffect handles initial Telegram WebApp setup and verification status.
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      setTg(webApp);
      webApp.ready();
      if (!webApp.isExpanded) webApp.expand();

      if (webApp.initData) {
        if(authUser) {
            // If user is already authenticated, assume verified via Telegram initData
            // This prevents showing the "Login via Telegram" button if already logged in.
            // However, the actual phone number polling is handled by a separate useEffect.
            setIsVerified(true);
            setIsPolling(false); // Ensure polling is stopped if user is already logged in on init
        }
      } else {
        setIsVerified(false);
      }
    } else {
       setIsVerified(false);
    }
  }, [toast, authUser]);

  // --- Phone Number Logic ---
  // This useCallback is for polling the backend for the phone number.
  const pollForPhoneNumber = useCallback(async () => {
    if (!tg?.initDataUnsafe.user?.id) return;

    console.log('Polling for phone number...');
    try {
        const response = await fetch(`/api/get-phone?userId=${tg.initDataUnsafe.user.id}`);
        const data = await response.json();

        if (data.phoneNumber) { // Check only for phoneNumber, tg.initData should be present if tg is not null
            setIsPolling(false); // Останавливаем опрос
            setRetrievedPhone(data.phoneNumber); // Сохраняем номер для отображения
            toast({ title: "Спасибо!", description: `Ваш номер получен. Выполняем вход...` });
            // Выполняем вход после небольшой задержки, чтобы пользователь увидел номер
            setTimeout(() => signInWithPhone(data.phoneNumber, tg.initData, tg.initDataUnsafe.user.photo_url), 1000);
            // After signInWithPhone, authUser will be updated, which will trigger the polling useEffect
            // to clear the interval definitively.
        }
    } catch (error) {
        console.error('Error polling for phone number:', error);
        // If an error occurs during polling, stop polling to prevent continuous retries
        // and inform the user.
        setIsPolling(false);
        toast({ title: "Ошибка", description: "Не удалось проверить номер телефона.", variant: "destructive" });
    }
  }, [tg, toast, signInWithPhone, setRetrievedPhone]);

  useEffect(() => {
    if (isPolling) {
        // If user is already authenticated, we should not be polling.
        // This handles cases where authUser becomes available after polling started.
        if (authUser) {
            setIsPolling(false);
            return;
        }
        const intervalId = setInterval(pollForPhoneNumber, 3000); // Poll every 3 seconds
        return () => clearInterval(intervalId);
    }
    // Add authUser to dependencies so this effect re-runs when user state changes.
  }, [isPolling, pollForPhoneNumber, authUser]);


  const handleRequestPhone = async () => {
    if (!tg?.initDataUnsafe.user?.id) {
        toast({ title: "Ошибка", description: "ID пользователя Telegram не найден.", variant: "destructive" });
        return;
    }

    // Open the Telegram bot link inside the Telegram WebApp for quicker phone sharing
    try {
      const botUrl = 'https://t.me/kiyimdokoni_bot';
      const openTelegramLink = (window as any)?.Telegram?.WebApp?.openTelegramLink;
      const openLink = (window as any)?.Telegram?.WebApp?.openLink;
      if (typeof openTelegramLink === 'function') {
        openTelegramLink(botUrl);
      } else if (typeof openLink === 'function') {
        openLink(botUrl, { try_instant_view: true });
      } else {
        // Fallback for non-Telegram environments
        window.open(botUrl, '_blank');
      }
    } catch (e) {
      console.warn('Failed to open Telegram link, continuing with request flow.', e);
    }
    
    try {
        const response = await fetch('/api/request-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tg.initDataUnsafe.user.id }),
        });
        const data = await response.json();
        if (data.success) {
            toast({ title: "Проверьте Telegram", description: "Мы отправили запрос на получение номера в ваш чат с ботом." });
            setIsPolling(true); // Start polling
        } else {
            throw new Error(data.error || 'Failed to request phone number.');
        }
    } catch (error) {
        console.error('Request phone error:', error);
        toast({ title: "Ошибка", description: `Не удалось запросить номер: ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    }
  };

  // --- UI Handlers ---
  const handleSave = async () => {
    if (!authUser) return;

    const nameHasChanged = formData.name !== authUser.displayName;
    const avatarHasChanged = !!avatarFile;

    if (!nameHasChanged && !avatarHasChanged) {
        toast({
            title: t.noChangesTitle,
            description: t.noChangesDesc,
        });
        setIsEditing(false);
        return;
    }

    setIsSaving(true);
    try {
        let newAvatarUrl = authUser.photoURL;

        // 1. Upload avatar if it has changed
        if (avatarHasChanged && avatarFile) {
            const uploadData = new FormData();
            uploadData.append('image', avatarFile);
            uploadData.append('uid', authUser.uid);

            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                body: uploadData,
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            newAvatarUrl = data.url;
        }

        // 2. Update profile with new name and/or new avatar URL
        const profileUpdates: { displayName?: string, photoURL?: string } = {};
        if (nameHasChanged) {
            profileUpdates.displayName = formData.name;
        }
        if (avatarHasChanged) {
            profileUpdates.photoURL = newAvatarUrl;
        }
        
        if (Object.keys(profileUpdates).length > 0) {
            await updateProfile(authUser, profileUpdates);
            await refreshUser();
        }

        toast({ title: t.profileUpdatedTitle, description: t.profileUpdatedDesc });
        setIsEditing(false);
        setAvatarFile(null);
        setAvatarPreviewUrl(null);

    } catch (error: any) {
        console.error("Failed to update profile", error);
        toast({ title: "Error", description: error.message || "Failed to update profile.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleAvatarInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };
  
  const handleEditClick = () => {
    setIsEditing(true);
  }
  
  const handleBackClick = () => {
    if (authUser) {
      setFormData({ name: authUser.displayName || '', phone: authUser.phoneNumber ? formatPhoneNumber(authUser.phoneNumber) : ''});
    }
    setIsEditing(false);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
  }

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Вы вышли из системы." });
  };

  if (loading) {
    return (
        <div className="container mx-auto px-4 py-8 flex justify-center items-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin" />
        </div>
    )
  }
  
  if (!authUser) {
      return (
         <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-center mb-4">Вход в систему</h1>
            <p className="text-center text-muted-foreground mb-6">
                {retrievedPhone 
                    ? 'Ваш номер получен. Выполняем вход...' 
                    : 'Чтобы использовать все функции приложения, пожалуйста, поделитесь вашим номером телефона.'
                }
            </p>
             <Card className="max-w-md mx-auto">
                <CardContent className="p-6">
                    {retrievedPhone ? (
                        <div className="text-center py-4">
                            <p className="text-lg font-semibold">{formatPhoneNumber(retrievedPhone)}</p>
                            <Loader2 className="mx-auto mt-2 h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <Button onClick={handleRequestPhone} className="w-full" disabled={isPolling}>
                            {isPolling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ожидание номера...</> : 'Войти через Telegram'}
                        </Button>
                    )}
                </CardContent>
             </Card>
         </div>
      )
  }
  
  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4 h-11">
          {isEditing ? (
              <>
                  <Button variant="ghost" size="icon" onClick={handleBackClick} disabled={isSaving}>
                      <ArrowLeft />
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t.save}
                  </Button>
              </>
          ) : (
              <div className="flex-1 flex justify-end items-center">
                  <Button onClick={handleEditClick} variant="outline">
                      <Edit className="mr-2 h-4 w-4" />
                      {t.edit}
                  </Button>
              </div>
          )}
        </div>
        
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 pt-8 flex flex-col items-center text-center">
            <div className="relative mb-4">
                  <Avatar className="w-28 h-28 border-4 border-primary shadow-md">
                    <AvatarImage src={avatarPreviewUrl || authUser.photoURL || `https://picsum.photos/seed/${authUser.uid}/200/200`} alt={formData.name} />
                    <AvatarFallback className="text-4xl">{formData.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {isVerified && !isEditing && (
                      <CheckCircle className="absolute bottom-1 right-1 h-8 w-8 bg-background rounded-full text-blue-500" fill="white" />
                  )}
                  {isEditing && (
                      <>
                          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarInputChange} className="hidden" />
                          <Button size="icon" className="absolute bottom-0 -right-2 rounded-full h-9 w-9 shadow-md" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5"/>}
                              <span className="sr-only">Change photo</span>
                          </Button>
                      </>
                  )}
              </div>

              <div className="w-full space-y-6 mt-4">
                  <div className="space-y-1">
                      <Label htmlFor="name" className="text-muted-foreground">{t.name}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        readOnly={!isEditing}
                        disabled={isSaving}
                        className={!isEditing 
                          ? 'border-none bg-transparent text-center text-xl font-bold p-0 h-auto disabled:opacity-100' 
                          : 'text-center text-xl font-bold'
                        }
                      />
                  </div>
                  
                  <div className="space-y-1">
                      <Label htmlFor="phone" className="text-muted-foreground">{t.phone}</Label>
                      <p id="phone" className="text-center text-lg text-muted-foreground">
                          {formData.phone}
                      </p>
                  </div>
              </div>
          </CardContent>
        </Card>

        {profile?.role === 'admin' && (
          <div className="max-w-md mx-auto mt-6">
            <Button asChild variant="secondary" className="w-full">
              <Link href="/admin">
                <Shield className="mr-2 h-4 w-4" />
                {t.adminPanel}
              </Link>
            </Button>
          </div>
        )}

        <div className="flex justify-center mt-8">
          <div className="border rounded-full p-1 bg-muted">
              <Button size="sm" variant={lang === 'ru' ? 'default' : 'ghost'} className="rounded-full" onClick={() => setLang('ru')}>Русский</Button>
              <Button size="sm" variant={lang === 'uz' ? 'default' : 'ghost'} className="rounded-full" onClick={() => setLang('uz')}>O'zbekcha</Button>
          </div>
        </div>

        <div className="max-w-md mx-auto mt-6">
            <Button variant="destructive" className="w-full" onClick={handleSignOut}>
                Выйти (для теста)
            </Button>
        </div>

      </div>
    </>
  );
}
