import LayoutNavbar from '@/@layouts/components/vertical/Navbar'
import NavbarContent from './NavbarContent'
import type { User } from '@/types'

interface NavbarProps {
  user: User
  onMenuToggle?: () => void
}

const Navbar = ({ user, onMenuToggle }: NavbarProps) => {
  return (
    <LayoutNavbar>
      <NavbarContent user={user} onMenuToggle={onMenuToggle} />
    </LayoutNavbar>
  )
}

export default Navbar
