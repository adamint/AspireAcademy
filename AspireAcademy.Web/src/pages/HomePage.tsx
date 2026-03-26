import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function HomePage() {
  const token = useAuthStore((s) => s.token);
  return <Navigate to={token ? '/dashboard' : '/login'} replace />;
}
