export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  photoURL?: string;
  bio?: string;
  isPrivate?: boolean;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export type ReelType = 'post' | 'story' | 'ad';

export interface Reel {
  id: string;
  creatorUid: string;
  creatorName: string;
  creatorPhoto?: string;
  videoUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  isPublic: boolean;
  createdAt: string;
  type: ReelType;
  adLink?: string;
}

export interface ReelComment {
  id: string;
  userUid: string;
  userName: string;
  userPhoto?: string;
  reelId: string;
  text: string;
  createdAt: string;
}

export interface Story {
  id: string;
  creatorUid: string;
  creatorName: string;
  creatorPhoto?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  createdAt: string;
  expiresAt: string;
}
