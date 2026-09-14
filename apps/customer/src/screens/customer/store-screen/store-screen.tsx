import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, ResponsiveContent } from '@/components';
import { useCart } from '@/contexts/cart-context';
import { useProducts } from '@/hooks/useProducts';
import { formatStorePrice } from '@/lib/products';
import type { CustomerStackParamList } from '@/navigation/types';
import type { StoreProduct } from '@/types/product';
import { colors } from '@platform/shared-theme';
import { styles } from './store-screen.styles';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Store'>;

function ProductCard({
  product,
  onAdd,
  justAdded,
}: {
  product: StoreProduct;
  onAdd: (productId: string) => void;
  justAdded: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons
            name={product.category === 'liner' ? 'layers-outline' : 'trash-outline'}
            size={32}
            color={colors.brandGreen}
          />
        )}
      </View>
      <View style={styles.cardCopy}>
        <AppText style={styles.productName}>{product.name}</AppText>
        <AppText style={styles.productDescription} numberOfLines={2}>
          {product.description}
        </AppText>
        <AppText style={styles.price}>{formatStorePrice(product)}</AppText>
        <TouchableOpacity
          style={[styles.addButton, justAdded && styles.addButtonAdded]}
          onPress={() => onAdd(product.id)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.name} to cart`}
        >
          <AppText style={styles.addButtonText}>
            {justAdded ? 'Added' : 'Add to Cart'}
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const StoreScreen: React.FC<Props> = ({ navigation }) => {
  const scrollRef = useRef<ScrollView>(null);
  const catalogOffset = useRef(0);
  const { products, loading } = useProducts();
  const { addToCart, totalItemCount } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  const bins = useMemo(
    () => products.filter((p) => p.enabled && p.category === 'bin'),
    [products]
  );
  const liners = useMemo(
    () => products.filter((p) => p.enabled && p.category === 'liner'),
    [products]
  );
  const hasCatalog = bins.length > 0 || liners.length > 0;

  const handleAdd = useCallback(
    (productId: string) => {
      addToCart(productId);
      setAddedId(productId);
      if (addedTimer.current) clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setAddedId(null), 1600);
    },
    [addToCart]
  );

  const scrollToCatalog = () => {
    scrollRef.current?.scrollTo({ y: catalogOffset.current, animated: true });
  };

  const badgeLabel = totalItemCount > 99 ? '99+' : String(totalItemCount);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollRoot}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.inkPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <AppText style={styles.pageTitle}>Store</AppText>
              <AppText style={styles.pageSubtitle}>
                Bins and liners for a cleaner home — pickup service sold separately.
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => navigation.navigate('Cart')}
              accessibilityRole="button"
              accessibilityLabel={
                totalItemCount > 0
                  ? `Cart, ${totalItemCount} items`
                  : 'Cart, empty'
              }
            >
              <Ionicons name="cart-outline" size={22} color={colors.inkPrimary} />
              {totalItemCount > 0 ? (
                <View style={styles.cartBadge}>
                  <AppText style={styles.cartBadgeText}>{badgeLabel}</AppText>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={styles.promoBanner}>
            <AppText style={styles.promoTitle}>
              Quality bins for a cleaner Ghana
            </AppText>
            <AppText style={styles.promoBody}>
              Stock up on bins and liners, then check out from your cart.
            </AppText>
            <TouchableOpacity
              style={styles.shopNowButton}
              onPress={scrollToCatalog}
              accessibilityRole="button"
              accessibilityLabel="Shop now, scroll to products"
            >
              <AppText style={styles.shopNowText}>Shop Now</AppText>
            </TouchableOpacity>
          </View>

          <View
            onLayout={(event) => {
              catalogOffset.current = event.nativeEvent.layout.y;
            }}
          >
            {loading && !hasCatalog ? (
              <ActivityIndicator color={colors.brandGreen} style={styles.loader} />
            ) : !hasCatalog ? (
              <AppText style={styles.empty}>
                The store is empty right now. Please check back soon.
              </AppText>
            ) : (
              <>
                {bins.length > 0 ? (
                  <View style={styles.sectionBlock}>
                    <AppText style={styles.sectionHeader}>Bins</AppText>
                    {bins.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAdd={handleAdd}
                        justAdded={addedId === product.id}
                      />
                    ))}
                  </View>
                ) : null}
                {liners.length > 0 ? (
                  <View style={styles.sectionBlock}>
                    <AppText style={styles.sectionHeader}>Bin Liners</AppText>
                    {liners.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAdd={handleAdd}
                        justAdded={addedId === product.id}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
};
