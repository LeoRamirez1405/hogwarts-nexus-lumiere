const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Request failed");
  }

  return res.json();
}

async function uploadFile<T>(
  path: string,
  file: File,
  fieldName: string = "file"
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const formData = new FormData();
  formData.append(fieldName, file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Upload failed");
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; user: User }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  register: (data: {
    name: string;
    email: string;
    password: string;
    house?: string;
  }) => request<User>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  getMe: () => request<User>("/auth/me"),

  // Users
  getUsers: () => request<User[]>("/users"),
  getUser: (id: string) => request<User>(`/users/${id}`),
  updateUser: (id: string, data: Partial<User>) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: "DELETE" }),

  // Products
  getProducts: (shop?: string) =>
    request<Product[]>(`/products${shop ? `?shop=${shop}` : ""}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  getPopularProducts: (shop: string, limit?: number) =>
    request<Product[]>(`/products/popular/${shop}${limit ? `?limit=${limit}` : ""}`),
  purchaseProduct: (id: string, quantity?: number) =>
    request<Product>(`/products/${id}/purchase`, { method: "POST", body: JSON.stringify({ quantity: quantity || 1 }) }),
  createProduct: (data: Partial<Product>) =>
    request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: "DELETE" }),

  // Articles
  getArticles: () => request<Article[]>("/articles"),
  getArticle: (id: string) => request<Article>(`/articles/${id}`),
  createArticle: (data: Partial<Article>) =>
    request<Article>("/articles", { method: "POST", body: JSON.stringify(data) }),
  updateArticle: (id: string, data: Partial<Article>) =>
    request<Article>(`/articles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteArticle: (id: string) =>
    request<void>(`/articles/${id}`, { method: "DELETE" }),

  // Creatures
  getCreatures: () => request<Creature[]>("/creatures"),
  getCreature: (id: string) => request<Creature>(`/creatures/${id}`),
  createCreature: (data: Partial<Creature>) =>
    request<Creature>("/creatures", { method: "POST", body: JSON.stringify(data) }),
  updateCreature: (id: string, data: Partial<Creature>) =>
    request<Creature>(`/creatures/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCreature: (id: string) =>
    request<void>(`/creatures/${id}`, { method: "DELETE" }),
  adoptCreature: (id: string) =>
    request<UserCreature>(`/creatures/${id}/adopt`, { method: "POST" }),
  feedCreature: (id: string) =>
    request<UserCreature>(`/creatures/${id}/feed`, { method: "POST" }),
  playCreature: (id: string) =>
    request<UserCreature>(`/creatures/${id}/play`, { method: "POST" }),
  getMyCreatures: () => request<UserCreature[]>("/creatures/my"),

  // Messages
  getConversations: () => request<Conversation[]>("/messages/conversations"),
  getMessages: (userId: string) => request<Message[]>(`/messages/${userId}`),
  sendMessage: (data: { receiver_id: string; body: string; attachment_url?: string; attachment_type?: string }) =>
    request<Message>("/messages", { method: "POST", body: JSON.stringify(data) }),

  // Posts
  getPosts: () => request<Post[]>("/posts"),
  createPost: (data: { body: string; image_url?: string }) =>
    request<Post>("/posts", { method: "POST", body: JSON.stringify(data) }),
  likePost: (id: string) =>
    request<{ liked: boolean; likes_count: number }>(`/posts/${id}/like`, {
      method: "POST",
    }),

  // Transactions
  getTransactions: () => request<Transaction[]>("/transactions"),
  getAllTransactionsAdmin: () => request<Transaction[]>("/transactions/admin/all"),
  deposit: (amount: number, description?: string) =>
    request<Transaction>("/transactions/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    }),
  withdraw: (amount: number, description?: string) =>
    request<Transaction>("/transactions/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    }),
  transfer: (receiver_id: string, amount: number, description?: string) =>
    request<Transaction>("/transactions/transfer", {
      method: "POST",
      body: JSON.stringify({ receiver_id, amount, description }),
    }),

  // Dashboard
  getDashboard: () => request<DashboardData>("/dashboard"),

  // Friend Requests
  getFriendRequests: () => request<FriendRequest[]>("/friend-requests"),
  sendFriendRequest: (receiver_id: string) =>
    request<FriendRequest>("/friend-requests", { method: "POST", body: JSON.stringify({ receiver_id }) }),
  acceptFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/accept`, { method: "PUT" }),
  rejectFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/reject`, { method: "PUT" }),
  cancelFriendRequest: (id: string) =>
    request<void>(`/friend-requests/${id}`, { method: "DELETE" }),

  // Upload
  uploadFile: (file: File) => uploadFile<{ url: string; type: string; original_name: string }>("/upload", file),
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  zerines: number;
  avatar_url?: string;
  house?: string;
  bio?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  shop: "borgin" | "flourish";
  image_url?: string;
  stock: number;
  created_at: string;
}

export interface Article {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author?: User;
  category: string;
  image_url?: string;
  featured: boolean;
  created_at: string;
}

export interface Creature {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "legendary" | "ethereal";
  price: number;
  image_url?: string;
  created_at: string;
}

export interface UserCreature {
  id: string;
  user_id: string;
  creature_id: string;
  creature?: Creature;
  level: number;
  hunger: number;
  happiness: number;
  adopted_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender?: User;
  receiver?: User;
  body: string;
  attachment_url?: string;
  attachment_type?: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  user: User;
  last_message: Message;
  unread_count: number;
}

export interface Post {
  id: string;
  author_id: string;
  author?: User;
  body: string;
  image_url?: string;
  likes_count?: number;
  liked?: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  sender?: User;
  receiver?: User;
  amount: number;
  type: "deposit" | "withdrawal" | "transfer" | "purchase";
  description: string;
  status: "pending" | "confirmed" | "completed";
  created_at: string;
}

export interface DashboardData {
  // Admin fields
  total_users?: number;
  total_products?: number;
  total_articles?: number;
  total_creatures?: number;
  total_zerines_in_circulation?: number;
  recent_transactions?: Transaction[];
  // User fields
  zerines?: number;
  my_creatures?: number;
  my_posts?: number;
  total_likes_received?: number;
  unread_messages?: number;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  sender?: User;
  receiver?: User;
}
