import React from 'react';

interface PixelButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: string;
  style?: React.CSSProperties;
}

export function PixelButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  style,
}: PixelButtonProps) {
  const variantMap: Record<string, string> = {
    primary: 'btn-indigo',
    secondary: 'btn-ghost',
    success: 'btn-emerald',
    danger: 'btn-rose',
    warning: 'btn-amber',
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '8px 14px', fontSize: 12 },
    md: { padding: '12px 20px', fontSize: 14 },
    lg: { padding: '16px 28px', fontSize: 16 },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-clean ${variantMap[variant]} ${className}`}
      style={{ ...sizeStyles[size], ...style }}
    >
      {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
      {children}
    </button>
  );
}
