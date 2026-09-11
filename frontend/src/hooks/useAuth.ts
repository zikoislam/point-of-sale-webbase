import { useAuthContext } from '../lib/auth-context';

export const useAuth = () => {
  return useAuthContext();
};
