import React, { useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { usePricing } from '@/hooks/usePricing';
import { isProfileComplete } from '@/lib/referral-utils';
import { BIN_CATALOG, getEnabledBinCatalog, getUnitPrice } from '@/lib/pricing';
import type { BinPriceKey } from '@/types/pricing';
import { BookingBinItem } from '@/types/booking';
import {
  CustomerStackParamList,
  CustomerTabParamList,
} from '@/navigation/types';
import { styles } from './new-booking-screen.styles';

type NewBookingScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'NewBooking'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const formatPrice = (value: number, currency: string) =>
  `${currency} ${value.toFixed(2)}`;

const initialQuantities = (): Record<BinPriceKey, number> => ({
  smallBag: 0,
  standardBin: 0,
  wheelieBin: 0,
});

export const NewBookingScreen: React.FC<NewBookingScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const { pricing, loading: pricingLoading } = usePricing();
  const profileComplete =
    user?.profileComplete ?? isProfileComplete(user ?? {});

  const [quantities, setQuantities] = useState(initialQuantities);
  const [showBinInfoSheet, setShowBinInfoSheet] = useState(false);

  const enabledBins = useMemo(
    () => getEnabledBinCatalog(pricing),
    [pricing]
  );

  const buildItems = (): BookingBinItem[] => {
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
  };

  const totalPrice = useMemo(() => {
    return buildItems().reduce((sum, item) => sum + item.totalPrice, 0);
  }, [quantities, pricing, enabledBins]);

  const adjustQuantity = (key: BinPriceKey, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  };

  const handleOpenBinInfo = () => {
    setShowBinInfoSheet(true);
  };

  const handleCloseBinInfo = () => {
    setShowBinInfoSheet(false);
  };

  const handleProceed = () => {
    if (!profileComplete) {
      navigation.getParent()?.navigate('CompleteProfile');
      return;
    }

    const selectedItems = buildItems();
    if (!selectedItems.length) {
      Alert.alert('No bins selected', 'Please select at least one bin to continue.');
      return;
    }

    navigation.navigate('CreateBooking', {
      items: selectedItems,
      totalPrice,
    });
  };

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Select Bins</Text>

            {pricingLoading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} />
            ) : enabledBins.length === 0 ? (
              <Text style={styles.binPrice}>
                No bin types are available right now. Please try again later.
              </Text>
            ) : (
              enabledBins.map((bin) => (
                <View key={bin.key} style={styles.binCard}>
                  <View style={styles.binInfo}>
                    <Text style={styles.binName}>{bin.label}</Text>
                    <Text style={styles.binPrice}>
                      {formatPrice(getUnitPrice(pricing, bin.key), pricing.currency)} each
                    </Text>
                  </View>
                  <View style={styles.counter}>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => adjustQuantity(bin.key, -1)}
                    >
                      <Text style={styles.counterButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{quantities[bin.key]}</Text>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => adjustQuantity(bin.key, 1)}
                    >
                      <Text style={styles.counterButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <View style={styles.binInfoStandaloneContainer}>
              <TouchableOpacity onPress={handleOpenBinInfo}>
                <Text style={styles.binInfoLink}>See bin size examples</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Price:</Text>
            <Text style={styles.totalValue}>
              {formatPrice(totalPrice, pricing.currency)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleProceed}
            disabled={pricingLoading || enabledBins.length === 0}
          >
            <Text style={styles.submitButtonText}>Continue to schedule</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showBinInfoSheet && (
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={handleCloseBinInfo}
        >
          <TouchableWithoutFeedback>
            <View style={styles.bottomSheetContainer}>
              <View style={styles.bottomSheetHandle} />
              <Text style={styles.bottomSheetTitle}>Bin size guide</Text>

              {BIN_CATALOG.map((bin) => (
                <View key={bin.key} style={styles.bottomSheetRow}>
                  <Text style={styles.bottomSheetRowTitle}>{bin.label}</Text>
                  <Text style={styles.bottomSheetRowSubtitle}>{bin.description}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.bottomSheetCloseButton}
                onPress={handleCloseBinInfo}
              >
                <Text style={styles.bottomSheetCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      )}
    </>
  );
};
