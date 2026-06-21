export type UserRole = 'cidadao' | 'operador' | 'gestor' | 'admin' | 'guest'

export interface NavItem {
  label: string
  href: string
  icon: string
  roles?: UserRole[]
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}
