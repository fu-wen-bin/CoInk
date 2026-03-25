export interface ConnectedEvent {
  userId: string;
  userName: string;
}

export interface ConnectionState {
  isConnected: boolean;
  error: string | null;
}

export interface OnlineUser {
  userId: string;
  userName?: string;
  name?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away';
}

export interface OnlineUsersResponse {
  users: OnlineUser[];
}

export interface PodcastEvent {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  [key: string]: unknown;
}

export interface PodcastEventResponse {
  data: PodcastEvent;
}
