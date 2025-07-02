
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Search, X } from "lucide-react";
import { useProducts } from '@/hooks/useProducts';
import { useIsMobile } from '@/hooks/use-mobile';

interface BulkProductSelectorProps {
  onAdd: (selectedProducts: Array<{ product: any; quantity: string }>) => Promise<void>;
  onCancel: () => void;
}

export const BulkProductSelector = ({ onAdd, onCancel }: BulkProductSelectorProps) => {
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const isMobile = useIsMobile();

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleProductToggle = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
      const newQuantities = { ...quantities };
      delete newQuantities[productId];
      setQuantities(newQuantities);
    } else {
      newSelected.add(productId);
      setQuantities(prev => ({ ...prev, [productId]: '1' }));
    }
    setSelectedProducts(newSelected);
  };

  const handleQuantityChange = (productId: string, quantity: string) => {
    // Input validation: only allow positive numbers
    if (quantity === '' || /^\d+$/.test(quantity)) {
      setQuantities(prev => ({ ...prev, [productId]: quantity }));
    }
  };

  const handleSubmit = async () => {
    const selectedProductsData = Array.from(selectedProducts)
      .map(productId => {
        const product = products.find(p => p.id === productId);
        const quantity = quantities[productId];
        // Validate quantity is a positive number
        if (product && quantity && /^\d+$/.test(quantity) && parseInt(quantity) > 0) {
          return { product, quantity };
        }
        return null;
      })
      .filter(Boolean) as Array<{ product: any; quantity: string }>;

    if (selectedProductsData.length === 0) return;

    setIsAdding(true);
    try {
      await onAdd(selectedProductsData);
    } finally {
      setIsAdding(false);
    }
  };

  const selectedCount = selectedProducts.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4">
      <Card className={`w-full ${isMobile ? 'max-w-sm' : 'max-w-4xl'} max-h-[90vh] overflow-hidden`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Package className="h-5 w-5" />
            <span className={isMobile ? 'text-base' : ''}>Select Products</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.slice(0, 100))}
              className="pl-10"
              maxLength={100}
              size={isMobile ? "sm" : "default"}
            />
          </div>

          <div className={`${isMobile ? 'max-h-64' : 'max-h-96'} overflow-y-auto space-y-2`}>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {searchTerm ? 'No products found matching your search' : 'No products available'}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    selectedProducts.has(product.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={() => handleProductToggle(product.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm md:text-base break-words">{product.name}</h4>
                      <div className="flex flex-col md:flex-row md:items-center md:space-x-4 text-xs md:text-sm text-muted-foreground">
                        {product.category && <span>Category: {product.category}</span>}
                        {product.unit && <span>Unit: {product.unit}</span>}
                      </div>
                    </div>
                    {selectedProducts.has(product.id) && (
                      <div className={`${isMobile ? 'w-16' : 'w-24'} flex-shrink-0`}>
                        <Label htmlFor={`quantity-${product.id}`} className="sr-only">
                          Quantity
                        </Label>
                        <Input
                          id={`quantity-${product.id}`}
                          placeholder="Qty"
                          value={quantities[product.id] || ''}
                          onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                          className="text-center text-xs"
                          maxLength={3}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between pt-4 border-t space-y-3 md:space-y-0">
            <div className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
              {selectedCount} product{selectedCount !== 1 ? 's' : ''} selected
            </div>
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
              <Button 
                variant="outline" 
                onClick={onCancel} 
                disabled={isAdding}
                className="w-full md:w-auto"
                size={isMobile ? "sm" : "default"}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={selectedCount === 0 || isAdding}
                className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                size={isMobile ? "sm" : "default"}
              >
                {isAdding ? 'Adding...' : `Add ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
