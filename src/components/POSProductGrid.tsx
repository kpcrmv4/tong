import React from 'react';
import { Search } from 'lucide-react';
import { Product } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export interface POSProductGridProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  filteredProducts: Product[];
  handleOpenQtyModal: (p: Product) => void;
}

export default function POSProductGrid({
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  handleOpenQtyModal,
}: POSProductGridProps) {
  return (
    <section id="pos-product-grid-start" className="min-w-0 space-y-4 pb-4" aria-label="เลือกสินค้า POS">
      <div className="pos-filter-toolbar flex min-w-0 flex-col gap-4 md:flex-row md:items-center">
        <Input
          icon={<Search size={18} />}
          type="text"
          placeholder="ค้นหารหัส SKU หรือชื่อสินค้า..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="ค้นหาสินค้า"
          className="pos-search-input"
        />

        <div className="pos-category-tabs flex w-full min-w-0 gap-2 overflow-x-auto md:w-auto md:shrink-0">
          {categories.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={selectedCategory === cat ? 'primary' : 'secondary'}
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className="pos-category-tab shrink-0 whitespace-nowrap"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3 product-grid select-none">
        {filteredProducts.map((p) => {
          const availableQty = Number((p as any).qty_available ?? (p as any).stock ?? 0) || 0;
          const status = p.item_status || 'Active';
          const isCriticalStock = availableQty <= 5 && status === 'Active';
          const isWarningStock = availableQty <= 10 && availableQty > 5 && status === 'Active';

          const category = p.category;
          let namePart = category;
          let sizePart = '';

          if (p.item_name.startsWith(category)) {
            sizePart = p.item_name.substring(category.length).trim();
          } else {
            const firstSpaceIndex = p.item_name.indexOf(' ');
            if (firstSpaceIndex !== -1) {
              namePart = p.item_name.substring(0, firstSpaceIndex);
              sizePart = p.item_name.substring(firstSpaceIndex + 1);
            } else {
              namePart = p.item_name;
              sizePart = p.unit || '';
            }
          }

          const stockBadge = isCriticalStock
            ? { label: 'สต็อกใกล้หมด', className: 'bg-[var(--ui-danger)] text-[var(--text-main)] border-[var(--ui-danger)]' }
            : isWarningStock
              ? { label: 'เฝ้าระวัง', className: 'bg-[var(--ui-warning)] text-[var(--text-main)] border-[var(--ui-warning)]' }
              : null;

          return (
            <Button
              key={p.item_id}
              type="button"
              onClick={() => handleOpenQtyModal(p)}
              className={`pos-product-card h-auto min-h-[92px] w-full min-w-0 flex flex-col items-center justify-center gap-1 rounded-xl border bg-[var(--ui-surface)] px-3 py-2 text-center transition-all active:opacity-80 whitespace-normal break-words leading-tight overflow-visible ${
                isCriticalStock
                  ? 'pos-product-card-critical blink-red-card-active'
                  : isWarningStock
                    ? 'pos-product-card-warning'
                    : 'pos-product-card-normal'
              }`}
            >
              {stockBadge && (
                <div className="w-full text-center">
                  <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-black ${stockBadge.className}`}>
                    {stockBadge.label}
                  </span>
                </div>
              )}

              <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1">
                <h4 className="w-full break-words text-sm font-extrabold uppercase tracking-wide text-[var(--text-main)] text-center whitespace-normal leading-tight">
                  {namePart}
                </h4>
                {sizePart && (
                  <p className="w-full break-words text-sm font-semibold text-[var(--text-main)] text-center whitespace-normal leading-tight">
                    {sizePart}
                  </p>
                )}
              </div>

              <div className="w-full text-center text-[12px] font-semibold text-[var(--ui-primary)]">
                {(Number(p.use_type === 'sale' ? ((p as any).price_sale ?? (p as any).base_price ?? p.price_rent) : ((p as any).price_rent ?? (p as any).rental_price ?? p.price_sale)) || 0).toLocaleString()} บาท
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
