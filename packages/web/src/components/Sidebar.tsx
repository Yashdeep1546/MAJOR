import { NavLink } from 'react-router-dom';

const SECTIONS = [
  { to: '/chat', label: 'Conversation' },
  { to: '/tasks', label: 'Tasks' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>AETHER</h1>
        <p>Task operations</p>
      </div>

      <div className="sidebar-section-label">Menu</div>
      <nav className="sidebar-nav">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span>{s.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-status">
          <span className="status-flag" />
          <span>Online</span>
        </div>
        <p className="sidebar-build">Phase I &middot; v0.1.0</p>
      </div>
    </aside>
  );
}
