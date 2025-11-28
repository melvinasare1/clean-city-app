
import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { PRICES } from '../../../lib/constants';
import { styles } from './new-booking-screen.styles';

export const NewBookingScreen: React.FC = () => {
    const [smallBags, setSmallBags] = useState(0);
    const [largeBags, setLargeBags] = useState(0);
    const [standardBins, setStandardBins] = useState(0);
    const [wheelieBins, setWheelieBins] = useState(0);

    const calculateTotal = () => {
        return (
            smallBags * PRICES.smallBag +
            largeBags * PRICES.largeBag +
            standardBins * PRICES.standardBin +
            wheelieBins * PRICES.wheelieBin
        );
    };

    const handleSubmit = () => {
        const total = calculateTotal();
        if (total === 0) {
            Alert.alert('Error', 'Please select at least one bin type');
            return;
        }

        // TODO: Save booking to Firestore
        Alert.alert(
            'Booking Preview',
            `Total: GHS ${total}\n\nThis will be saved to Firestore in the next phase.`
        );
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Select Bins</Text>

                <View style={styles.binCard}>
                    <View style={styles.binInfo}>
                        <Text style={styles.binName}>Small Bags</Text>
                        <Text style={styles.binPrice}>GHS {PRICES.smallBag} each</Text>
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
                        <Text style={styles.binPrice}>GHS {PRICES.largeBag} each</Text>
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
                        <Text style={styles.binPrice}>GHS {PRICES.standardBin} each</Text>
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
                        <Text style={styles.binPrice}>GHS {PRICES.wheelieBin} each</Text>
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
                    <Text style={styles.totalValue}>GHS {calculateTotal()}</Text>
                </View>

                <Text style={styles.sectionTitle}>Pickup Details</Text>
                <Text style={styles.placeholderText}>
                    Address input, date picker, and time window selection will be added next
                </Text>

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>Create Booking</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

