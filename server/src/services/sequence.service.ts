import { prisma } from './prisma.service';

const pad = (n: number, width = 5) => String(n).padStart(width, '0');
const year = () => new Date().getFullYear();

export const nextReceiptNumber = async () => {
  const count = await prisma.feeReceipt.count();
  return `RCP-${year()}-${pad(count + 1)}`;
};

export const nextExpenseNumber = async () => {
  const count = await prisma.expense.count();
  return `EXP-${year()}-${pad(count + 1)}`;
};

export const nextLoanNumber = async () => {
  const count = await prisma.loan.count();
  return `LN-${year()}-${pad(count + 1)}`;
};

export const nextPaymentNumber = async () => {
  const count = await prisma.loanPayment.count();
  return `PMT-${year()}-${pad(count + 1)}`;
};
