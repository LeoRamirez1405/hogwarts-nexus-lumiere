import { request } from "./core/client";

export interface IdentityKeyResponse {
  identity_key_public: string;
  signing_key_public: string;
  registration_id: number;
}

export interface PreKeyResponse {
  prekey_id: number;
  public_key: string;
}

export interface PreKeyBatchResponse {
  prekeys: PreKeyResponse[];
}

export interface SignedPreKeyResponse {
  prekey_id: number;
  public_key: string;
  signature: string;
  timestamp: number;
}

export interface SessionInitRequest {
  recipient_id: string;
  recipient_identity_key: string;
  recipient_signed_prekey: SignedPreKeyResponse;
  recipient_prekey?: PreKeyResponse | null;
}

export interface SessionInitResponse {
  session_id: string;
  initial_message: string;
}

export interface SessionReceiveRequest {
  sender_id: string;
  sender_identity_key: string;
  message: string;
}

export interface EncryptRequest {
  recipient_id: string;
  plaintext: string;
}

export interface EncryptResponse {
  ciphertext: string;
  message: string;
}

export interface DecryptRequest {
  sender_id: string;
  message: string;
}

export interface DecryptResponse {
  plaintext: string;
}

export interface SafetyNumberRequest {
  remote_user_id: string;
  remote_identity_key: string;
  remote_registration_id: number;
}

export interface SafetyNumberResponse {
  safety_number: string;
}

export interface SafetyNumberVerifyRequest extends SafetyNumberRequest {
  displayed_number: string;
}

export interface SafetyNumberVerifyResponse {
  verified: boolean;
}

export interface SafetyNumberStoreRequest {
  remote_user_id: string;
  safety_number: string;
  verified?: boolean;
  verification_method?: string | null;
}

export const e2eApi = {
  getMyIdentity: () => request<IdentityKeyResponse>("/e2e/identity"),
  rotateIdentity: () => request<IdentityKeyResponse>("/e2e/identity/rotate", { method: "POST" }),

  getPrekeys: (count = 50) => request<PreKeyBatchResponse>(`/e2e/prekeys?count=${count}`),
  consumePrekey: (prekeyId: number) => request<PreKeyResponse>(`/e2e/prekeys/consume/${prekeyId}`, { method: "POST" }),

  getSignedPrekey: () => request<SignedPreKeyResponse>("/e2e/signed-prekey"),
  rotateSignedPrekey: () => request<SignedPreKeyResponse>("/e2e/signed-prekey/rotate", { method: "POST" }),

  initiateSession: (data: SessionInitRequest) =>
    request<SessionInitResponse>("/e2e/session/initiate", { method: "POST", body: JSON.stringify(data) }),
  receiveSession: (data: SessionReceiveRequest) =>
    request<{ status: string; session_id: string }>("/e2e/session/receive", { method: "POST", body: JSON.stringify(data) }),

  encrypt: (data: EncryptRequest) =>
    request<EncryptResponse>("/e2e/encrypt", { method: "POST", body: JSON.stringify(data) }),
  decrypt: (data: DecryptRequest) =>
    request<DecryptResponse>("/e2e/decrypt", { method: "POST", body: JSON.stringify(data) }),

  computeSafetyNumber: (data: SafetyNumberRequest) =>
    request<SafetyNumberResponse>("/e2e/safety-number/compute", { method: "POST", body: JSON.stringify(data) }),
  verifySafetyNumber: (data: SafetyNumberVerifyRequest) =>
    request<SafetyNumberVerifyResponse>("/e2e/safety-number/verify", { method: "POST", body: JSON.stringify(data) }),
  storeSafetyNumber: (data: SafetyNumberStoreRequest) =>
    request<{ status: string }>("/e2e/safety-number/store", { method: "POST", body: JSON.stringify(data) }),
  getSafetyNumber: (remoteUserId: string) =>
    request<SafetyNumberResponse>(`/e2e/safety-number/${remoteUserId}`),

  getUserIdentity: (userId: string) =>
    request<IdentityKeyResponse>(`/e2e/keys/${userId}/identity`),
  getUserSignedPrekey: (userId: string) =>
    request<SignedPreKeyResponse>(`/e2e/keys/${userId}/signed-prekey`),
  getUserPrekeys: (userId: string, count = 1) =>
    request<PreKeyBatchResponse>(`/e2e/keys/${userId}/prekeys?count=${count}`),
};
