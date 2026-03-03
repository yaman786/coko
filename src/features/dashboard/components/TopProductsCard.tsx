import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import type { TopProduct } from '../../../utils/analytics';

interface TopProductsCardProps {
    title?: string;
    products: TopProduct[];
}

export function TopProductsCard({ title = "Top Sellers", products }: TopProductsCardProps) {
    return (
        <Card className="col-span-1 border-t-4 border-t-pink-500">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Most popular items by revenue</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {products.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">No sales data available yet.</div>
                    ) : (
                        products.map((product, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-500 font-bold text-xs">
                                        #{index + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 line-clamp-1">{product.name}</p>
                                        <p className="text-xs text-slate-500">{product.quantity} sold</p>
                                    </div>
                                </div>
                                <div className="font-semibold text-sm text-slate-800">
                                    Nrs. {product.revenue.toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
