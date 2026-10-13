import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/views/brand/logo';
import { currentStaff } from '@/controllers/admin/guard';
import { loadRestaurant } from '@/controllers/site/shop';
import { logoBrand } from '@/shared/domain/restaurant';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const [staff, { profile }] = await Promise.all([currentStaff(), loadRestaurant()]);
  if (staff) redirect('/admin');
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="bg-surface shadow-card w-full max-w-sm rounded-2xl p-7">
        <Logo brand={logoBrand(profile)} />
        <h1 className="mt-6 text-2xl font-extrabold">Kitchen sign in</h1>
        <p className="text-muted mt-1 text-sm">For {profile.brandName} staff only.</p>
        <LoginForm />
      </div>
    </main>
  );
}
