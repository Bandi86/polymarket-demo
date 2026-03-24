'use client'

import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export function SoundToggle({ enabled, onToggle, className: _className }: SoundToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'p-1.5 rounded transition-colors',
        enabled ? 'text-success hover:bg-success/10' : 'text-muted-foreground hover:bg-muted/10'
      )}
      title={enabled ? 'Sound on' : 'Sound off'}
    >
      {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}