import type { ChatRoomBrief, User, CreateRoomData, UpdateRoomData, Page } from "@/lib/api";

export interface UseAdminGroupsParams {
  userRole: string | undefined;
  router: ReturnType<typeof import("next/navigation").useRouter>;
}

export interface UseAdminGroupsReturn {
  rooms: ChatRoomBrief[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  totalLoaded: number;
  search: string;
  setSearch: (s: string) => void;
  refresh: () => Promise<void>;
  loadMore: () => void;
}

export interface UseGroupActionsParams {
  crud: ReturnType<typeof import("@/hooks/useAdminCrud").useAdminCrud<ChatRoomBrief, CreateRoomData, UpdateRoomData>>;
  refresh: () => Promise<void>;
}

export interface UseGroupActionsReturn {
  handleCreateRoom: (form: CreateRoomData) => Promise<void>;
  handleUpdateRoom: (id: string, form: Partial<ChatRoomBrief>) => Promise<void>;
  handleDeleteRoom: (id: string) => void;
  handleToggleClose: (id: string) => Promise<void>;
  handleAddMembers: (roomId: string, memberIds: string[]) => Promise<void>;
}

export interface UseMembersModalParams {
  allUsers: User[];
  allUsersMap: Record<string, User>;
  usersPage: Page<User> | null;
  usersLoadingMore: boolean;
  setUsersPage: React.Dispatch<React.SetStateAction<Page<User> | null>>;
  setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setAllUsersMap: React.Dispatch<React.SetStateAction<Record<string, User>>>;
  setUsersLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  setMemberSearch: React.Dispatch<React.SetStateAction<string>>;
  setSelectedMembers: React.Dispatch<React.SetStateAction<string[]>>;
  setShowMembers: React.Dispatch<React.SetStateAction<string | null>>;
  refreshRooms: () => Promise<void>;
}

export interface UseMembersModalReturn {
  memberSearch: string;
  selectedMembers: string[];
  showMembers: string | null;
  filteredUsers: User[];
  availableUsers: User[];
  usersLoadingMore: boolean;
  loadUsers: (q?: string, page?: number) => Promise<void>;
  loadMoreUsers: () => void;
  toggleMemberInCreate: (userId: string, currentIds: string[]) => string[];
  openMembers: (room: ChatRoomBrief) => Promise<void>;
  handleAddMembers: (roomId: string) => Promise<void>;
  closeMembers: () => void;
}

export interface GroupsHeaderProps {
  search: string;
  onSearchChange: (s: string) => void;
  onCreateClick: () => void;
}

export interface GroupsListProps {
  rooms: ChatRoomBrief[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  totalCount: number;
  totalLoaded: number;
  search: string;
  onToggleClose: (id: string) => Promise<void>;
  onEdit: (room: ChatRoomBrief) => void;
  onMembers: (room: ChatRoomBrief) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}

export interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (form: CreateRoomData) => Promise<void>;
  saving: boolean;
  form: CreateRoomData;
  setForm: React.Dispatch<React.SetStateAction<CreateRoomData>>;
  avatarRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  memberSearch: string;
  setMemberSearch: (s: string) => void;
  availableUsers: User[];
  usersLoadingMore: boolean;
  loadMoreUsers: () => void;
  toggleMember: (userId: string) => void;
  selectedMemberCount: number;
}

export interface EditGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
  form: Partial<ChatRoomBrief>;
  setForm: React.Dispatch<React.SetStateAction<Partial<ChatRoomBrief>>>;
  avatarRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface MembersModalProps {
  open: boolean;
  onClose: () => void;
  roomId: string | null;
  memberSearch: string;
  setMemberSearch: (s: string) => void;
  selectedMembers: string[];
  setSelectedMembers: React.Dispatch<React.SetStateAction<string[]>>;
  availableUsers: User[];
  usersLoadingMore: boolean;
  loadMoreUsers: () => void;
  onAddMembers: () => Promise<void>;
  currentMembers: User[];
  onRemoveMember: (memberId: string) => void;
}