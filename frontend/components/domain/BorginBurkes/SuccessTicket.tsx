"use client";

import { MaterialIcon } from "@/components/ui";

interface SuccessTicketProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
}

export function SuccessTicket({ isOpen, onClose, ticketId }: SuccessTicketProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md parchment-edge bg-surface border-2 border-dashed border-secondary/40 rounded-2xl p-8 text-center shadow-2xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1c1b1b] border-4 border-surface" />

        <MaterialIcon name="verified" className="text-success text-5xl block mb-4" filled />
        <h3 className="font-display text-headline-lg text-primary mb-2">
          Compra Realizada
        </h3>
        <p className="text-on-surface-variant text-body-md mb-6">
          Tu pedido ha sido procesado exitosamente en la Camara del Tesoro.
        </p>
        <div className="bg-surface-container rounded-xl p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-label-sm">
            <span className="text-on-surface-variant uppercase tracking-wider">Transaccion</span>
            <span className="text-on-surface font-mono">#B&B-{ticketId}</span>
          </div>
          <div className="flex justify-between text-label-sm">
            <span className="text-on-surface-variant uppercase tracking-wider">Fecha</span>
            <span className="text-on-surface">{new Date().toLocaleDateString("es-ES")}</span>
          </div>
          <div className="flex justify-between text-label-sm">
            <span className="text-on-surface-variant uppercase tracking-wider">Estado</span>
            <span className="text-success font-bold">Completado</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="bg-primary text-on-primary px-6 py-2 rounded-full font-medium text-body-md hover:opacity-90 transition-all"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}