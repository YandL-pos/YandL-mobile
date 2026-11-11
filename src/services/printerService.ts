import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { BluetoothManager, BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';
import { usePrinterStore, BluetoothDevice, PrintMode } from '../store/printerStore';
import { useShopStore } from '../store/shopStore';
import { receiptCaptureService, ReceiptData } from './receiptCaptureService';

const CONFIG_FILE_PATH = `${RNFS.DocumentDirectoryPath}/printer_config.json`;

// Discovery waits for Android's DISCOVERY_FINISHED, which can take long or never come
const SCAN_TIMEOUT_MS = 12000;

const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 };

interface StoredPrinterConfig {
  // Missing when only preferences were saved, before any printer was connected
  address?: string;
  name?: string;
  paperWidth: 58 | 80;
  printMode?: PrintMode;
  autoPrint?: boolean;
}

export interface ScanResult {
  paired: BluetoothDevice[];
  found: BluetoothDevice[];
  // False when Android refused to search (Location off or no location permission); paired devices still come back
  discoveryStarted: boolean;
}

const readConfigFile = async (): Promise<Partial<StoredPrinterConfig>> => {
  try {
    if (!(await RNFS.exists(CONFIG_FILE_PATH))) return {};
    return JSON.parse(await RNFS.readFile(CONFIG_FILE_PATH, 'utf8'));
  } catch {
    return {};
  }
};

// Merges into the saved file so device and preferences don't overwrite each other
const writeConfigFile = async (patch: Partial<StoredPrinterConfig>) => {
  const current = await readConfigFile();
  await RNFS.writeFile(CONFIG_FILE_PATH, JSON.stringify({ ...current, ...patch }), 'utf8');
};

// Devices arrive as JSON strings or objects, from method results and discovery events alike
export const toDevice = (raw: unknown): BluetoothDevice | null => {
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : (raw as { name?: string; address?: string });
    return d?.address ? { name: d.name || 'Unknown Device', address: d.address } : null;
  } catch {
    return null;
  }
};

export const toDevices = (list: unknown): BluetoothDevice[] => {
  let items = list;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  return (Array.isArray(items) ? items : []).map(toDevice).filter((d): d is BluetoothDevice => !!d);
};

const errorText = (err: unknown) => String((err as Error)?.message ?? err ?? '').toUpperCase();

// The printer socket is gone (printer off, out of range, or slept); reconnecting usually fixes it
const isConnectionLost = (err: unknown) => {
  const text = errorText(err);
  return text.includes('COMMAND_NOT_SEND') || text.includes('NOT_CONNECTED');
};

export const printerService = {
  // The native module only exists in an Android dev/production build, never in Expo Go
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!NativeModules.BluetoothManager && !!NativeModules.BluetoothEscposPrinter;
  },

  // Android 12+ asks only for Bluetooth (scanning is declared neverForLocation in the manifest);
  // older versions need location to discover printers
  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
      const { PERMISSIONS, RESULTS } = PermissionsAndroid;

      if (apiLevel >= 31) {
        const statuses = await PermissionsAndroid.requestMultiple([
          PERMISSIONS.BLUETOOTH_SCAN,
          PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return (
          statuses[PERMISSIONS.BLUETOOTH_SCAN] === RESULTS.GRANTED &&
          statuses[PERMISSIONS.BLUETOOTH_CONNECT] === RESULTS.GRANTED
        );
      }

      const statuses = await PermissionsAndroid.requestMultiple([
        PERMISSIONS.ACCESS_FINE_LOCATION,
        PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      return (
        statuses[PERMISSIONS.ACCESS_FINE_LOCATION] === RESULTS.GRANTED ||
        statuses[PERMISSIONS.ACCESS_COARSE_LOCATION] === RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('Bluetooth permission request failed:', err);
      return false;
    }
  },

  // Restores the saved preferences into the store; the saved printer comes back without connecting
  async loadSavedConfig(): Promise<Partial<StoredPrinterConfig>> {
    const config = await readConfigFile();
    const store = usePrinterStore.getState();
    if (config.paperWidth) store.setPaperWidth(config.paperWidth);
    if (config.printMode) store.setPrintMode(config.printMode);
    if (typeof config.autoPrint === 'boolean') store.setAutoPrint(config.autoPrint);
    return config;
  },

  async saveConfig(device: BluetoothDevice): Promise<void> {
    try {
      await writeConfigFile({ address: device.address, name: device.name });
    } catch (err) {
      console.warn('Failed to save printer config:', err);
    }
  },

  // Paper width, print mode and auto-print, kept whether or not a printer is connected
  async savePreferences(): Promise<void> {
    const { paperWidth, printMode, autoPrint } = usePrinterStore.getState();
    try {
      await writeConfigFile({ paperWidth, printMode, autoPrint });
    } catch (err) {
      console.warn('Failed to save printer preferences:', err);
    }
  },

  // Devices already paired in Android settings, straight away and without a search
  async getPairedDevices(): Promise<BluetoothDevice[]> {
    if (!this.isAvailable()) return [];
    try {
      if (!(await BluetoothManager.isBluetoothEnabled())) return [];
      const paired = toDevices(await BluetoothManager.enableBluetooth());
      usePrinterStore.getState().setPairedDevices(paired);
      return paired;
    } catch (err) {
      console.warn('Failed to read paired devices:', err);
      return [];
    }
  },

  async scanDevices(): Promise<ScanResult> {
    if (!this.isAvailable()) {
      throw new Error('Bluetooth printing needs the Android app build (not available here).');
    }
    if (!(await this.requestBluetoothPermissions())) {
      throw new Error('Bluetooth ခွင့်ပြုချက် (Nearby devices) ကို Allow ပေးပါ။');
    }

    const store = usePrinterStore.getState();
    store.setIsScanning(true);
    store.setFoundDevices([]);
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      if (!(await BluetoothManager.isBluetoothEnabled())) {
        // Shows Android's "turn on Bluetooth" prompt
        await BluetoothManager.enableBluetooth();
      }

      const initialPaired = await this.getPairedDevices();

      const scan = BluetoothManager.scanDevices().then((raw) => {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
          paired: toDevices(parsed?.paired),
          found: toDevices(parsed?.found),
          discoveryStarted: true,
        };
      });
      const timeout = new Promise<ScanResult>((resolve) => {
        timer = setTimeout(
          () => resolve({ paired: initialPaired, found: usePrinterStore.getState().foundDevices, discoveryStarted: true }),
          SCAN_TIMEOUT_MS,
        );
      });

      let result: ScanResult;
      try {
        result = await Promise.race([scan, timeout]);
      } catch (err) {
        // NOT_STARTED and friends: discovery was refused, but paired printers still work
        console.warn('Bluetooth discovery failed:', err);
        result = { paired: initialPaired, found: [], discoveryStarted: false };
      }

      const paired = result.paired.length > 0 ? result.paired : initialPaired;
      store.setPairedDevices(paired);
      // Keep devices that arrived through live discovery events as well
      const found = [...usePrinterStore.getState().foundDevices];
      for (const device of result.found) {
        if (!found.some((d) => d.address === device.address)) found.push(device);
      }
      store.setFoundDevices(found.filter((d) => !paired.some((p) => p.address === d.address)));
      return { paired, found, discoveryStarted: result.discoveryStarted };
    } finally {
      if (timer) clearTimeout(timer);
      store.setIsScanning(false);
    }
  },

  async connect(device: BluetoothDevice): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Bluetooth printing needs the Android app build (not available here).');
    }
    const store = usePrinterStore.getState();
    store.setIsConnecting(true);

    try {
      await this.requestBluetoothPermissions();
      await BluetoothManager.connect(device.address);
      store.setConnectedPrinter(device);
      await this.saveConfig(device);
      return true;
    } catch (err) {
      console.error('Failed to connect to printer:', err);
      store.setConnectedPrinter(null);
      throw err;
    } finally {
      store.setIsConnecting(false);
    }
  },

  // The native module has no disconnect: forget the printer so it isn't reconnected or used.
  // Connecting another printer replaces the open socket.
  async disconnect(): Promise<void> {
    usePrinterStore.getState().setConnectedPrinter(null);
    try {
      await writeConfigFile({ address: undefined, name: undefined });
    } catch (err) {
      console.warn('Failed to forget printer:', err);
    }
  },

  // Checks the socket with printerInit and reconnects to the last printer if it dropped
  async ensureConnected(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const store = usePrinterStore.getState();

    let printer = store.connectedPrinter;
    if (!printer) {
      const saved = await this.loadSavedConfig();
      if (!saved.address) return false;
      printer = { name: saved.name || 'Printer', address: saved.address };
    }

    if (store.connectedPrinter) {
      try {
        await BluetoothEscposPrinter.printerInit();
        return true;
      } catch (err) {
        if (!isConnectionLost(err)) return false;
        console.log('Printer connection dropped, reconnecting to', printer.address);
      }
    }

    try {
      await this.connect(printer);
      await BluetoothEscposPrinter.printerInit();
      return true;
    } catch (err) {
      console.warn('Reconnect to printer failed:', err);
      return false;
    }
  },

  async printReceipt(receipt: ReceiptData, paperWidth?: 58 | 80): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Bluetooth printing needs the Android app build (not available here).');
    }
    const { paperWidth: savedWidth, printMode } = usePrinterStore.getState();
    const width = paperWidth || savedWidth;

    if (!(await this.ensureConnected())) {
      throw new Error('Printer is not connected. Please connect via printer settings.');
    }

    if (printMode === 'text') {
      await this.printTextReceipt(receipt, width);
      return;
    }

    try {
      await this.printImageReceipt(receipt, width);
    } catch (err) {
      if (!isConnectionLost(err) || !(await this.ensureConnected())) throw err;
      // The socket dropped while the receipt was being drawn: once more after reconnecting
      await this.printImageReceipt(receipt, width);
    }
  },

  // Burmese text prints correctly only this way: the receipt is drawn as a picture
  async printImageReceipt(receipt: ReceiptData, width: 58 | 80): Promise<void> {
    const base64Image = await receiptCaptureService.capture(receipt, width);
    const dots = width === 80 ? 576 : 384;
    await BluetoothEscposPrinter.printerInit();
    BluetoothEscposPrinter.setWidth(dots);
    // printPic feeds and cuts by itself; another feed here would come out after the cut
    BluetoothEscposPrinter.printPic(base64Image, { width: dots, left: 0 });
  },

  // Plain ESC/POS text for printers that can't print pictures; Burmese letters don't print
  async printTextReceipt(receipt: ReceiptData, width: 58 | 80): Promise<void> {
    const is80mm = width === 80;
    const separator = `${'-'.repeat(is80mm ? 46 : 32)}\n`;
    // Item / Price / Qty / Total, in the web voucher's order
    const columns = is80mm ? [22, 8, 6, 10] : [14, 6, 4, 8];
    const totals = is80mm ? [34, 12] : [20, 12];
    const shop = useShopStore.getState().shop;
    const amount = (value?: number) => Number(value || 0).toLocaleString('en-US');
    const line = (text: string) => BluetoothEscposPrinter.printText(`${text}\n`, {});
    const totalRow = (label: string, value: string) =>
      BluetoothEscposPrinter.printColumn(totals, [ALIGN.LEFT, ALIGN.RIGHT], [label, value], {});

    // Same sections as the picture receipt (ReceiptPrintTemplate), in English
    await BluetoothEscposPrinter.printerInit();
    await BluetoothEscposPrinter.printerAlign(ALIGN.CENTER);
    await line(receipt.shopName || shop.name);
    const address = receipt.shopAddress || shop.address;
    if (address) await line(address);
    const phone = receipt.shopPhone || shop.phone;
    if (phone) await line(`Tel: ${phone}`);

    await BluetoothEscposPrinter.printerAlign(ALIGN.LEFT);
    await line(separator.trimEnd());
    if (receipt.customerName) await line(`Customer: ${receipt.customerName}`);
    if (receipt.customerPhone) await line(`Phone: ${receipt.customerPhone}`);
    if (receipt.customerAddress) await line(`Address: ${receipt.customerAddress}`);

    const aligns = [ALIGN.LEFT, ALIGN.RIGHT, ALIGN.CENTER, ALIGN.RIGHT];
    await BluetoothEscposPrinter.printColumn(columns, aligns, ['Item', 'Price', 'Qty', 'Total'], {});
    for (const item of receipt.items) {
      await BluetoothEscposPrinter.printColumn(
        columns,
        aligns,
        [item.name || '', amount(item.price), String(item.quantity || 0), amount(item.subTotal)],
        {},
      );
      if (item.code) await line(`  ${item.code}`);
    }
    await line(separator.trimEnd());

    await totalRow('Gross:', amount(receipt.subtotal));
    if (receipt.discount) {
      const percent = receipt.discountPercent ? ` (${Number(receipt.discountPercent.toFixed(2))}%)` : '';
      await totalRow(`Discount${percent}:`, `-${amount(receipt.discount)}`);
    }
    if (receipt.markup) await totalRow('Mark Up:', `+${amount(receipt.markup)}`);
    if (receipt.serviceCharge) await totalRow('Service charge:', amount(receipt.serviceCharge));
    if (receipt.tax) await totalRow('Tax:', amount(receipt.tax));
    await line(separator.trimEnd());
    await totalRow('TOTAL:', amount(receipt.netTotal));
    await line(separator.trimEnd());

    if (receipt.paymentType) await totalRow('Payment:', receipt.paymentType);
    if (receipt.paidAmount !== undefined) await totalRow('Paid:', amount(receipt.paidAmount));
    if (receipt.changeAmount) await totalRow('Change:', amount(receipt.changeAmount));
    if (receipt.dueAmount) await totalRow('Balance due:', amount(receipt.dueAmount));
    await line(separator.trimEnd());

    if (receipt.note) await line(`Note: ${receipt.note}`);
    await totalRow('Receipt:', receipt.invoiceNo);
    await totalRow(receipt.date, 'Thank you!');
    await line('='.repeat(is80mm ? 46 : 32));

    await BluetoothEscposPrinter.printerAlign(ALIGN.CENTER);
    if (receipt.sequenceNumber != null) await line(`#${String(receipt.sequenceNumber).padStart(4, '0')}`);
    if (receipt.cashierName) await line(`Printed by: ${receipt.cashierName}`);
    await BluetoothEscposPrinter.printAndFeed(150);
    try {
      // ESC/POS cut (GS V 66 0); printers without a cutter ignore it
      await BluetoothEscposPrinter.printText(`${String.fromCharCode(29, 86, 66, 0)}\n`, {});
      await BluetoothEscposPrinter.printerInit();
    } catch {
      // ignore
    }
  },

  async testPrint(overrides: Partial<ReceiptData> = {}): Promise<void> {
    const sampleReceipt: ReceiptData = {
      invoiceNo: `TEST-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString('en-GB'),
      customerName: 'ဆိုင်အစမ်းစစ်ဆေးမှု (Test Print)',
      paymentType: 'ငွေသား',
      items: [
        { name: 'အင်ဂျင်ဝိုင် 4L (10W-40)', quantity: 1, price: 65000, subTotal: 65000 },
        { name: 'ဆီစစ် (Oil Filter)', quantity: 1, price: 12000, subTotal: 12000 },
      ],
      subtotal: 77000,
      discount: 2000,
      netTotal: 75000,
      paidAmount: 75000,
      dueAmount: 0,
      changeAmount: 0,
      footerMessage: 'စမ်းသပ်ပုံနှိပ်ခြင်း အောင်မြင်ပါသည်။\nTest Print Succeeded!',
      ...overrides,
    };
    await this.printReceipt(sampleReceipt);
  },
};
