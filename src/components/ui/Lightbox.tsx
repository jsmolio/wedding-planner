import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const hasPrev = images.length > 1;
  const hasNext = images.length > 1;

  const goPrev = useCallback(() => {
    onIndexChange(index === 0 ? images.length - 1 : index - 1);
  }, [index, images.length, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange(index === images.length - 1 ? 0 : index + 1);
  }, [index, images.length, onIndexChange]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) goPrev();
      if (e.key === 'ArrowRight' && hasNext) goNext();
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose, goPrev, goNext, hasPrev, hasNext]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation */}
      {hasPrev && (
        <button
          onClick={goPrev}
          className="absolute left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={goNext}
          className="absolute right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={images[index]}
        alt={`Photo ${index + 1} of ${images.length}`}
        className="relative z-[1] max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
      />

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/60 text-white text-sm">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
