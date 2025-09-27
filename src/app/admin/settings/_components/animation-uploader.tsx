
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import TgsPlayer from '@/components/tgs-player';

interface AnimationUploaderProps {
  label: string;
  initialDataUrl: string | null;
  onAnimationChange: (dataUrl: string | null) => void;
}

export function AnimationUploader({ label, initialDataUrl, onAnimationChange }: AnimationUploaderProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(initialDataUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { lang } = useLanguage();
  const t = translations[lang];

  useEffect(() => {
    setDataUrl(initialDataUrl);
  }, [initialDataUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.tgs') && !file.name.endsWith('.json')) {
      toast({
        title: t.errorTitle,
        description: t.unsupportedFileFormat,
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onAnimationChange(result);
      setDataUrl(result);
    };
    reader.onerror = () => {
        toast({
            title: t.errorTitle,
            description: t.fileReadError,
            variant: 'destructive',
        });
    };
    reader.readAsDataURL(file);
    // Reset file input to allow re-uploading the same file
    event.target.value = '';
  };
  
  const handleRemove = () => {
    onAnimationChange(null);
    setDataUrl(null);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <p className="font-medium">{label}</p>
          {dataUrl && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemove}>
                <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div 
          className="relative aspect-square w-full bg-muted rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {dataUrl ? (
             <TgsPlayer
                dataUrl={dataUrl}
                loop={true}
                className="w-full h-full"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <UploadCloud className="h-10 w-10 mx-auto" />
              <p className="mt-2 text-sm">{t.uploadTgsOrJsonFile || 'Upload .tgs or .json file'}</p>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".tgs,.json"
          />
        </div>
      </CardContent>
    </Card>
  );
}
