import { redirect } from 'next/navigation';

/**
 * The ERP landing (departments showcase) lives at `/` — this route just
 * forwards to it.
 */
export default function WelcomeRedirect() {
  redirect('/');
}
