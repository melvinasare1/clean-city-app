import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { AppText, AppTextInput, ResponsiveContent } from '@/components';
import { useCart } from '@/contexts/cart-context';
import { useProductsContext } from '@/contexts/products-context';
import { useAuth } from '@/hooks/useAuth';
import { STRIPE_PAYMENTS_ENABLED } from '@/lib/stripe-payments-enabled';
import { STORE_FLAT_DELIVERY_FEE_GHS } from '@/lib/orders';
import { pickupAddressText } from '@/lib/profile-location';
import { formatStorePrice } from '@/lib/products';
import type { CustomerStackParamList } from '@/navigation/types';
import { trackEvent } from '@/services/analytics';
import {
  createStoreOrder,
  initiatePaymentForOrder,
} from '@/services/order-service';
import type { StoreOrderItem } from '@/types/order';
import { colors } from '@platform/shared-theme';
import { styles } from './cart-screen.styles';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Cart'>;

const formatGhs = (value: number) => `GHS ${value.toFixed(2)}`;

export const CartScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { productsById } = useProductsContext();
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalPrice,
    totalItemCount,
  } = useCart();
  const address = pickupAddressText(user ?? {});

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const lines = useMemo(
    () =>
      items
        .map((line) => {
          const product = productsById[line.productId];
          if (!product) return null;
          return { line, product };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    [items, productsById]
  );

  const hasUnpricedItems = lines.some(
    (row) => row.product.pricePlaceholder
  );
  const deliveryFee = STORE_FLAT_DELIVERY_FEE_GHS;
  const total = totalPrice + deliveryFee;
  const canCheckout =
    !!user &&
    lines.length > 0 &&
    !!address &&
    !hasUnpricedItems &&
    totalPrice > 0 &&
    !isSaving;

  const handleChangeAddress = () => {
    navigation.navigate('SetPickupLocation', {
      initialAddress: address || undefined,
      initialLocation: user?.location ?? null,
      saveToProfile: true,
    });
  };

  const handleApplyPromo = () => {
    Alert.alert(
      'Promo codes unavailable',
      'Promo codes are not active yet. Your order total is unchanged.'
    );
  };

  const handleCheckout = async () => {
    if (!user) {
      Alert.alert('Error', 'You need to be logged in to place an order.');
      return;
    }
    if (!address) {
      Alert.alert(
        'Missing address',
        'Please add a delivery address before checkout.'
      );
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Empty cart', 'Add items from the Store before checkout.');
      return;
    }
    if (hasUnpricedItems || totalPrice <= 0) {
      Alert.alert(
        'Prices not ready',
        'Some items in your cart do not have a confirmed price yet.'
      );
      return;
    }

    const orderItems: StoreOrderItem[] = lines.map(({ line, product }) => ({
      productId: product.id,
      name: product.name,
      description: product.description,
      quantity: line.quantity,
      unitPrice: product.price,
      totalPrice: product.price * line.quantity,
      imageUrl: product.imageUrl,
    }));

    try {
      setIsSaving(true);
      const orderId = await createStoreOrder({
        userId: user.id,
        userEmail: user.email,
        items: orderItems,
        subtotal: totalPrice,
        deliveryFee,
        total,
        deliveryAddress: address,
      });

      const { authorizationUrl } = await initiatePaymentForOrder(orderId);

      await trackEvent('payment_started', {
        screen: 'store_cart',
        amount: Number(total),
        currency: 'GHS',
        provider: 'paystack',
        type: 'store_order',
      });
      await trackEvent('payment_provider_opened', {
        screen: 'store_cart',
        provider: 'paystack',
      });

      clearCart();
      await Linking.openURL(authorizationUrl);

      Alert.alert(
        'Complete payment to confirm',
        'Your order is almost ready. Complete payment in the opened page to confirm it.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      console.error('Store checkout error:', error);
      Alert.alert('Checkout failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollRoot}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

          <AppText style={styles.pageTitle}>Your Cart</AppText>
          <AppText style={styles.pageSubtitle}>
            Review your items and delivery details before checkout.
          </AppText>

          {lines.length === 0 ? (
            <AppText style={styles.empty}>
              Your cart is empty. Add bins or liners from the Store.
            </AppText>
          ) : (
            lines.map(({ line, product }) => (
              <View key={product.id} style={styles.itemCard}>
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
                      name={
                        product.category === 'liner'
                          ? 'layers-outline'
                          : 'trash-outline'
                      }
                      size={28}
                      color={colors.brandGreen}
                    />
                  )}
                </View>
                <View style={styles.itemCopy}>
                  <AppText style={styles.itemName}>{product.name}</AppText>
                  <AppText style={styles.itemDescription} numberOfLines={2}>
                    {product.description}
                  </AppText>
                  <View style={styles.itemFooter}>
                    <AppText style={styles.itemPrice}>
                      {formatStorePrice(product)}
                    </AppText>
                    <View style={styles.itemActions}>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() =>
                            updateQuantity(product.id, line.quantity - 1)
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease ${product.name} quantity`}
                        >
                          <Ionicons
                            name="remove"
                            size={16}
                            color={colors.inkPrimary}
                          />
                        </TouchableOpacity>
                        <AppText style={styles.stepperCount}>
                          {line.quantity}
                        </AppText>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() =>
                            updateQuantity(product.id, line.quantity + 1)
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Increase ${product.name} quantity`}
                        >
                          <Ionicons
                            name="add"
                            size={16}
                            color={colors.inkPrimary}
                          />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => removeFromCart(product.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${product.name} from cart`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={colors.signalRed}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.promoHeader}
            onPress={() => setPromoOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="Have a promo code?"
            accessibilityState={{ expanded: promoOpen }}
          >
            <AppText style={styles.promoHeaderText}>Have a promo code?</AppText>
            <Ionicons
              name={promoOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.inkSecondary}
            />
          </TouchableOpacity>
          {promoOpen ? (
            <View style={styles.promoRow}>
              <View style={styles.promoInput}>
                <AppTextInput
                  value={promoCode}
                  onChangeText={setPromoCode}
                  placeholder="Enter code"
                  autoCapitalize="characters"
                  accessibilityLabel="Promo code"
                />
              </View>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApplyPromo}
                accessibilityRole="button"
                accessibilityLabel="Apply promo code"
              >
                <AppText style={styles.applyButtonText}>Apply</AppText>
              </TouchableOpacity>
            </View>
          ) : null}

          <AppText style={styles.sectionLabel}>Order Summary</AppText>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>Subtotal</AppText>
              <AppText style={styles.summaryValue}>
                {hasUnpricedItems ? 'Price TBD' : formatGhs(totalPrice)}
              </AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>Delivery fee</AppText>
              <AppText style={styles.summaryValue}>{formatGhs(deliveryFee)}</AppText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={[styles.summaryRow, { marginBottom: 0 }]}>
              <AppText style={styles.summaryTotalLabel}>Total</AppText>
              <AppText style={styles.summaryTotalValue}>
                {hasUnpricedItems ? 'Price TBD' : formatGhs(total)}
              </AppText>
            </View>
          </View>

          <AppText style={styles.sectionLabel}>Delivery Information</AppText>
          <View style={styles.addressCard}>
            <View style={styles.addressIconWrap}>
              <Ionicons
                name="location-outline"
                size={20}
                color={colors.brandGreen}
              />
            </View>
            <View style={styles.addressCopy}>
              {address ? (
                <AppText style={styles.addressText}>{address}</AppText>
              ) : (
                <AppText style={styles.addressMissing}>
                  Add a delivery address to continue
                </AppText>
              )}
            </View>
            <TouchableOpacity
              style={styles.changeLink}
              onPress={handleChangeAddress}
              accessibilityRole="button"
              accessibilityLabel="Change delivery address"
            >
              <AppText style={styles.changeLinkText}>Change</AppText>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.brandGreen}
              />
            </TouchableOpacity>
          </View>
          <AppText style={styles.disclaimer}>
            Orders placed before 6pm are dispatched the same day.
          </AppText>

          <AppText style={styles.sectionLabel}>Payment method</AppText>
          <View style={styles.paymentRow}>
            <View
              style={[styles.paymentCard, styles.paymentCardSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: true }}
              accessibilityLabel="Mobile Money"
            >
              <View style={styles.paymentCardHeader}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color={colors.brandGreen}
                  />
                </View>
                <View style={[styles.paymentRadio, styles.paymentRadioSelected]}>
                  <Ionicons name="checkmark" size={12} color={colors.surfaceWhite} />
                </View>
              </View>
              <AppText style={styles.paymentTitle}>Mobile Money</AppText>
              <AppText style={styles.paymentSubtitle}>
                Pay with MTN, Telecel or AirtelTigo.
              </AppText>
            </View>

            {STRIPE_PAYMENTS_ENABLED ? (
              <View
                style={[styles.paymentCard, styles.paymentCardDisabled]}
                accessibilityRole="radio"
                accessibilityState={{ disabled: true }}
                accessibilityLabel="Card, coming soon"
              >
                <View style={styles.paymentCardHeader}>
                  <View style={styles.paymentIconWrap}>
                    <Ionicons
                      name="card-outline"
                      size={18}
                      color={colors.inkSecondary}
                    />
                  </View>
                  <View style={styles.paymentRadio} />
                </View>
                <AppText style={styles.paymentTitle}>Card</AppText>
                <AppText style={styles.paymentSubtitle}>
                  Visa, Mastercard or other cards
                </AppText>
                <View style={styles.comingSoon}>
                  <AppText style={styles.comingSoonText}>Coming soon</AppText>
                </View>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.checkoutButton,
              !canCheckout && styles.checkoutButtonDisabled,
            ]}
            onPress={handleCheckout}
            disabled={!canCheckout}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCheckout }}
            accessibilityLabel="Proceed to Checkout"
          >
            {isSaving ? (
              <ActivityIndicator color={colors.surfaceWhite} />
            ) : (
              <AppText style={styles.checkoutButtonText}>
                Proceed to Checkout
                {totalItemCount > 0 && !hasUnpricedItems
                  ? ` · ${formatGhs(total)}`
                  : ''}
              </AppText>
            )}
          </TouchableOpacity>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
};
