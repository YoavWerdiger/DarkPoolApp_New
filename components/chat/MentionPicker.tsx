/**
 * Legacy inline @ autocomplete — disabled.
 * Chat mentions use MentionPickerSheet (bottom sheet) via ChatInput.
 * Kept as a no-op stub so any stale import cannot render the broken overlay.
 */
import React from 'react';

type Props = {
  visible?: boolean;
  onSelectUser?: (user: { id: string; display: string }) => void;
  onClose?: () => void;
  groupId?: string;
  searchQuery?: string;
};

const MentionPicker: React.FC<Props> = () => null;

export default MentionPicker;
