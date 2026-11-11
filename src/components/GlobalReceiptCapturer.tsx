import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { receiptCaptureService, ReceiptData } from '../services/receiptCaptureService';
import ReceiptPrintTemplate from './ReceiptPrintTemplate';

// Longest wait for the shop logo to load; past it the receipt prints with the shop's initial instead
const LOGO_WAIT_MS = 3000;

// Renders the receipt off screen and captures it as a picture for image-mode printing (same as offline-pos)
export default function GlobalReceiptCapturer() {
  const [activeReceipt, setActiveReceipt] = useState<{
    receipt: ReceiptData;
    paperWidth: 58 | 80;
    // Remounts the template for each capture, so a logo that failed for one receipt is tried again
    id: number;
  } | null>(null);
  const captureIdRef = useRef(0);

  const viewRef = useRef<View>(null);
  const isMountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRejectRef = useRef<((err: Error) => void) | null>(null);
  // Starts the capture once the logo has loaded or failed
  const logoSettledRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    receiptCaptureService.registerCapturer(async (receipt, paperWidth) => {
      return new Promise<string>((resolve, reject) => {
        if (!isMountedRef.current) {
          reject(new Error('Receipt capturer is not mounted'));
          return;
        }

        // A newer receipt replaces one still waiting to be captured
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (pendingRejectRef.current) {
          pendingRejectRef.current(new Error('Superseded by new receipt capture request'));
          pendingRejectRef.current = null;
        }

        pendingRejectRef.current = reject;
        captureIdRef.current += 1;
        setActiveReceipt({ receipt, paperWidth, id: captureIdRef.current });

        // Let layout and Burmese text shaping finish before capturing
        const capture = async () => {
          timerRef.current = null;
          pendingRejectRef.current = null;
          try {
            if (!isMountedRef.current || !viewRef.current) {
              if (isMountedRef.current) setActiveReceipt(null);
              reject(new Error('Receipt view reference is null'));
              return;
            }

            const targetWidth = paperWidth === 80 ? 576 : 384;
            const base64 = await captureRef(viewRef, {
              format: 'png',
              quality: 1,
              result: 'base64',
              width: targetWidth,
            });

            if (isMountedRef.current) setActiveReceipt(null);
            resolve(base64);
          } catch (err) {
            if (isMountedRef.current) setActiveReceipt(null);
            reject(err);
          }
        };
        const startCapture = () => {
          logoSettledRef.current = null;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(capture, 140);
        };

        // A remote logo has to be on screen before the picture is taken
        if (receipt.logoUrl) {
          logoSettledRef.current = startCapture;
          timerRef.current = setTimeout(startCapture, LOGO_WAIT_MS);
        } else {
          startCapture();
        }
      });
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRejectRef.current) {
        pendingRejectRef.current(new Error('Receipt capturer unmounted'));
        pendingRejectRef.current = null;
      }
      receiptCaptureService.unregisterCapturer();
    };
  }, []);

  if (!activeReceipt) return null;

  const targetWidth = activeReceipt.paperWidth === 80 ? 576 : 384;

  return (
    <View style={styles.offscreenContainer} pointerEvents="none">
      <View ref={viewRef} collapsable={false} style={[styles.receiptCard, { width: targetWidth }]}>
        <ReceiptPrintTemplate
          key={activeReceipt.id}
          receipt={activeReceipt.receipt}
          paperWidth={activeReceipt.paperWidth}
          onLogoSettled={() => logoSettledRef.current?.()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Far off screen rather than transparent: a see-through parent can come out blank in the capture
  offscreenContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    zIndex: -9999,
  },
  receiptCard: {
    backgroundColor: '#ffffff',
  },
});
