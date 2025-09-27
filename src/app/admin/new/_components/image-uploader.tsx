
'use client';
import { useRef, useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Plus, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import LightGallery from 'lightgallery/react';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';

// Fix for React 18 StrictMode
const DroppableStrict = ({ children, ...props }: any) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
};

export function ImageUploader({
  images,
  setImages,
}: {
  images: { file: File; url: string }[];
  setImages: (images: { file: File; url: string }[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const { lang } = useLanguage(); 
  const t = translations[lang];

  // 🔒 Disable zoom & pinch on mobile
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const preventDoubleTap = (e: Event) => e.preventDefault();

    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('dblclick', preventDoubleTap, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('gesturestart', preventZoom);
      document.removeEventListener('dblclick', preventDoubleTap);
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      const remainingSlots = 4 - images.length;
      if (remainingSlots <= 0) return;

      const filesToAdd = filesArray.slice(0, remainingSlots);
      const newImages = [
        ...images,
        ...filesToAdd.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ];
      setImages(newImages);
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    URL.revokeObjectURL(imageToRemove.url);
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newImages = Array.from(images);
    const [reorderedImage] = newImages.splice(result.source.index, 1);
    newImages.splice(result.destination.index, 0, reorderedImage);
    setImages(newImages);
  };

  const handleAddClick = () => {
    if (images.length < 4) fileInputRef.current?.click();
  };

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        multiple
        disabled={images.length >= 4}
      />

      {images.length === 0 ? (
        <div
          onClick={handleAddClick}
          className="w-full aspect-[3/4] relative overflow-hidden bg-muted flex items-center justify-center border-2 border-dashed rounded-lg hover:border-primary transition-colors cursor-pointer"
        >
          <div className="text-center text-muted-foreground">
            <Plus size={48} className="mx-auto" />
            <p>{t.addImage}</p>
          </div>
        </div>
      ) : (
        <div
          className="w-full aspect-[3/4] relative overflow-hidden bg-muted rounded-lg cursor-pointer flex items-center justify-center"
          onClick={() => openGallery(0)}
        >
          {images[0] && (
            <Image
              src={images[0].url}
              alt="Main product"
              fill
              className="object-contain"
            />
          )}
        </div>
      )}

      <div className="px-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <DroppableStrict
            droppableId="images"
            direction="horizontal"
            isDropDisabled={images.length < 2}
          >
            {(provided: any) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-4 gap-4"
              >
                {images.map((image, index) => (
                  <Draggable key={image.url} draggableId={image.url} index={index}>
                    {(provided: any, snapshot: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          'relative group',
                          snapshot.isDragging && 'opacity-50'
                        )}
                      >
                        <div className="aspect-square w-full overflow-hidden rounded-lg border relative">
                          {images.length > 1 && (
                            <div
                              {...provided.dragHandleProps}
                              className="absolute top-1 left-1 z-10 text-white bg-black/30 rounded-full p-1 cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical size={16} />
                            </div>
                          )}
                          <Image
                            src={image.url}
                            alt={`Product image ${index + 1}`}
                            width={100}
                            height={100}
                            className="object-cover w-full h-full cursor-pointer"
                            onClick={() => openGallery(index)}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={() => removeImage(index)}
                          >
                            <X size={16} />
                          </Button>
                        </div>
                        {index === 0 && (
                          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                            {t.mainImage}
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {images.length > 0 && images.length < 4 && (
                  <div
                    onClick={handleAddClick}
                    className="aspect-square w-full flex items-center justify-center border-2 border-dashed rounded-lg hover:border-primary hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="text-center text-muted-foreground">
                      <Plus size={32} className="mx-auto" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </DroppableStrict>
        </DragDropContext>
      </div>

      {galleryOpen && (
        <LightGallery
          onAfterClose={() => setGalleryOpen(false)}
          speed={500}
          plugins={[]}
          dynamic
          dynamicEl={images.map((img) => ({ src: img.url }))}
          index={galleryIndex}
        />
      )}
    </div>
  );
}
