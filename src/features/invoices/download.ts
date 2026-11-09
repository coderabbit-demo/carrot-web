import { request } from '../../lib/api/client';

/** Reads the file name from a Content-Disposition header, falling back to `fallback`. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  let name: string | null = null;
  if (encoded) {
    try {
      name = decodeURIComponent(encoded[1].trim());
    } catch {
      name = null;
    }
  }
  if (!name) {
    const plain = /filename="?([^";]+)"?/i.exec(header);
    name = plain ? plain[1].trim() : null;
  }
  if (!name) return fallback;
  const safe = name.replace(/[\\/]/g, '_');
  return safe || fallback;
}

/** Fetches the invoice with the session cookie and hands it to the browser as a file download. */
export async function downloadInvoice(invoiceId: string, fallbackName: string): Promise<void> {
  const res = await request<Blob>('GET', `/invoices/${encodeURIComponent(invoiceId)}/download`, {
    responseType: 'blob',
  });
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackName);

  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
