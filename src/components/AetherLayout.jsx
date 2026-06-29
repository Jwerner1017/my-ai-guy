/**
 * Aether App Layout — Bottom tab navigation for all main screens
 */
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, Database, Mic, Settings } from 'lucide-react';
import useAetherStore from '@/lib/aetherStore';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/memory', label: 'Memory', icon: Database },
  { to: '/voice', label: 'Voice', icon: Mic },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AetherLayout() {
  const { pendingApprovals } = useAetherStore();

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--aether-bg)' }}>
      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>

      {/* Bottom tab bar */}
      <nav
        className="flex-shrink-0 glass border-t"
        style={{
          borderColor: 'var(--aether-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const badge = item.to === '/tools' ? pendingApprovals.length : 0;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl group transition-all duration-200"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--aether-cyan)' : 'var(--aether-text-muted)',
                })}
                aria-label={item.label}
              >
                {({ isActive }) => (
                  <>
                    {/* Active background glow */}
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'var(--aether-cyan-dim)' }}
                      />
                    )}

                    {/* Badge */}
                    {badge > 0 && (
                      <div
                        className="absolute -top-0.5 right-2 min-w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold px-0.5 z-10"
                        style={{ background: '#FF4757', color: '#fff', fontSize: '10px' }}
                      >
                        {badge > 9 ? '9+' : badge}
                      </div>
                    )}

                    <Icon
                      size={20}
                      className="relative z-10 transition-transform duration-200"
                      style={{
                        filter: isActive ? 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.5))' : 'none',
                      }}
                    />
                    <span
                      className="relative z-10 text-xs font-medium transition-all duration-200"
                      style={{ fontSize: '10px' }}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}