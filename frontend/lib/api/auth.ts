import { request } from "../core";
import type { User } from "./users";

export interface LoginResponse {
  token_type: string;
  user: User;
}

export interface RefreshResponse {
  token_type: string;
}

export interface LogoutResponse {
  message: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    name: string;
    email: string;
    password: string;
    house?: string;
  }) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMe: () => request<User>("/auth/me"),

  refresh: () =>
    request<RefreshResponse>("/auth/refresh", { method: "POST" }),

  logout: () =>
    request<LogoutResponse>("/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<ChangePasswordResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
};