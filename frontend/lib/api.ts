const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  getUsers: () => request<User[]>("/users"),
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

  // Products
  getProducts: (shop?: string) =>
    request<Product[]>(`/products${shop ? `?shop=${shop}` : ""}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  getPopularProducts: (shop: string, limit?: number) =>
    request<Product[]>(`/products/popular/${shop}${limit ? `?limit=${limit}` : ""}`),
  purchaseProduct: (id: string, quantity?: number) =>
    request<Product>(`/products/${id}/purchase`, {
      method: "POST",
      body: JSON.stringify({ quantity: quantity || 1 }),
    }),
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
  subscribeArticle: (id: string) =>
    request<ArticleSubscription>(`/articles/${id}/subscribe`, { method: "POST" }),
  unsubscribeArticle: (id: string) =>
    request<void>(`/articles/${id}/subscribe`, { method: "DELETE" }),
  getMySubscriptions: () => request<Article[]>("/articles/my/subscriptions"),

  // Notifications
  getNotifications: () => request<Notification[]>("/notifications"),
  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () =>
    request<void>("/notifications/read-all", { method: "PUT" }),

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

  // Pet items (food / toys)
  getPetItems: (params?: { kind?: string; pet_type?: string }) =>
    request<PetItem[]>(`/pet-items${buildQuery(params ?? {})}`),
  getPetInventory: () => request<UserPetItem[]>("/pet-items/inventory"),
  buyPetItem: (id: string, quantity = 1) =>
    request<UserPetItem>(`/pet-items/${id}/buy${buildQuery({ quantity })}`, {
      method: "POST",
    }),
  createPetItem: (data: Partial<PetItem>) =>
    request<PetItem>("/pet-items", { method: "POST", body: JSON.stringify(data) }),
  updatePetItem: (id: string, data: Partial<PetItem>) =>
    request<PetItem>(`/pet-items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePetItem: (id: string) =>
    request<void>(`/pet-items/${id}`, { method: "DELETE" }),

  // Messages
  getConversations: () => request<Conversation[]>("/messages/conversations"),
  getMessages: (userId: string, limit?: number, before?: string) =>
    request<MessagePage>(`/messages/${userId}${buildQuery({ limit, before })}`),
  sendMessage: (data: MessageSendData) =>
    request<Message>("/messages", { method: "POST", body: JSON.stringify(data) }),
  getRooms: (all?: boolean) => request<ChatRoomBrief[]>(`/messages/rooms${all ? "?all=true" : ""}`),
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
  searchUsers: (q: string, friendsOnly?: boolean) =>
    request<UserSearchResult[]>(`/messages/users/search?q=${encodeURIComponent(q)}${friendsOnly ? "&friends_only=true" : ""}`),

  transcribeAudio: (blob: Blob): Promise<{ text: string }> => {
    const file = new File([blob], "voice.wav", { type: "audio/wav" });
    return uploadFile("/messages/transcribe", file);
  },

  // Posts
  getPosts: () => request<Post[]>("/posts"),
  getProfileFeed: (userId: string) => request<Post[]>(`/posts/user/${userId}`),
  createPost: (data: { body: string; image_url?: string }) =>
    request<Post>("/posts", { method: "POST", body: JSON.stringify(data) }),
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
  getFriends: (userId: string) => request<User[]>(`/friend-requests/friends/${userId}`),
  sendFriendRequest: (receiver_id: string) =>
    request<FriendRequest>("/friend-requests", { method: "POST", body: JSON.stringify({ receiver_id }) }),
  acceptFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/accept`, { method: "PUT" }),
  rejectFriendRequest: (id: string) =>
    request<FriendRequest>(`/friend-requests/${id}/reject`, { method: "PUT" }),
  cancelFriendRequest: (id: string) =>
    request<void>(`/friend-requests/${id}`, { method: "DELETE" }),

  // Upload
  uploadFile: (file: File) =>
    uploadFile<{ url: string; type: string; original_name: string }>("/upload", file),
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
  avatar_url?: string;
  house?: string;
  bio?: string;
  status?: string;
  wand?: string;
  location?: string;
  official_title?: string;
  last_active_at?: string;
  magic_level?: MagicLevelInfo;
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
  subscribed?: boolean;
}

export interface ArticleSubscription {
  id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_id?: string;
  read: boolean;
  created_at: string;
}

export type PetType = "avian" | "beast" | "critter";
export type PetItemKind = "food" | "toy";

export interface Creature {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "legendary" | "ethereal";
  pet_type: PetType;
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
  mood: string;
  adopted_at: string;
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