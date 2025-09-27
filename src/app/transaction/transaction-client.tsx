'use client';

import { Clipboard, Wallet, Calendar, ShoppingBag, Package, Tag, Hash, Percent, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SaleDetails {
  id: string;
  selledAt: any;
  quantity: number;
  sellingPrice: number;
  totalIncome: number;
  transactionHash: string;
  productName: string;
  productPrice: number;
  originalPrice?: number;
  discountedPrice?: number;
  discountPercentage?: number;
}

const formatNumber = (numStr: string | number | undefined): string => {
  if (numStr === undefined || numStr === null) return '0';
  const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
  if (isNaN(num)) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function DetailRow({ icon: Icon, label, value, subValue, isHash = false }: { 
  icon: React.ElementType, 
  label: string, 
  value: string | React.ReactNode, 
  subValue?: string | React.ReactNode, 
  isHash?: boolean 
}) {
  const { toast } = useToast();

  const handleCopy = () => {
    if (typeof value === 'string') {
      navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: "Transaction hash copied!" });
    }
  };

  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-1">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1 text-right">
        <div>
          <span className="font-medium tabular-nums">{value}</span>
          {subValue && <div className="text-sm text-muted-foreground tabular-nums">{subValue}</div>}
        </div>
        {isHash && (
          <button onClick={handleCopy} className="text-muted-foreground hover:text-primary self-center">
            <Clipboard className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function TransactionClient({ sale }: { sale: SaleDetails }) {
  const { lang } = useLanguage();
  const t = translations[lang];
  const wasDiscounted = sale.discountPercentage && sale.discountPercentage > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="text-muted-foreground font-normal flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t.saleAmount}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {formatNumber(sale.totalIncome)} UZS
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-lg p-2">
        <CardHeader>
          <CardTitle className="text-sm">{t.mainInformation}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0 text-sm">
          <DetailRow
            icon={Calendar}
            label={t.dateAndTime}
            value={sale.selledAt ? format(sale.selledAt.toDate(), 'dd.MM.yyyy HH:mm:ss') : '-'}
          />
          <DetailRow
            icon={ShoppingBag}
            label={t.productLabel}
            value={`${sale.productName}`}
          />
          <DetailRow
            icon={Package}
            label={t.quantityLabel}
            value={`${sale.quantity} ${t.quantityUnit}`}
          />
          <DetailRow
            icon={Tag}
            label={t.pricePerUnit}
            value={`${formatNumber(sale.sellingPrice)} UZS`}
          />
          <DetailRow
            icon={Hash}
            label={t.transactionHash}
            value={sale.transactionHash}
            isHash
          />
        </CardContent>
      </Card>

      {wasDiscounted && (
        <Card className="mt-6 rounded-lg p-2">
          <CardHeader>
            <CardTitle className="flex items-center text-sm gap-2">
              {t.appliedDiscount} <Percent className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0 text-sm">
            <DetailRow
              icon={Tag}
              label={t.originalPrice}
              value={<span className="line-through">{formatNumber(sale.originalPrice)} UZS</span>}
            />
            <DetailRow
              icon={Percent}
              label={t.discountLabel}
              value={`${sale.discountPercentage}%`}
            />
            <DetailRow
              icon={ArrowDown}
              label={t.priceWithDiscount}
              value={<span className="font-bold text-primary">{formatNumber(sale.discountedPrice)} UZS</span>}
              subValue={t.perUnit}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
