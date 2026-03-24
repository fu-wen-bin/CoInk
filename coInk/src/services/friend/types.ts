export type FriendRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Friend {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
}

export interface FriendSearchItem {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface FriendRequestItem {
  requestId: string;
  requesterId: string;
  receiverId: string;
  status: FriendRequestStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequestsResult {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}

export interface SendFriendRequestParams {
  requesterId: string;
  receiverId: string;
  message?: string;
}

export interface RespondFriendRequestParams {
  receiverId: string;
  action: 'approve' | 'reject';
}
