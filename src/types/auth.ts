export type AuthUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  depot_id?: string;
  created_at: string;
  updated_at: string;
}; 