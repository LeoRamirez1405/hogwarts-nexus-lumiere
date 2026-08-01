import { request } from "../core";
import type { User } from "./users";

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  sender?: User;
  receiver?: User;
}

export const friendRequestsApi = {
  getFriendRequests: () => request<FriendRequest[]>("/friend-requests/"),

  getFriends: (userId: string) =>
    request<User[]>(`/friend-requests/friends/${userId}`),

  getFriendsPage: (
    userId: string,
    pagination?: { skip?: number; limit?: number }
  ) => {
    const parts: string[] = [];
    if (pagination?.skip !== undefined)
      parts.push(`skip=${pagination.skip}`);
    if (pagination?.limit !== undefined)
      parts.push(`limit=${pagination.limit}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    return request<import("./core").Page<User>>(
      `/friend-requests/friends/${userId}/paginated${qs}`
    );
  },

  unfriend: (userId: string) =>
    request<void>(`/friend-requests/unfriend/${userId}`, {
      method: "DELETE",
    }),

  sendFriendRequest: (receiver_id: string) =>
    request<FriendRequest>("/friend-requests/", {
      method: "POST",
      body: JSON.stringify({ receiver_id }),
    }),

  acceptFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/accept`, {
      method: "PUT",
    }),

  rejectFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/reject`, {
      method: "PUT",
    }),

  cancelFriendRequest: (id: string) =>
    request<void>(`/friend-requests/${id}`, { method: "DELETE" }),
};