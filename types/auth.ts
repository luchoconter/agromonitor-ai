
export type UserRole = 'admin' | 'company' | 'operator';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  status: 'active' | 'pending' | 'suspended';
  linkedAdminId?: string;
  linkedCompanyId?: string;
  consultancyName?: string;
}
