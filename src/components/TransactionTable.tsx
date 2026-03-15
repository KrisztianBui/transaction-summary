import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MonzoTransaction } from '@/types/monzo';

interface TransactionTableProps {
  transactions: MonzoTransaction[];
}

const COLUMNS: { label: string; key: keyof MonzoTransaction }[] = [
  { label: 'Date', key: 'date' },
  { label: 'Name', key: 'name' },
  { label: 'Category', key: 'category' },
  { label: 'Amount', key: 'amount' },
  { label: 'Currency', key: 'currency' },
  { label: 'Money Out', key: 'moneyOut' },
  { label: 'Money In', key: 'moneyIn' },
];

function TransactionTable({ transactions }: TransactionTableProps) {
  if (transactions.length === 0) {
    return <p>No transactions found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((col) => (
            <TableHead key={col.key}>{col.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction, index) => (
          <TableRow key={transaction.transactionId || index}>
            {COLUMNS.map((col) => (
              <TableCell key={col.key}>{transaction[col.key]}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { TransactionTable };
