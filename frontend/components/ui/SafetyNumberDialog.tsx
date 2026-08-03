"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface SafetyNumberDialogProps {
  open: boolean;
  onClose: () => void;
  remoteUserId: string;
  remoteUserName: string;
  safetyNumber: string | null;
  verified: boolean;
  loading: boolean;
  onVerify: () => Promise<boolean>;
}

function formatSafetyNumber(sn: string): string {
  if (!sn) return "";
  const groups: string[] = [];
  for (let i = 0; i < sn.length; i += 5) {
    groups.push(sn.slice(i, i + 5));
  }
  return groups.join(" ");
}

export default function SafetyNumberDialog({
  open,
  onClose,
  remoteUserName,
  safetyNumber,
  verified,
  loading,
  onVerify,
}: SafetyNumberDialogProps) {
  const [verifying, setVerifying] = useState(false);
  const [localVerified, setLocalVerified] = useState<boolean | null>(null);

  const isVerified = localVerified ?? verified;

  const handleVerify = async () => {
    setVerifying(true);
    const ok = await onVerify();
    setLocalVerified(ok);
    setVerifying(false);
  };

  const handleClose = () => {
    setLocalVerified(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Numero de seguridad" size="sm">
      <div className="space-y-4">
        <p className="text-body-sm text-on-surface-variant">
          Verifica el numero de seguridad con{" "}
          <span className="font-semibold text-on-surface">{remoteUserName}</span>{" "}
          para confirmar que la conversacion es privada y no ha sido interceptada.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <MaterialIcon name="progress_activity" className="text-[2em] animate-spin text-primary" />
          </div>
        ) : safetyNumber ? (
          <>
            <div className="bg-surface-container-high rounded-xl p-4 text-center">
              <p className="font-mono text-base tracking-wider break-all text-on-surface">
                {formatSafetyNumber(safetyNumber)}
              </p>
            </div>

            {isVerified ? (
              <div className="flex items-center justify-center gap-2 py-3 text-secondary">
                <MaterialIcon name="verified" className="text-[1.5em]" />
                <span className="text-body-sm font-medium">Verificado</span>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleVerify}
                loading={verifying}
                className="w-full"
                icon="verified"
              >
                Verificar numero
              </Button>
            )}

            <p className="text-xs text-on-surface-variant text-center">
              Compara este numero con {remoteUserName} en persona o por otra via verificada.
            </p>
          </>
        ) : (
          <div className="text-center py-8 text-on-surface-variant">
            <MaterialIcon name="error" className="text-[2em] mx-auto mb-2" />
            <p className="text-body-sm">No se pudo cargar el numero de seguridad</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
