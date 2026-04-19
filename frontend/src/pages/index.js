// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser } from '../utils/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      user.getSession((err, session) => {
        router.push(session?.isValid() ? '/dashboard' : '/login');
      });
    } else {
      router.push('/login');
    }
  }, []);
  return null;
}
