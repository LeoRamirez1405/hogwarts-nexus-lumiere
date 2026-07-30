// En build-time (Next.js 16) NEXT_PUBLIC_API_URL se incrusta en el bundle.
// Si no se define, usamos mismo origen (/api proxy) en runtime del navegador,
// evitando el fallo clasico de caer a localhost en produccion.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:8000");

export interface PaginationParams {
  skip?: number;
  limit?: number;
  [key: string]: string | number | undefined | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

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
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error(error.detail || "Request failed");
  }

  if (res.status === 204) return null as T;
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
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
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
  getUsers: (pagination?: PaginationParams) =>
    request<Page<User>>("/users/" + buildQuery(pagination ?? {})),
  getUser: (id: string) => request<User>(`/users/${id}`),
  updateUser: (id: string, data: Partial<User>) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: "DELETE" }),
  setUserTitle: (id: string, title: string | null) =>
    request<User>(`/users/${id}/title`, {
      method: "PUT",
      body: JSON.stringify({ official_title: title }),
    }),
  getHousePoints: (house: string) =>
    request<HousePoints>(`/users/houses/${house}/points`),
  getAllHousePoints: () =>
    request<Record<string, number>>("/users/houses/all-points"),
  createUser: (data: { name: string; email: string; password: string; house?: string; role?: string }) =>
    request<User>("/users/", { method: "POST", body: JSON.stringify(data) }),
  adjustHousePoints: (userId: string, points: number, reason?: string) =>
    request<User>(`/users/${userId}/house-points`, {
      method: "POST",
      body: JSON.stringify({ points, reason }),
    }),
  adminResetPassword: (userId: string, newPassword: string) =>
    request<User>(`/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  // Products
  getProducts: (shop?: string, pagination?: PaginationParams, category?: string) =>
    request<Page<Product>>(`/products/${buildQuery({ shop, category, ...(pagination ?? {}) })}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  getPopularProducts: (shop: string, limit?: number) =>
    request<Product[]>(`/products/popular/${shop}${limit ? `?limit=${limit}` : ""}`),
  purchaseProduct: (id: string, quantity?: number) =>
    request<Product>(`/products/${id}/purchase`, {
      method: "POST",
      body: JSON.stringify({ quantity: quantity || 1 }),
    }),
  getMyPurchases: (pagination?: PaginationParams) =>
    request<Page<UserProduct>>("/products/my-purchases" + buildQuery(pagination ?? {})),
  createProduct: (data: Partial<Product>) =>
    request<Product>("/products/", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: "DELETE" }),

  // Articles
  getArticles: (params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return request<Page<Article>>(`/articles/?${searchParams.toString()}`);
  },
  getArticleCategories: () => request<string[]>("/articles/categories"),
  getArticle: (id: string) => request<Article>(`/articles/${id}`),
  createArticle: (data: Partial<Article>) =>
    request<Article>("/articles/", { method: "POST", body: JSON.stringify(data) }),
  updateArticle: (id: string, data: Partial<Article>) =>
    request<Article>(`/articles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteArticle: (id: string) =>
    request<void>(`/articles/${id}`, { method: "DELETE" }),
  subscribeArticle: (id: string) =>
    request<ArticleSubscription>(`/articles/${id}/subscribe`, { method: "POST" }),
  unsubscribeArticle: (id: string) =>
    request<void>(`/articles/${id}/subscribe`, { method: "DELETE" }),
  getMySubscriptions: () => request<Article[]>("/articles/my/subscriptions"),

  // Announcements
  getAnnouncements: (pagination?: PaginationParams) =>
    request<Page<Announcement>>("/announcements/" + buildQuery(pagination ?? {})),
  createAnnouncement: (data: Partial<Announcement>) =>
    request<Announcement>("/announcements/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAnnouncement: (id: string, data: Partial<Announcement>) =>
    request<Announcement>(`/announcements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAnnouncement: (id: string) =>
    request<void>(`/announcements/${id}`, { method: "DELETE" }),

  // Classifieds
  getClassifieds: (pagination?: PaginationParams) =>
    request<Page<Classified>>("/classifieds/" + buildQuery(pagination ?? {})),
  createClassified: (data: Partial<Classified>) =>
    request<Classified>("/classifieds/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateClassified: (id: string, data: Partial<Classified>) =>
    request<Classified>(`/classifieds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteClassified: (id: string) =>
    request<void>(`/classifieds/${id}`, { method: "DELETE" }),

  // Notifications
  getNotifications: () => request<Notification[]>("/notifications/"),
  getUnreadNotificationCount: () =>
    request<{ count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () =>
    request<void>("/notifications/read-all", { method: "PUT" }),
  markNotificationsRead: (ids: string[]) =>
    request<{ updated: number }>("/notifications/read-batch", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  // Article comments
  getArticleComments: (articleId: string) =>
    request<ArticleComment[]>(`/articles/${articleId}/comments`),
  createArticleComment: (articleId: string, body: string) =>
    request<ArticleComment>(`/articles/${articleId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  // Forum
  getThreads: (pagination?: PaginationParams) =>
    request<Page<ForumThread>>("/forum/" + buildQuery(pagination ?? {})),
  getThread: (id: string) => request<ForumThread>(`/forum/${id}`),
  createThread: (data: { title: string; body: string; category: string }) =>
    request<ForumThread>("/forum/", { method: "POST", body: JSON.stringify(data) }),
  voteThread: (id: string, value: 1 | -1) =>
    request<ForumThread>(`/forum/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),
  getThreadComments: (id: string) =>
    request<ForumComment[]>(`/forum/${id}/comments`),
  createThreadComment: (id: string, body: string) =>
    request<ForumComment>(`/forum/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  subscribeThread: (id: string) =>
    request<{ subscribed: boolean }>(`/forum/${id}/subscribe`, { method: "POST" }),
  unsubscribeThread: (id: string) =>
    request<void>(`/forum/${id}/subscribe`, { method: "DELETE" }),
  deleteThread: (id: string) =>
    request<void>(`/forum/${id}`, { method: "DELETE" }),

  // Creatures
  getCreatures: (pagination?: PaginationParams) =>
    request<Page<Creature>>("/creatures/" + buildQuery(pagination ?? {})),
  getCreature: (id: string) => request<Creature>(`/creatures/${id}`),
  createCreature: (data: Partial<Creature>) =>
    request<Creature>("/creatures/", { method: "POST", body: JSON.stringify(data) }),
  updateCreature: (id: string, data: Partial<Creature>) =>
    request<Creature>(`/creatures/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCreature: (id: string) =>
    request<void>(`/creatures/${id}`, { method: "DELETE" }),
  adoptCreature: (id: string, petName?: string) =>
    request<UserCreature>(`/creatures/${id}/adopt`, {
      method: "POST",
      body: JSON.stringify(petName ? { pet_name: petName } : {}),
    }),
  feedCreature: (userCreatureId: string, itemId: string) =>
    request<UserCreature>(`/creatures/${userCreatureId}/feed`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    }),
  playCreature: (userCreatureId: string, itemId: string) =>
    request<UserCreature>(`/creatures/${userCreatureId}/play`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    }),
  getMyCreatures: () => request<UserCreature[]>("/creatures/my"),
  getSanctuaryStats: () => request<SanctuaryStats>("/creatures/stats"),
  getCreatureMarket: () => request<MarketCreature[]>("/creatures/market"),
  listCreatureForSale: (userCreatureId: string, price: number) =>
    request<UserCreature>(`/creatures/${userCreatureId}/sell`, {
      method: "POST",
      body: JSON.stringify({ price }),
    }),
  unlistCreature: (userCreatureId: string) =>
    request<UserCreature>(`/creatures/${userCreatureId}/sell`, { method: "DELETE" }),
  buyMarketCreature: (userCreatureId: string) =>
    request<UserCreature>(`/creatures/market/${userCreatureId}/buy`, { method: "POST" }),

  // Pet items (food / toys)
  getPetItems: (params?: { kind?: string; pet_type?: string }, pagination?: PaginationParams) =>
    request<Page<PetItem>>(`/pet-items/${buildQuery({ ...(params ?? {}), ...(pagination ?? {}) })}`),
  getPetInventory: () => request<UserPetItem[]>("/pet-items/inventory"),
  buyPetItem: (id: string, quantity = 1) =>
    request<UserPetItem>(`/pet-items/${id}/buy${buildQuery({ quantity })}`, {
      method: "POST",
    }),
  createPetItem: (data: Partial<PetItem>) =>
    request<PetItem>("/pet-items/", { method: "POST", body: JSON.stringify(data) }),
  updatePetItem: (id: string, data: Partial<PetItem>) =>
    request<PetItem>(`/pet-items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePetItem: (id: string) =>
    request<void>(`/pet-items/${id}`, { method: "DELETE" }),

  // Messages
  getConversations: () => request<Conversation[]>("/messages/conversations"),
  getMessages: (userId: string, limit?: number, before?: string) =>
    request<MessagePage>(`/messages/${userId}${buildQuery({ limit, before })}`),
  sendMessage: (data: MessageSendData) =>
    request<Message>("/messages/", { method: "POST", body: JSON.stringify(data) }),
  getRooms: (all?: boolean, pagination?: PaginationParams) =>
    request<Page<ChatRoomBrief>>(`/messages/rooms${buildQuery({ all: all ? "true" : undefined, ...(pagination ?? {}) })}`),
  getRoom: (roomId: string) => request<ChatRoomResponse>(`/messages/rooms/${roomId}`),
  getRoomMessages: (roomId: string, limit?: number, before?: string) =>
    request<MessagePage>(
      `/messages/rooms/${roomId}/messages${buildQuery({ limit, before })}`
    ),
  // Pinning
  pinMessage: (messageId: string) =>
    request<Message>(`/messages/${messageId}/pin`, { method: "PUT" }),
  getRoomPinned: (roomId: string) =>
    request<Message[]>(`/messages/rooms/${roomId}/pinned`),
  getDmPinned: (userId: string) =>
    request<Message[]>(`/messages/dm/${userId}/pinned`),
  sendRoomMessage: (roomId: string, data: MessageSendData) =>
    request<Message>(`/messages/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createRoom: (data: CreateRoomData) =>
    request<ChatRoomResponse>("/messages/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (roomId: string, data: UpdateRoomData) =>
    request<ChatRoomResponse>(`/messages/rooms/${roomId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRoom: (roomId: string) =>
    request<void>(`/messages/rooms/${roomId}`, { method: "DELETE" }),
  addRoomMember: (roomId: string, userId: string, role?: string) =>
    request<ChatRoomMemberResponse>(`/messages/rooms/${roomId}/members?user_id=${userId}${role ? `&role=${role}` : ""}`, { method: "POST" }),
  removeRoomMember: (roomId: string, userId: string) =>
    request<void>(`/messages/rooms/${roomId}/members/${userId}`, { method: "DELETE" }),
  votePoll: (messageId: string, optionIds: string[]) =>
    request<{ ok: boolean }>(`/messages/${messageId}/poll/vote`, {
      method: "POST",
      body: JSON.stringify({ option_ids: optionIds }),
    }),
  removePollVote: (messageId: string, optionId: string) =>
    request<{ ok: boolean }>(`/messages/${messageId}/poll/vote?option_id=${optionId}`, { method: "DELETE" }),

  // Reactions
  addReaction: (messageId: string, emoji: string) =>
    request<MessageReaction>(`/messages/${messageId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),
  removeReaction: (messageId: string, emoji: string) =>
    request<void>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" }),

  // Room management
  toggleRoomClosed: (roomId: string) =>
    request<ChatRoomResponse>(`/messages/rooms/${roomId}/toggle-close`, { method: "PUT" }),
  hideConversation: (convType: "dm" | "room", convId: string) =>
    request<{ ok: boolean }>(`/messages/conversations/${convType}/${convId}/hide`, { method: "POST" }),
  unhideConversation: (convType: "dm" | "room", convId: string) =>
    request<{ ok: boolean }>(`/messages/conversations/${convType}/${convId}/hide`, { method: "DELETE" }),
  leaveRoom: (roomId: string) =>
    request<{ ok: boolean; room_deleted?: boolean }>(`/messages/rooms/${roomId}/leave`, { method: "DELETE" }),
  muteRoom: (roomId: string, duration: "8h" | "24h" | "forever" | "off") =>
    request<{ ok: boolean; muted_until: string | null }>(`/messages/rooms/${roomId}/mute`, {
      method: "PUT",
      body: JSON.stringify({ duration }),
    }),
  muteConversation: (convType: "dm" | "room", convId: string, duration: "8h" | "24h" | "forever" | "off") =>
    request<{ ok: boolean; muted_until: string | null }>(`/messages/conversations/${convType}/${convId}/mute`, {
      method: "PUT",
      body: JSON.stringify({ duration }),
    }),
  searchUsers: (q: string, friendsOnly?: boolean) =>
    request<UserSearchResult[]>(`/messages/users/search?q=${encodeURIComponent(q)}${friendsOnly ? "&friends_only=true" : ""}`),

  transcribeAudio: (blob: Blob): Promise<{ text: string }> => {
    const file = new File([blob], "voice.wav", { type: "audio/wav" });
    return uploadFile("/messages/transcribe", file);
  },

  // Posts
  getPosts: (pagination?: PaginationParams) =>
    request<Page<Post>>("/posts/" + buildQuery(pagination ?? {})),
  getProfileFeed: (userId: string, pagination?: PaginationParams) =>
    request<Page<Post>>(`/posts/user/${userId}` + buildQuery(pagination ?? {})),
  createPost: (data: { body: string; image_url?: string }) =>
    request<Post>("/posts/", { method: "POST", body: JSON.stringify(data) }),
  updatePost: (id: string, data: { body: string; image_url?: string }) =>
    request<Post>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePost: (id: string) =>
    request<void>(`/posts/${id}`, { method: "DELETE" }),
  likePost: (id: string) =>
    request<Post>(`/posts/${id}/like`, { method: "POST" }),
  repostPost: (id: string) =>
    request<Post>(`/posts/${id}/repost`, { method: "POST" }),
  getComments: (postId: string) =>
    request<PostComment[]>(`/posts/${postId}/comments`),
  addComment: (postId: string, body: string) =>
    request<PostComment>(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  // Transactions
  getTransactions: (pagination?: PaginationParams, type?: string) =>
    request<Page<Transaction>>("/transactions/" + buildQuery({ type, ...(pagination ?? {}) })),
  getAllTransactionsAdmin: (pagination?: PaginationParams, type?: string) =>
    request<Page<Transaction>>("/transactions/admin/all" + buildQuery({ type, ...(pagination ?? {}) })),
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
  getDashboard: () => request<DashboardData>("/dashboard/"),

  // Friend Requests
  getFriendRequests: () => request<FriendRequest[]>("/friend-requests/"),
  getFriends: (userId: string) => request<User[]>(`/friend-requests/friends/${userId}`),
  sendFriendRequest: (receiver_id: string) =>
    request<FriendRequest>("/friend-requests/", { method: "POST", body: JSON.stringify({ receiver_id }) }),
  acceptFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/accept`, { method: "PUT" }),
  rejectFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/reject`, { method: "PUT" }),
  cancelFriendRequest: (id: string) =>
    request<void>(`/friend-requests/${id}`, { method: "DELETE" }),

  // Upload
  uploadFile: (file: File) =>
    uploadFile<{ url: string; type: string; original_name: string }>("/upload", file),

  // Support
  sendSupportReport: (type: string, description: string, screenshot?: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const formData = new FormData();
    formData.append("report_type", type);
    formData.append("description", description);
    if (screenshot) formData.append("screenshot", screenshot);

    return fetch(`${API_BASE}/support`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al enviar");
      return data;
    });
  },

  // Enum Types (Admin Settings)
  getEnumCategories: (pagination?: PaginationParams) =>
    request<Page<EnumCategory>>("/enum-types/categories" + buildQuery(pagination ?? {})),
  getEnumCategory: (id: string) => request<EnumCategory>(`/enum-types/categories/${id}`),
  getEnumCategoryByCode: (code: string) => request<EnumCategory>(`/enum-types/categories/code/${code}`),
  createEnumCategory: (data: EnumCategoryCreate) =>
    request<EnumCategory>("/enum-types/categories", { method: "POST", body: JSON.stringify(data) }),
  updateEnumCategory: (id: string, data: EnumCategoryUpdate) =>
    request<EnumCategory>(`/enum-types/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEnumCategory: (id: string) =>
    request<void>(`/enum-types/categories/${id}`, { method: "DELETE" }),

  getEnumValues: (categoryId: string) => request<EnumValue[]>(`/enum-types/categories/${categoryId}/values`),
  createEnumValue: (categoryId: string, data: EnumValueCreate) =>
    request<EnumValue>(`/enum-types/categories/${categoryId}/values`, { method: "POST", body: JSON.stringify(data) }),
  updateEnumValue: (valueId: string, data: EnumValueUpdate) =>
    request<EnumValue>(`/enum-types/values/${valueId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEnumValue: (valueId: string) =>
    request<void>(`/enum-types/values/${valueId}`, { method: "DELETE" }),
};

// Types
export interface MagicLevelInfo {
  level: number;
  name: string;
  xp: number;
  progress: number;
  next_xp: number;
}

export interface HousePoints {
  house: string;
  points: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  zerines: number;
  house_points: number;
  avatar_url?: string;
  house?: string;
  bio?: string;
  status?: string;
  wand?: string;
  location?: string;
  official_title?: string;
  last_active_at?: string;
  magic_level?: MagicLevelInfo;
  sanctuary_penalty?: number;
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
  weekly_sales?: number;
  created_at: string;
}

export interface UserProduct {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  purchased_at: string;
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
  pinned?: boolean;
  created_at: string;
  subscribed?: boolean;
}

export interface ArticleSubscription {
  id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  body: string;
  created_at: string;
}

export interface Classified {
  id: string;
  title: string;
  price: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_id?: string;
  actor_id?: string;
  actor?: User;
  read: boolean;
  created_at: string;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: User;
}

export interface ForumThread {
  id: string;
  author_id: string;
  author?: User;
  title: string;
  body: string;
  category: string;
  created_at: string;
  vote_count: number;
  my_vote: number;
  comment_count: number;
  subscribed: boolean;
}

export interface ForumComment {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: User;
}

export type PetType = "Aves" | "Bestias" | "Criaturas pequeñas";
export type PetItemKind = "food" | "toy";

export interface Creature {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "legendary" | "ethereal";
  pet_type: PetType;
  price: number;
  image_url?: string;
  required_user_level: number;
  required_sanctuary_level: number;
  ability?: string | null;
  created_at: string;
}

export interface UserCreature {
  id: string;
  user_id: string;
  creature_id: string;
  creature?: Creature;
  pet_name?: string | null;
  level: number;
  level_name: string;
  hunger: number;
  happiness: number;
  mood: string;
  age_days: number;
  stage: string;
  for_sale: boolean;
  sale_price?: number | null;
  is_critical?: boolean;
  adopted_at: string;
}

export interface MarketCreature {
  id: string;
  creature?: Creature;
  pet_name?: string | null;
  level: number;
  level_name: string;
  stage: string;
  sale_price: number;
  seller_id: string;
  seller_name: string;
}

export interface LevelProgress {
  current_floor: number | null;
  next_threshold: number | null;
  percent: number;
}

export interface SanctuaryStats {
  sanctuary_level: number;
  sanctuary_score: number;
  sanctuary_max: number;
  sanctuary_progress: LevelProgress;
  user_level: number;
  user_level_name: string;
  user_level_max: number;
  user_progress: number; // 0..1 toward next user level
  pets_count: number;
  sanctuary_penalty?: number;
}

export interface PetItem {
  id: string;
  name: string;
  description?: string;
  kind: PetItemKind;
  pet_type: PetType;
  price: number;
  restore_amount: number;
  pack_size: number;
  image_url?: string;
  created_at: string;
}

export interface UserPetItem {
  id: string;
  pet_item_id: string;
  quantity: number;
  pet_item?: PetItem;
}

export interface MessageMetadata {
  transcription?: string;
  size?: number;
  duration?: number;
  post?: SharedPostMeta;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string;
  room_id?: string;
  reply_to_id?: string;
  kind: "text" | "image" | "video" | "audio" | "document" | "sticker" | "poll" | "voice" | "post";
  body?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  metadata?: MessageMetadata;
  read: boolean;
  pinned?: boolean;
  created_at: string;
  sender?: User;
  receiver?: User;
  room?: ChatRoomBrief;
  poll?: PollResponse;
  reply_to?: Message;
  reactions?: MessageReaction[];
}

export interface MessagePage {
  messages: Message[];
  has_more: boolean;
  first_unread_id?: string | null;
  unread_count: number;
}

export interface Conversation {
  type: "direct" | "room";
  id: string;
  name: string;
  avatar_url?: string;
  subtitle?: string;
  email?: string;
  house?: string;
  zerines?: number;
  last_message?: Message;
  unread_count: number;
  is_muted?: boolean;
  last_active_at?: string;
  online_count?: number;
}

export interface Post {
  id: string;
  author_id: string;
  author?: User;
  body: string;
  image_url?: string;
  likes_count?: number;
  liked_by_me?: boolean;
  reposts_count?: number;
  reposted_by_me?: boolean;
  comments_count?: number;
  // Repost feed metadata (present when this feed item is a repost)
  is_repost?: boolean;
  reposted_by?: User;
  reposted_at?: string;
  edited_at?: string | null;
  edited_by?: User | null;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  author?: User;
  body: string;
  created_at: string;
}

// Shape stored in message.metadata.post when a post is shared into a chat
export interface SharedPostMeta {
  id: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  body: string;
  image_url?: string;
  created_at?: string;
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

// Chat Rooms
export interface ChatRoomMemberResponse {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user?: User;
}

export interface ChatRoomBrief {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  closed: boolean;
  created_by: string;
  created_at: string;
  member_count: number;
}

export interface ChatRoomResponse {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  closed: boolean;
  created_by: string;
  created_at: string;
  members: ChatRoomMemberResponse[];
}

export interface CreateRoomData {
  name: string;
  description?: string;
  avatar_url?: string;
  type: string;
  member_ids: string[];
}

export interface UpdateRoomData {
  name?: string;
  description?: string;
  avatar_url?: string;
}

export interface MessageSendData {
  receiver_id?: string;
  room_id?: string;
  reply_to_id?: string;
  body?: string;
  kind?: "text" | "image" | "video" | "audio" | "document" | "sticker" | "poll" | "voice" | "post";
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  metadata?: MessageMetadata;
  poll?: {
    question: string;
    options: string[];
    multi_choice: boolean;
  };
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// Polls
export interface PollOptionResponse {
  id: string;
  label: string;
  option_index: number;
  votes_count: number;
  voted_by_me: boolean;
}

export interface PollResponse {
  id: string;
  question: string;
  multi_choice: boolean;
  total_votes: number;
  options: PollOptionResponse[];
  my_option_ids: string[];
}

export interface UserSearchResult {
  id: string;
  name: string;
  avatar_url?: string;
  house?: string;
}

// Enum Types (admin settings)
export interface EnumValue {
  id: string;
  category_id: string;
  label: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface EnumCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
  values: EnumValue[];
}

export interface EnumCategoryCreate {
  code: string;
  name: string;
  description?: string;
}

export interface EnumCategoryUpdate {
  name?: string;
  description?: string;
}

export interface EnumValueCreate {
  label: string;
  description?: string;
}

export interface EnumValueUpdate {
  label?: string;
  description?: string;
}