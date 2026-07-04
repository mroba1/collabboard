import './Avatar.css';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, color, size = 28 }: AvatarProps) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      title={name}
    >
      {initialsFor(name)}
    </div>
  );
}
