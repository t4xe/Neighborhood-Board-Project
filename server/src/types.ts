export type UserRole = 'administrator' | 'management' | 'regular' | 'visitor';
export type UserType = 'resident' | 'local_business';
export type PostStatus = 'active' | 'resolved' | 'archived';
export type ReactionType = 'helpful' | 'interested' | 'congratulations' | 'sold';

export interface User {
  user_id: number;
  email: string;
  display_name: string;
  roles: string;
  types: string;
  zone: string;
  status: string;
  created_at: string;
}

export interface Category {
  category_id: number;
  name: string;
  description: string;
  rules: string;
}

export interface Post {
  post_id: number;
  author_id: number;
  category_id: number;
  title: string;
  description: string;
  price: number | null;
  zone: string;
  geo_point: string | null;
  status: PostStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  comment_id: number;
  post_id: number;
  author_id: number;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export interface Reaction {
  reaction_id: number;
  post_id: number;
  author_id: number;
  type: ReactionType;
  created_at: string;
}

export interface SessionUser extends User {
  roleList: UserRole[];
  typeList: UserType[];
}
