"use client";

import { MaterialIcon } from "./MaterialIcon";
import Button from "./Button";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <MaterialIcon
        name={icon}
        className="text-6xl text-outline-variant mb-4"
      />
      <h3 className="text-title-md text-on-surface font-display mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-body-md text-on-surface-variant max-w-xs mb-6">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}