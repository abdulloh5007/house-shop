'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, getFirestore, query, collection, where, getDocs, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Loader2, Calendar, Hash, Package, Tag, DollarSign, TrendingUp, ShoppingBag, Clipboard, Percent, ArrowDown, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { BalanceTransaction } from '@/app/admin/wallet/_components/balance-provider';

// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
    if (numStr === undefined || numStr === null) return '0';
    const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
    if (isNaN(num)) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function DetailRow({ icon: Icon, label, value, subValue, isHash = false }: { icon: React.ElementType, label: string, value: string | React.ReactNode, subValue?: string | React.ReactNode, isHash?: boolean }) {
    const { toast } = useToast();
    const { lang } = useLanguage();
    const t = translations[lang];

    const handleCopy = () => {
        if (typeof value === 'string') {
            navigator.clipboard.writeText(value);
            toast({ title: t.copied, description: t.transactionHashCopied });
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

export default function TransactionDetailPage() {
    const searchParams = useSearchParams();
    const transactionHash = searchParams.get('hash');
    const router = useRouter();

    const [transaction, setTransaction] = useState<BalanceTransaction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteReason, setDeleteReason] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const reasonInputRef = useRef<HTMLInputElement>(null);
    const { lang } = useLanguage();
    const t = translations[lang];
    const { toast } = useToast();

    useEffect(() => {
        if (!transactionHash) {
            setError(t.missingTransactionHash);
            setLoading(false);
            return;
        }

        const fetchTransactionDetails = async () => {
            try {
                const db = getFirestore(app);
                const transactionsRef = collection(db, 'settings', 'balance', 'transactions');
                const q = query(transactionsRef, where('transactionHash', '==', transactionHash));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    setTransaction({ id: docSnap.id, ...docSnap.data() } as BalanceTransaction);
                } else {
                    setError(t.transactionNotFound);
                }
            } catch (err) {
                console.error("Error fetching transaction details:", err);
                setError(t.failedToLoadTransactionData);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactionDetails();
    }, [transactionHash, t]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <BackButton />
                <h1 className="text-2xl font-bold mb-4 mt-8">{t.errorTitle}</h1>
                <p className="text-destructive">{error}</p>
            </div>
        );
    }

    if (!transaction) {
        return null;
    }

    const wasDiscounted = transaction.discountPercentage && transaction.discountPercentage > 0;

    const handleRevertTransaction = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (!transaction) return;
        if (!deleteReason) {
            reasonInputRef.current?.focus();
            toast({ title: t.errorTitle, description: t.deleteReasonPlaceholder, variant: "destructive" });
            return;
        }
        setIsDeleting(true);
        try {
            const response = await fetch('/api/admin/revert-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionHash: transaction.transactionHash, reason: deleteReason }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.details || data.error || t.failedToRevertTransaction);
            }

            // Обновить transaction в стейте
            setTransaction(prev => prev ? { ...prev, deleted: true, deleteReason: deleteReason, deletedAt: new Date() } : prev);
            toast({ title: t.transactionReverted, description: t.transactionSuccessfullyReverted });
            setIsDialogOpen(false);
            // Не перенаправляем, чтобы пользователь видел статус "Удалено"
        } catch (err) {
            console.error("Failed to revert transaction:", err);
            toast({ title: t.errorTitle, description: (err as Error).message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <BackButton />
            <Card className="shadow-lg mb-6">
                <CardHeader>
                    <CardTitle className="text-muted-foreground text-xl font-normal flex items-center gap-2">
                        <Hash className="h-5 w-5" />
                        {t.transactionDetails}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold tabular-nums">
                        {formatNumber(transaction.totalIncome)}
                    </p>
                    <p className="text-lg text-muted-foreground">
                        {t.realProfit}: {formatNumber(transaction.realProfit)}
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
                        value={transaction.createdAt ? format(transaction.createdAt.toDate(), 'dd.MM.yyyy HH:mm:ss') : '-'}
                    />
                    <DetailRow
                        icon={ShoppingBag}
                        label={t.productLabel}
                        value={`${transaction.productName}`}
                    />
                    <DetailRow
                        icon={Package}
                        label={t.quantityLabel}
                        value={`${transaction.quantity} ${t.quantityUnit}`}
                    />
                    <DetailRow
                        icon={DollarSign}
                        label={t.sellingPrice}
                        value={`${formatNumber(transaction.sellingPrice)} UZS`}
                    />
                    <DetailRow
                        icon={TrendingUp}
                        label={t.purchasePrice}
                        value={`${formatNumber(transaction.purchasePrice)} UZS`}
                    />
                    <DetailRow
                        icon={Hash}
                        label={t.transactionHash}
                        value={transaction.transactionHash}
                        isHash
                    />
                </CardContent>
            </Card>

            {wasDiscounted && ( // Keep this condition to only show discount if it was applied
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
                            value={<span className="line-through">{formatNumber(transaction.originalPrice)} UZS</span>}
                        />
                        <DetailRow
                            icon={Percent}
                            label={t.discountLabel}
                            value={`${transaction.discountPercentage}%`}
                        />
                        <DetailRow
                            icon={ArrowDown}
                            label={t.priceWithDiscount}
                            value={<span className="font-bold text-primary">{formatNumber(transaction.discountedPrice)} UZS</span>}
                            subValue={t.perUnit}
                        />
                    </CardContent>
                </Card>
            )}


            {transaction.deleted ? (
                <div className="mt-8 max-w-md mx-auto">
                    <Card className="border-red-500/50 bg-red-500/10 text-red-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Trash2 className="h-5 w-5" />
                                {t.deleted}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">
                                {t.deleteReasonLabel}: {t[transaction.deleteReason as keyof typeof t] || transaction.deleteReason || 'N/A'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="mt-8 max-w-md mx-auto">
                    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full" onClick={() => setIsDialogOpen(true)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t.revertTransaction}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t.revertTransactionConfirmTitle}</AlertDialogTitle>
                                <AlertDialogDescription>{t.revertTransactionConfirmDesc}</AlertDialogDescription>
                                <div className="mt-4">
                                    <label className="block text-sm mb-1" htmlFor="delete-reason">{t.deleteReasonLabel}</label>
                                    <Select onValueChange={setDeleteReason} value={deleteReason} disabled={isDeleting}>
                                        <SelectTrigger id="delete-reason">
                                            <SelectValue placeholder={t.deleteReasonPlaceholder} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="deleteReasonPriceIsLow">
                                                {t.deleteReasonPriceIsLow}
                                            </SelectItem>
                                            <SelectItem value="deleteReasonQuantityIsWrong">
                                                {t.deleteReasonQuantityIsWrong}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <div className="flex gap-2   w-full items-center">
                                    <AlertDialogCancel className="flex-1 flex items-center justify-center h-10" disabled={isDeleting} onClick={() => setIsDialogOpen(false)}>
                                        {t.cancel}
                                    </AlertDialogCancel>
                                    <AlertDialogAction className="flex-1 flex items-center justify-center h-10" onClick={handleRevertTransaction} disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.deleteButton}
                                    </AlertDialogAction>
                                </div>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    );
}