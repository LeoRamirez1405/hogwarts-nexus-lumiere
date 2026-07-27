"use client";

import { MaterialIcon, Button } from "@/components/ui";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SuccessModal({ isOpen, onClose }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md bg-white glass-card rounded-3xl p-8 text-center shadow-2xl animate-pop-in">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <MaterialIcon
            name="check_circle"
            className="text-success text-5xl"
            filled
          />
        </div>
        <h3 className="font-display text-headline-lg text-primary mb-2">¡Compra Realizada!</h3>
        <p className="text-on-surface-variant text-body-md mb-6">
          Tu pedido ha sido procesado exitosamente. Los libros llegarán por lechuza en breve.
        </p>
        <Button variant="primary" size="lg" onClick={onClose}>
          Volver al Catálogo
        </Button>

        <style jsx global>{`
          @keyframes pop-in {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          .animate-pop-in {
            animation: pop-in 0.2s ease-out;
          }
        `}</style>
      </div>
    </div>
  );
}