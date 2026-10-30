/**
 * Offline Outbox Queue untuk Terminal Kasir POS & KDS
 * Julia's Coffee Management System
 *
 * Mengizinkan kasir tetap bertransaksi penuh saat WiFi kafe terputus (offline mode).
 * Seluruh pesanan disimpan aman di IndexedDB perangkat, siap di-flush otomatis
 * saat koneksi internet pulih.
 */

import { get, set, del } from "idb-keyval";

const OUTBOX_STORAGE_KEY = "julia_pos_offline_outbox_queue";

export interface QueuedOfflineOrder {
  id: string;
  idempotencyKey: string;
  orderNumber: string;
  payload: any;
  queuedAt: string;
  retryCount: number;
  lastError?: string;
}

/**
 * Menyimpan pesanan yang dibuat saat offline ke antrean IndexedDB
 */
export async function enqueueOfflineOrder(payload: any): Promise<QueuedOfflineOrder> {
  const existing: QueuedOfflineOrder[] = (await get(OUTBOX_STORAGE_KEY)) || [];
  const queuedItem: QueuedOfflineOrder = {
    id: payload.id || crypto.randomUUID(),
    idempotencyKey: payload.idempotencyKey || crypto.randomUUID(),
    orderNumber: payload.orderNumber || `OFFLINE-${Date.now().toString().slice(-4)}`,
    payload,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  const updated = [...existing.filter((item) => item.id !== queuedItem.id), queuedItem];
  await set(OUTBOX_STORAGE_KEY, updated);
  notifyQueueChange(updated.length);
  return queuedItem;
}

/**
 * Mengambil daftar seluruh pesanan tertunda di outbox
 */
export async function getPendingOfflineOrders(): Promise<QueuedOfflineOrder[]> {
  const list: QueuedOfflineOrder[] = (await get(OUTBOX_STORAGE_KEY)) || [];
  return list;
}

/**
 * Menghapus pesanan dari outbox setelah berhasil di-sinkronkan ke server
 */
export async function removeOfflineOrder(orderId: string): Promise<void> {
  const existing: QueuedOfflineOrder[] = (await get(OUTBOX_STORAGE_KEY)) || [];
  const updated = existing.filter((item) => item.id !== orderId);
  await set(OUTBOX_STORAGE_KEY, updated);
  notifyQueueChange(updated.length);
}

/**
 * Mengosongkan seluruh antrean outbox (misal setelah sinkronisasi massal berhasil)
 */
export async function clearOfflineOrders(): Promise<void> {
  await del(OUTBOX_STORAGE_KEY);
  notifyQueueChange(0);
}

/**
 * Sinkronkan (flush) seluruh antrean outbox ke backend API secara berurutan (FIFO)
 */
export async function flushOfflineOutbox(
  senderFn: (orderPayload: any) => Promise<{ success: boolean; error?: string }>
): Promise<{ syncedCount: number; failedCount: number }> {
  const queue = await getPendingOfflineOrders();
  if (queue.length === 0) return { syncedCount: 0, failedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      const res = await senderFn(item.payload);
      if (res.success) {
        await removeOfflineOrder(item.id);
        syncedCount++;
      } else {
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastError = res.error || "Gagal sinkron";
        failedCount++;
      }
    } catch (err: any) {
      item.retryCount = (item.retryCount || 0) + 1;
      item.lastError = err.message || "Network error";
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}

// Global subscribers untuk update status antrean secara real-time di UI
type QueueListener = (count: number) => void;
const listeners = new Set<QueueListener>();

function notifyQueueChange(count: number) {
  listeners.forEach((fn) => {
    try {
      fn(count);
    } catch {}
  });
}

export function subscribeOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  getPendingOfflineOrders().then((list) => listener(list.length)).catch(() => {});
  return () => {
    listeners.delete(listener);
  };
}

