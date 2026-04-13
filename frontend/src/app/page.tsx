import { redirect } from 'next/navigation';

// The root redirects to the login page.
// Once authenticated the app redirects to /dashboard.
export default function RootPage() {
  redirect('/login');
}
