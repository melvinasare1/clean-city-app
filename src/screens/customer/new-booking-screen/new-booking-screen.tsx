import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PRICES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { isProfileComplete } from '@/lib/referral-utils';
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

const formatPrice = (value: number) => `GHS ${value.toFixed(2)}`;

export const NewBookingScreen: React.FC<NewBookingScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const profileComplete =
    user?.profileComplete ?? isProfileComplete(user ?? {});

  const [smallBags, setSmallBags] = useState(0);
  const [largeBags, setLargeBags] = useState(0);
  const [standardBins, setStandardBins] = useState(0);
  const [wheelieBins, setWheelieBins] = useState(0);
  const [showBinInfoSheet, setShowBinInfoSheet] = useState(false);

  const buildItems = (): BookingBinItem[] => {
    const selections: BookingBinItem[] = [
      {
        id: 'SMALL_BAG',
        type: 'Small Bags',
        quantity: smallBags,
        unitPrice: PRICES.smallBag,
        totalPrice: smallBags * PRICES.smallBag,
      },
      {
        id: 'STANDARD_BIN',
        type: 'Standard Bins',
        quantity: standardBins,
        unitPrice: PRICES.standardBin,
        totalPrice: standardBins * PRICES.standardBin,
      },
      {
        id: 'WHEELIE_BIN',
        type: 'Wheelie Bins',
        quantity: wheelieBins,
        unitPrice: PRICES.wheelieBin,
        totalPrice: wheelieBins * PRICES.wheelieBin,
      },
    ];

    return selections.filter((item) => item.quantity > 0);
  };

  const totalPrice = useMemo(() => {
    return buildItems().reduce((sum, item) => sum + item.totalPrice, 0);
  }, [smallBags, largeBags, standardBins, wheelieBins]);

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

            <View style={styles.binCard}>
              <View style={styles.binInfo}>
                <Text style={styles.binName}>Small Bags</Text>
                <Text style={styles.binPrice}>{formatPrice(PRICES.smallBag)} each</Text>
              </View>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setSmallBags(Math.max(0, smallBags - 1))}
                >
                  <Text style={styles.counterButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{smallBags}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setSmallBags(smallBags + 1)}
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.binCard}>
              <View style={styles.binInfo}>
                <Text style={styles.binName}>Standard Bins</Text>
                <Text style={styles.binPrice}>{formatPrice(PRICES.standardBin)} each</Text>
              </View>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setStandardBins(Math.max(0, standardBins - 1))}
                >
                  <Text style={styles.counterButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{standardBins}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setStandardBins(standardBins + 1)}
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.binCard}>
              <View style={styles.binInfo}>
                <Text style={styles.binName}>Wheelie Bins</Text>
                <Text style={styles.binPrice}>{formatPrice(PRICES.wheelieBin)} each</Text>
              </View>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setWheelieBins(Math.max(0, wheelieBins - 1))}
                >
                  <Text style={styles.counterButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{wheelieBins}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setWheelieBins(wheelieBins + 1)}
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

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
            <Text style={styles.totalValue}>{formatPrice(totalPrice)}</Text>
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={handleProceed}>
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

              <View style={styles.bottomSheetRow}>
                <Text style={styles.bottomSheetRowTitle}>Small Bags</Text>
                <Text style={styles.bottomSheetRowSubtitle}>
                  About the size of a regular grocery bag. Good for small household waste.
                </Text>
              </View>

              <View style={styles.bottomSheetRow}>
                <Text style={styles.bottomSheetRowTitle}>Standard Bins</Text>
                <Text style={styles.bottomSheetRowSubtitle}>
                  Similar to a typical dustbin kept outside homes. Fits multiple large bags.
                </Text>
              </View>

              <View style={styles.bottomSheetRow}>
                <Text style={styles.bottomSheetRowTitle}>Wheelie Bins</Text>
                <Text style={styles.bottomSheetRowSubtitle}>
                  Large wheeled bin, like those used for zoomlion collections. Best for
                  big clean ups or businesses.
                </Text>
              </View>

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
