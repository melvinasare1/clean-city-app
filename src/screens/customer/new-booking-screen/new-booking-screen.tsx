import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PRICES } from '@/lib/constants';
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
  const [smallBags, setSmallBags] = useState(0);
  const [largeBags, setLargeBags] = useState(0);
  const [standardBins, setStandardBins] = useState(0);
  const [wheelieBins, setWheelieBins] = useState(0);

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
        id: 'LARGE_BAG',
        type: 'Large Bags',
        quantity: largeBags,
        unitPrice: PRICES.largeBag,
        totalPrice: largeBags * PRICES.largeBag,
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

  const handleProceed = () => {
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
    <ScrollView style={styles.container}>
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
            <Text style={styles.binName}>Large Bags</Text>
            <Text style={styles.binPrice}>{formatPrice(PRICES.largeBag)} each</Text>
          </View>
          <View style={styles.counter}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setLargeBags(Math.max(0, largeBags - 1))}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{largeBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setLargeBags(largeBags + 1)}
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

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Price:</Text>
          <Text style={styles.totalValue}>{formatPrice(totalPrice)}</Text>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleProceed}>
          <Text style={styles.submitButtonText}>Continue to schedule</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
