// Matches the Android native module in 0.0.5 (RNBluetoothManagerModule / RNBluetoothEscposPrinterModule).
// Methods without a Promise on the native side (setWidth, printPic) return immediately and never report errors.
declare module 'react-native-bluetooth-escpos-printer' {
  export interface DeviceInfo {
    name: string;
    address: string;
  }

  export const BluetoothManager: {
    isBluetoothEnabled(): Promise<boolean>;
    // Asks the user to turn Bluetooth on if it's off; otherwise resolves with paired devices as JSON strings
    enableBluetooth(): Promise<string[] | null>;
    disableBluetooth(): Promise<boolean>;
    // Rejects with "NOT_STARTED" when Android refuses discovery (no location permission, Location off)
    scanDevices(): Promise<string>;
    connect(address: string): Promise<string>;
    unpaire(address: string): Promise<string>;
    EVENT_DEVICE_ALREADY_PAIRED: string;
    EVENT_DEVICE_FOUND: string;
    EVENT_DEVICE_DISCOVER_DONE: string;
    EVENT_CONNECTION_LOST: string;
    EVENT_UNABLE_CONNECT: string;
    EVENT_CONNECTED: string;
  };

  export const BluetoothEscposPrinter: {
    printerInit(): Promise<void>;
    printAndFeed(feed: number): Promise<void>;
    printerLeftSpace(sp: number): Promise<void>;
    printerLineSpace(sp: number): Promise<void>;
    printerUnderLine(line: number): Promise<void>;
    printerAlign(align: number): Promise<void>;
    setBlob(weight: number): Promise<void>;
    printText(text: string, options?: Record<string, unknown>): Promise<void>;
    printColumn(
      columnWidths: number[],
      columnAligns: number[],
      columnTexts: string[],
      options?: Record<string, unknown>
    ): Promise<void>;
    setWidth(width: number): void;
    // Prints the bitmap, feeds 30 dots and cuts on its own
    printPic(base64encodeStr: string, options?: { width?: number; left?: number }): void;
    printQRCode(content: string, size: number, correctionLevel: number): Promise<void>;
    ALIGN: {
      LEFT: number;
      CENTER: number;
      RIGHT: number;
    };
  };

  export const BluetoothTscPrinter: any;
}
