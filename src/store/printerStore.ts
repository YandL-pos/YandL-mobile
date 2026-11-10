import { create } from 'zustand';

export interface BluetoothDevice {
  name: string;
  address: string;
}

// image: the receipt is printed as a picture (Burmese prints); text: plain ESC/POS text (no Burmese)
export type PrintMode = 'image' | 'text';

interface PrinterState {
  connectedPrinter: BluetoothDevice | null;
  pairedDevices: BluetoothDevice[];
  foundDevices: BluetoothDevice[];
  isScanning: boolean;
  isConnecting: boolean;
  paperWidth: 58 | 80;
  printMode: PrintMode;
  // Print the receipt as soon as a native POS sale is saved
  autoPrint: boolean;

  setConnectedPrinter: (printer: BluetoothDevice | null) => void;
  setPairedDevices: (devices: BluetoothDevice[]) => void;
  setFoundDevices: (devices: BluetoothDevice[]) => void;
  addFoundDevice: (device: BluetoothDevice) => void;
  setIsScanning: (val: boolean) => void;
  setIsConnecting: (val: boolean) => void;
  setPaperWidth: (width: 58 | 80) => void;
  setPrintMode: (mode: PrintMode) => void;
  setAutoPrint: (enabled: boolean) => void;
}

export const usePrinterStore = create<PrinterState>((set) => ({
  connectedPrinter: null,
  pairedDevices: [],
  foundDevices: [],
  isScanning: false,
  isConnecting: false,
  paperWidth: 80,
  printMode: 'image',
  autoPrint: false,

  setConnectedPrinter: (connectedPrinter) => set({ connectedPrinter }),
  setPairedDevices: (pairedDevices) => set({ pairedDevices }),
  setFoundDevices: (foundDevices) => set({ foundDevices }),
  // Live discovery results; skips devices already listed as paired or found
  addFoundDevice: (device) =>
    set((state) => {
      const known = [...state.foundDevices, ...state.pairedDevices].some((d) => d.address === device.address);
      return known ? state : { foundDevices: [...state.foundDevices, device] };
    }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setPaperWidth: (paperWidth) => set({ paperWidth }),
  setPrintMode: (printMode) => set({ printMode }),
  setAutoPrint: (autoPrint) => set({ autoPrint }),
}));
