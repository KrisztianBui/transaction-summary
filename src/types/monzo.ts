export interface MonzoTransaction {
  transactionId: string;
  date: string;
  time: string;
  type: string;
  name: string;
  emoji: string;
  category: string;
  amount: string;
  currency: string;
  localAmount: string;
  localCurrency: string;
  notes: string;
  address: string;
  receipt: string;
  description: string;
  categorySplit: string;
  moneyOut: string;
  moneyIn: string;
}
