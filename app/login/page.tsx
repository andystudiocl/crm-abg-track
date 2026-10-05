import { LoginForm } from './login-form';

export const metadata = { title: 'Ingresar · ABG CRM' };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand">
          <span className="brand-mark">ABG</span>
          <span className="brand-sub">Car Boutique · CRM</span>
        </div>
        <LoginForm next={searchParams.next ?? '/'} />
      </div>
    </div>
  );
}
