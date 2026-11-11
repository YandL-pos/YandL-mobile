import { create } from 'zustand';

export type DialogTone = 'default' | 'danger';

export interface DialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  // Left out for a plain message with a single button
  cancelText?: string;
  // Red confirm button, for actions that drop or remove something
  tone?: DialogTone;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogState {
  id: number;
  dialog: DialogOptions | null;
  show: (dialog: DialogOptions) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  id: 0,
  dialog: null,
  show: (dialog) => set({ id: get().id + 1, dialog }),
  close: () => set({ dialog: null }),
}));

// In-app replacements for Alert.alert, drawn by AppDialog over every screen
export const dialog = {
  confirm: (options: DialogOptions) =>
    useDialogStore.getState().show({ cancelText: 'မလုပ်တော့ပါ', confirmText: 'အတည်ပြုမည်', ...options }),
  alert: (title: string, message?: string) =>
    useDialogStore.getState().show({ title, message, confirmText: 'ရပါပြီ' }),
};
