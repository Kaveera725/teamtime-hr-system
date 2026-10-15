import { cn, getInitials, avatarColor } from '@/lib/utils';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name);
  const color    = avatarColor(name);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full font-semibold text-white select-none shrink-0 overflow-hidden ring-2 ring-white dark:ring-neutral-900',
        sizes[size],
        className,
      )}
      style={!src ? { backgroundColor: color } : undefined}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
