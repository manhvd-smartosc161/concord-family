import Image from 'next/image';
import type { AuthUser } from '../types';

interface Props {
  user: Pick<AuthUser, 'name' | 'role' | 'avatarUrl'>;
  size?: number;
  editable?: boolean;
  onClick?: () => void;
}

export function UserAvatar({ user, size = 32, editable = false, onClick }: Props) {
  const initials = user.name.charAt(0).toUpperCase();
  const colorClass =
    user.role === 'husband'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800';

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${editable ? 'cursor-pointer' : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt={user.name}
          fill
          className="object-cover"
          sizes={`${size}px`}
          unoptimized
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-sm font-semibold ${colorClass}`}
        >
          {initials}
        </div>
      )}

      {editable && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.93s-.03-.64-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.36-.07.7-.07 1s.03.65.07 1l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
