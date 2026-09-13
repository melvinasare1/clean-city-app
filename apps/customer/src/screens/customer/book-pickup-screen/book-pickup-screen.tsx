import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppText, ResponsiveContent } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { usePricing } from '@/hooks/usePricing';
import { isProfileComplete } from '@/lib/referral-utils';
import { BIN_CATALOG, getEnabledBinCatalog, getUnitPrice } from '@/lib/pricing';
import { COLORS } from '@/lib/constants';
import type { BinPriceKey } from '@/types/pricing';
import type { BookingBinItem } from '@platform/shared-types';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  hasPrefillQuantities,
  quantitiesFromBookingItems,
} from '../customer-home-screen/customer-home-screen.utils';
import { styles } from './book-pickup-screen.styles';

type BookPickupScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'NewBooking'
>;

const BIN_IMAGES: Record<BinPriceKey, number> = {
  smallBag: require('../../../../assets/images/small-bag.jpg'),
  standardBin: require('../../../../assets/images/standard-bin.jpg'),
  wheelieBin: require('../../../../assets/images/wheelie-bin.jpg'),
};

const UNIT_LABEL: Record<BinPriceKey, string> = {
  smallBag: 'per bag',
  standardBin: 'per bin',
  wheelieBin: 'per bin',
};

const formatPrice = (value: number) => `¢${value.toFixed(2)}`;

const initialQuantities = (): Record<BinPriceKey, number> => ({
  smallBag: 0,
  standardBin: 0,
  wheelieBin: 0,
});

export const BookPickupScreen: React.FC<BookPickupScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { pricing, loading: pricingLoading } = usePricing();
  const profileComplete =
    user?.profileComplete ?? isProfileComplete(user ?? {});

  const [quantities, setQuantities] = useState(initialQuantities);
  const [showBinInfoSheet, setShowBinInfoSheet] = useState(false);

  useEffect(() => {
    const items = route.params?.prefillItems;
    if (items?.length) {
      const next = quantitiesFromBookingItems(items);
      setQuantities(hasPrefillQuantities(next) ? next : initialQuantities());
      return;
    }
    setQuantities(initialQuantities());
  }, [route.params?.nonce, route.params?.prefillItems]);

  const enabledBins = useMemo(
    () => getEnabledBinCatalog(pricing),
    [pricing]
  );

  const selectedItems = useMemo((): BookingBinItem[] => {
    return enabledBins
      .map((bin) => {
        const quantity = quantities[bin.key];
        const unitPrice = getUnitPrice(pricing, bin.key);
        return {
          id: bin.id,
          type: bin.label,
          quantity,
          unitPrice,
          totalPrice: quantity * unitPrice,
        };
      })
      .filter((item) => item.quantity > 0);
  }, [enabledBins, quantities, pricing]);

  const totalPrice = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.totalPrice, 0),
    [selectedItems]
  );

  const canContinue =
    !pricingLoading && enabledBins.length > 0 && totalPrice > 0;

  const adjustQuantity = (key: BinPriceKey, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  };

  const handleHelp = () => {
    navigation.navigate('CustomerTabs', { screen: 'CustomerHelp' });
  };

  const handleProceed = () => {
    if (!profileComplete) {
      navigation.navigate('CompleteProfile');
      return;
    }

    if (!selectedItems.length) {
      Alert.alert(
        'No bins selected',
        'Please select at least one bin to continue.'
      );
      return;
    }

    navigation.navigate('CreateBooking', {
      items: selectedItems,
      totalPrice,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.helpPill}
          onPress={handleHelp}
          accessibilityRole="button"
          accessibilityLabel="Help"
        >
          <Ionicons
            name="help-circle-outline"
            size={18}
            color={COLORS.textSecondary}
          />
          <AppText style={styles.helpPillText}>Help</AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <AppText style={styles.title}>Book a Pickup</AppText>
        <AppText style={styles.subtitle}>
          Select what you want us to collect
        </AppText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent>
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Ionicons name="leaf-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.bannerCopy}>
              <AppText style={styles.bannerTitle}>
                A cleaner community, a greener tomorrow
              </AppText>
              <AppText style={styles.bannerBody}>
                Choose the items you want to be collected.
              </AppText>
            </View>
          </View>

          {pricingLoading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={styles.loader}
            />
          ) : enabledBins.length === 0 ? (
            <AppText style={styles.emptyText}>
              No bin types are available right now. Please try again later.
            </AppText>
          ) : (
            enabledBins.map((bin) => {
              const qty = quantities[bin.key];
              return (
                <View key={bin.key} style={styles.itemCard}>
                  <Image
                    source={BIN_IMAGES[bin.key]}
                    style={styles.itemThumb}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={styles.itemCopy}>
                    <AppText style={styles.itemName}>{bin.label}</AppText>
                    <AppText style={styles.itemDescription} numberOfLines={2}>
                      {bin.description}
                    </AppText>
                    <AppText style={styles.itemPrice}>
                      {formatPrice(getUnitPrice(pricing, bin.key))}{' '}
                      {UNIT_LABEL[bin.key]}
                    </AppText>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[
                        styles.stepperButton,
                        styles.stepperMinus,
                        qty === 0 && styles.stepperMinusDisabled,
                      ]}
                      onPress={() => adjustQuantity(bin.key, -1)}
                      disabled={qty === 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease ${bin.label}`}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.text} />
                    </TouchableOpacity>
                    <AppText style={styles.stepperValue}>{qty}</AppText>
                    <TouchableOpacity
                      style={[styles.stepperButton, styles.stepperPlus]}
                      onPress={() => adjustQuantity(bin.key, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase ${bin.label}`}
                    >
                      <Ionicons name="add" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.guideRow}
            onPress={() => setShowBinInfoSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Bin size guide"
          >
            <View style={styles.guideIcon}>
              <Ionicons name="sync-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.guideCopy}>
              <AppText style={styles.guideTitle}>
                Not sure what to choose?
              </AppText>
              <AppText style={styles.guideBody}>
                Check our bin size guide or contact support.
              </AppText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </ResponsiveContent>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <AppText style={styles.totalLabel}>Total price</AppText>
          <AppText style={styles.totalValue}>{formatPrice(totalPrice)}</AppText>
        </View>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
          ]}
          onPress={handleProceed}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
        >
          <AppText style={styles.continueButtonText}>
            Continue to Schedule
          </AppText>
          <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showBinInfoSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBinInfoSheet(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity
            style={styles.bottomSheetDismiss}
            activeOpacity={1}
            onPress={() => setShowBinInfoSheet(false)}
          />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <AppText style={styles.bottomSheetTitle}>Bin size guide</AppText>
            {BIN_CATALOG.map((bin) => (
              <View key={bin.key} style={styles.bottomSheetRow}>
                <AppText style={styles.bottomSheetRowTitle}>{bin.label}</AppText>
                <AppText style={styles.bottomSheetRowSubtitle}>
                  {bin.description}
                </AppText>
              </View>
            ))}
            <TouchableOpacity
              style={styles.bottomSheetCloseButton}
              onPress={() => setShowBinInfoSheet(false)}
            >
              <AppText style={styles.bottomSheetCloseButtonText}>Close</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export const NewBookingScreen = BookPickupScreen;
