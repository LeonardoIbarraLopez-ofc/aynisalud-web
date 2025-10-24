export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentDetails {
    method: 'Efectivo' | 'Tarjeta' | 'QR' | 'Seguro';
    amount: number;
    transactionDate: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentDetails?: PaymentDetails[];
}
