
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import pako from 'pako';
import { cn } from '@/lib/utils';

const TgsPlayer: React.FC<{ 
    dataUrl: string; 
    className?: string; 
    style?: React.CSSProperties; 
    lottieRef?: React.RefObject<any>; 
    onClick?: () => void; 
    loop?: boolean, 
    isSpinning?: boolean 
}> = ({ dataUrl, className, style, loop = false, isSpinning = false }) => {
    const [animationData, setAnimationData] = useState<object | null>(null);
    const lottieRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!dataUrl) {
            setAnimationData(null);
            return;
        }

        try {
            const base64Data = dataUrl.split(',')[1];
            let decompressedData: string;

            if (dataUrl.startsWith('data:application/gzip;base64,') || dataUrl.startsWith('data:application/octet-stream;base64,')) {
                const compressedData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                decompressedData = pako.inflate(compressedData, { to: 'string' });
            } else {
                // Assumes it's a base64 encoded JSON string (for .json files)
                decompressedData = atob(base64Data);
            }
            
            const jsonData = JSON.parse(decompressedData);
            setAnimationData(jsonData);
        } catch (error) {
            console.error("Error processing animation data:", error);
            setAnimationData(null);
        }
    }, [dataUrl]);

    const playOnce = () => {
        if (!lottieRef.current || isPlaying) return;
        setIsPlaying(true);
        lottieRef.current.stop();
        lottieRef.current.play();
    };

    if (!animationData) {
        return <div className="text-center text-muted-foreground p-4">Загрузка...</div>;
    }

    return (
        <div 
            style={style} 
            className={cn("w-full h-full flex items-center justify-center", className, isSpinning && "animate-roulette-spin")} 
            onClick={playOnce}
        >
            <Lottie
                lottieRef={lottieRef}
                animationData={animationData}
                loop={loop}
                autoplay={loop}
                renderer="canvas"
                className="w-full h-full object-contain"
                onComplete={() => setIsPlaying(false)}
            />
        </div>
    );
};

export default TgsPlayer;
