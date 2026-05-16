import { ReactNode } from 'react';
import { Home, Calendar, PlusCircle, User, Bell, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

type NavItem = 'dashboard' | 'events' | 'create' | 'live' | 'notifications' | 'profile';

interface LayoutProps {
  children: ReactNode;
  activeScreen: NavItem;
  setActiveScreen: (screen: NavItem) => void;
  isAdmin?: boolean;
}

export default function Layout({ children, activeScreen, setActiveScreen, isAdmin }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'events', icon: Calendar, label: 'Events' },
    { id: 'live', icon: Tv, label: 'Live' },
    { id: 'create', icon: PlusCircle, label: 'Add' },
    { id: 'notifications', icon: Bell, label: 'Inbox' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="mobile-container pb-16">
      <main className="mt-2">{children}</main>
      
      <nav className="nav-bottom">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveScreen(item.id as NavItem)}
            className={cn(
              "group flex flex-col items-center justify-center p-2 transition-all duration-300 relative",
              activeScreen === item.id ? "text-blue-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 transition-all",
              activeScreen === item.id ? "stroke-[2.5px]" : "stroke-2"
            )} />
            <span className={cn(
              "text-[9px] font-bold mt-1 transition-all",
              activeScreen === item.id ? "opacity-100" : "opacity-0 scale-75"
            )}>{item.label}</span>
            {activeScreen === item.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute -top-1 w-1 h-1 bg-blue-600 rounded-full"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
