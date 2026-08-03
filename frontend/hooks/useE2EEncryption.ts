"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { e2eApi } from "@/lib/api/e2e";
import { useAuthStore } from "@/lib/authStore";

interface SessionState {
  established: boolean;
  loading: boolean;
  error: string | null;
}

interface SafetyNumberState {
  safetyNumber: string | null;
  verified: boolean;
  loading: boolean;
}

export function useE2EEncryption() {
  const { user } = useAuthStore();
  const [sessionStates, setSessionStates] = useState<Record<string, SessionState>>({});
  const [safetyNumberStates, setSafetyNumberStates] = useState<Record<string, SafetyNumberState>>({});
  const [identityInitialized, setIdentityInitialized] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(false);
  const initLockRef = useRef(false);

  const ensureIdentity = useCallback(async (): Promise<boolean> => {
    if (identityInitialized) return true;
    if (initLockRef.current) {
      while (initLockRef.current) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return identityInitialized;
    }
    initLockRef.current = true;
    setIdentityLoading(true);
    try {
      await e2eApi.getMyIdentity();
      setIdentityInitialized(true);
      return true;
    } catch (err) {
      console.error("[E2E] Failed to ensure identity:", err);
      return false;
    } finally {
      setIdentityLoading(false);
      initLockRef.current = false;
    }
  }, [identityInitialized]);

  const establishSession = useCallback(
    async (recipientId: string): Promise<boolean> => {
      const ok = await ensureIdentity();
      if (!ok) return false;

      if (sessionStates[recipientId]?.established) return true;

      setSessionStates((prev) => ({
        ...prev,
        [recipientId]: { established: false, loading: true, error: null },
      }));

      try {
        const recipientIdentity = await e2eApi.getUserIdentity(recipientId);
        const recipientSignedPrekey = await e2eApi.getUserSignedPrekey(recipientId);

        let recipientPrekey: ReturnType<typeof e2eApi.getUserIdentity> extends never ? never : Awaited<ReturnType<typeof e2eApi.getUserPrekeys>>["prekeys"][number] | null = null;
        try {
          const prekeysResponse = await e2eApi.getUserPrekeys(recipientId, 1);
          if (prekeysResponse.prekeys.length > 0) {
            recipientPrekey = prekeysResponse.prekeys[0];
          }
        } catch {
          // Prekeys optional - X3DH can work with signed prekey only
        }

        await e2eApi.initiateSession({
          recipient_id: recipientId,
          recipient_identity_key: recipientIdentity.identity_key_public,
          recipient_signed_prekey: recipientSignedPrekey,
          recipient_prekey: recipientPrekey,
        });

        setSessionStates((prev) => ({
          ...prev,
          [recipientId]: { established: true, loading: false, error: null },
        }));
        return true;
      } catch (err) {
        console.error(`[E2E] Failed to establish session with ${recipientId}:`, err);
        setSessionStates((prev) => ({
          ...prev,
          [recipientId]: {
            established: false,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to establish session",
          },
        }));
        return false;
      }
    },
    [ensureIdentity, sessionStates]
  );

  const encryptMessage = useCallback(
    async (recipientId: string, plaintext: string): Promise<{ ciphertext: string; message: string } | null> => {
      const ok = await ensureIdentity();
      if (!ok) return null;

      const sessionOk = await establishSession(recipientId);
      if (!sessionOk) return null;

      try {
        const plaintextB64 = btoa(unescape(encodeURIComponent(plaintext)));
        const result = await e2eApi.encrypt({
          recipient_id: recipientId,
          plaintext: plaintextB64,
        });
        return { ciphertext: result.ciphertext, message: result.message };
      } catch (err) {
        console.error(`[E2E] Failed to encrypt message for ${recipientId}:`, err);
        return null;
      }
    },
    [ensureIdentity, establishSession]
  );

  const decryptMessage = useCallback(
    async (senderId: string, encryptedMessage: string): Promise<string | null> => {
      const ok = await ensureIdentity();
      if (!ok) return null;

      try {
        const result = await e2eApi.decrypt({
          sender_id: senderId,
          message: encryptedMessage,
        });
        return decodeURIComponent(escape(atob(result.plaintext)));
      } catch (err) {
        console.error(`[E2E] Failed to decrypt message from ${senderId}:`, err);
        return null;
      }
    },
    [ensureIdentity]
  );

  const loadSafetyNumber = useCallback(
    async (remoteUserId: string): Promise<void> => {
      setSafetyNumberStates((prev) => ({
        ...prev,
        [remoteUserId]: {
          safetyNumber: prev[remoteUserId]?.safetyNumber || null,
          verified: prev[remoteUserId]?.verified || false,
          loading: true,
        },
      }));

      try {
        const remoteIdentity = await e2eApi.getUserIdentity(remoteUserId);
        const result = await e2eApi.computeSafetyNumber({
          remote_user_id: remoteUserId,
          remote_identity_key: remoteIdentity.identity_key_public,
          remote_registration_id: remoteIdentity.registration_id,
        });

        let verified = false;
        try {
          const stored = await e2eApi.getSafetyNumber(remoteUserId);
          verified = stored.safety_number === result.safety_number;
        } catch {
          // Not stored yet
        }

        setSafetyNumberStates((prev) => ({
          ...prev,
          [remoteUserId]: {
            safetyNumber: result.safety_number,
            verified,
            loading: false,
          },
        }));
      } catch (err) {
        console.error(`[E2E] Failed to load safety number for ${remoteUserId}:`, err);
        setSafetyNumberStates((prev) => ({
          ...prev,
          [remoteUserId]: {
            safetyNumber: null,
            verified: false,
            loading: false,
          },
        }));
      }
    },
    []
  );

  const verifySafetyNumber = useCallback(async (remoteUserId: string): Promise<boolean> => {
    const state = safetyNumberStates[remoteUserId];
    if (!state?.safetyNumber) return false;

    const remoteIdentity = await e2eApi.getUserIdentity(remoteUserId);
    const verifyResult = await e2eApi.verifySafetyNumber({
      remote_user_id: remoteUserId,
      remote_identity_key: remoteIdentity.identity_key_public,
      remote_registration_id: remoteIdentity.registration_id,
      displayed_number: state.safetyNumber,
    });

    if (verifyResult.verified) {
      await e2eApi.storeSafetyNumber({
        remote_user_id: remoteUserId,
        safety_number: state.safetyNumber,
        verified: true,
        verification_method: "manual_compare",
      });
      setSafetyNumberStates((prev) => ({
        ...prev,
        [remoteUserId]: { ...prev[remoteUserId], verified: true },
      }));
    }
    return verifyResult.verified;
  }, [safetyNumberStates]);

  useEffect(() => {
    if (user && !identityInitialized && !identityLoading) {
      ensureIdentity();
    }
  }, [user, identityInitialized, identityLoading, ensureIdentity]);

  return {
    identityInitialized,
    identityLoading,
    sessionStates,
    safetyNumberStates,
    ensureIdentity,
    establishSession,
    encryptMessage,
    decryptMessage,
    loadSafetyNumber,
    verifySafetyNumber,
  };
}
