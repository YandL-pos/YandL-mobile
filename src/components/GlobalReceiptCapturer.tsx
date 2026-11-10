import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { receiptCaptureService, ReceiptData } from '../services/receiptCaptureService';
import ReceiptPrintTemplate from './ReceiptPrintTemplate';

// Renders the receipt off screen and captures it as a picture for image-mode printing (same as offline-pos)
export default function GlobalReceiptCapturer() {
  const [activeReceipt, setActiveReceipt] = useState<{
    receipt: ReceiptData;
    paperWidth: 58 | 80;
  } | null>(null);

  const viewRef = useRef<View>(null);
  const isMountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRejectRef = useRef<((err: Error) => void) | null>(null);

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
        setActiveReceipt({ receipt, paperWidth });

        // Let layout and Burmese text shaping finish before capturing
        timerRef.current = setTimeout(async () => {
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
        }, 140);
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
        <ReceiptPrintTemplate receipt={activeReceipt.receipt} paperWidth={activeReceipt.paperWidth} />
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
