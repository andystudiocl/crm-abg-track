import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/actions/auth';
import { Nav } from '@/components/nav';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: advisor } = await supabase.from('advisors').select('name, role').eq('id', user.id).maybeSingle();
  const name = advisor?.name || user.email || '';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ABG</span>
          <span className="brand-sub">CRM</span>
        </div>
        <Nav variant="side" />
        <div className="sidebar-foot">
          <div>{name}</div>
          <form action={signOut}>
            <button type="submit" className="link-btn small">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <header className="topbar">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">ABG</span>
          <span className="brand-sub">CRM</span>
        </div>
        <form action={signOut}>
          <button type="submit" className="link-btn small">
            Salir
          </button>
        </form>
      </header>
      <main className="main">{children}</main>
      <Nav variant="bottom" />
    </div>
  );
}
