'use client';
import { useEffect } from 'react';

// Define the type for the Telegram Web App object
interface BackButton {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
}

interface TelegramWebApp {
    BackButton: BackButton;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function BackButton() {
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;

      const handleBackClick = () => {
        window.history.back();
      };
      
      tg.BackButton.show();
      tg.BackButton.onClick(handleBackClick);
      
      // Cleanup function to hide the button and remove the event listener
      // when the component unmounts.
      return () => {
        tg.BackButton.offClick(handleBackClick);
        tg.BackButton.hide();
      };
    }
  }, []);

  return null; // This component does not render anything in the DOM
}
