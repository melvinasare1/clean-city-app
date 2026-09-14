import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton, AppText, AppTextInput } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { isAdmin } from '@/lib/admin';
import { COLORS } from '@/lib/constants';
import {
  saveStoreProduct,
  seedPlaceholderProductsToFirestore,
} from '@/services/product-service';
import type { StoreProduct, StoreProductCategory } from '@/types/product';

type Draft = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: StoreProductCategory;
  enabled: boolean;
  sortOrder: string;
  pricePlaceholder: boolean;
};

function toDraft(product: StoreProduct): Draft {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: String(product.price),
    imageUrl: product.imageUrl,
    category: product.category,
    enabled: product.enabled,
    sortOrder: String(product.sortOrder),
    pricePlaceholder: product.pricePlaceholder,
  };
}

function emptyDraft(): Draft {
  return {
    id: '',
    name: '',
    description: '',
    price: '0',
    imageUrl: '',
    category: 'bin',
    enabled: true,
    sortOrder: '10',
    pricePlaceholder: true,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseDraft(draft: Draft, existingIds: Set<string>): StoreProduct | string {
  const name = draft.name.trim();
  if (!name) return 'Name is required.';

  const id = draft.id.trim() || slugify(name);
  if (!id) return 'Could not create a product id from the name.';
  if (!draft.id.trim() && existingIds.has(id)) {
    return `A product with id "${id}" already exists.`;
  }

  const price = Number(draft.price);
  if (!Number.isFinite(price) || price < 0) return 'Price must be a number 0 or greater.';

  const sortOrder = Number(draft.sortOrder);
  if (!Number.isFinite(sortOrder) || sortOrder < 0) {
    return 'Sort order must be a number 0 or greater.';
  }

  const pricePlaceholder = price > 0 ? false : draft.pricePlaceholder;

  return {
    id,
    name,
    description: draft.description.trim(),
    price,
    imageUrl: draft.imageUrl.trim(),
    category: draft.category,
    enabled: draft.enabled,
    sortOrder,
    pricePlaceholder,
  };
}

export const AdminStoreScreen: React.FC = () => {
  const { user } = useAuth();
  const { products, loading, source } = useProducts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!isAdmin(user)) {
      Alert.alert('Access Denied', 'Admin access required');
    }
  }, [user]);

  const existingIds = useMemo(
    () => new Set(products.map((product) => product.id)),
    [products]
  );

  const startEdit = useCallback((product: StoreProduct) => {
    setEditingId(product.id);
    setDraft(toDraft(product));
  }, []);

  const startCreate = useCallback(() => {
    setEditingId('__new__');
    setDraft(emptyDraft());
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft(null);
  }, []);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const count = await seedPlaceholderProductsToFirestore();
      Alert.alert(
        'Catalog copied',
        `${count} products are now in Firestore. You can edit images, copy, and prices here. Changes show in the customer store immediately.`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not copy catalog', message);
    } finally {
      setSeeding(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    const parsed = parseDraft(draft, existingIds);
    if (typeof parsed === 'string') {
      Alert.alert('Check the form', parsed);
      return;
    }

    setSaving(true);
    try {
      await saveStoreProduct(parsed, user?.id ?? null);
      cancelEdit();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not save product', message);
    } finally {
      setSaving(false);
    }
  }, [cancelEdit, draft, existingIds, user?.id]);

  if (!isAdmin(user)) {
    return (
      <View style={styles.container}>
        <AppText style={styles.errorText}>Admin access required</AppText>
      </View>
    );
  }

  const isNew = editingId === '__new__';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppText style={styles.helperText}>
        Customer store reads these Firestore documents live: name, description,
        price, and image URL. Paste a public https image URL (Firebase Storage
        download URL works).
      </AppText>

      {source === 'placeholder' ? (
        <View style={styles.banner}>
          <AppText style={styles.bannerTitle}>Not in Firestore yet</AppText>
          <AppText style={styles.bannerBody}>
            The store is showing built-in fallbacks. Copy them into Firestore
            so you can edit them.
          </AppText>
          <AppButton
            title={seeding ? 'Copying…' : 'Copy catalog to Firestore'}
            onPress={handleSeed}
            loading={seeding}
            disabled={seeding}
            buttonStyle={styles.seedButton}
          />
        </View>
      ) : (
        <AppText style={styles.sourceLabel}>Live from Firestore</AppText>
      )}

      {loading && products.length === 0 ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loader} />
      ) : null}

      {products.map((product) => (
        <TouchableOpacity
          key={product.id}
          style={styles.row}
          onPress={() => startEdit(product)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${product.name}`}
        >
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <View style={styles.rowCopy}>
            <AppText style={styles.rowName}>{product.name}</AppText>
            <AppText style={styles.rowMeta} numberOfLines={1}>
              {product.category}
              {' · '}
              {product.pricePlaceholder ? 'Price TBD' : `GHS ${product.price.toFixed(2)}`}
              {product.enabled ? '' : ' · hidden'}
            </AppText>
          </View>
        </TouchableOpacity>
      ))}

      <AppButton
        title="Add product"
        variant="secondary"
        onPress={startCreate}
        buttonStyle={styles.addButton}
      />

      {draft && editingId ? (
        <View style={styles.form}>
          <AppText style={styles.formTitle}>
            {isNew ? 'New product' : `Edit ${draft.name || draft.id}`}
          </AppText>
          {isNew ? (
            <AppTextInput
              placeholder="Id (optional — generated from name)"
              value={draft.id}
              onChangeText={(id) => setDraft((prev) => (prev ? { ...prev, id } : prev))}
            />
          ) : (
            <AppText style={styles.idLabel}>id: {draft.id}</AppText>
          )}
          <AppTextInput
            placeholder="Name"
            value={draft.name}
            autoCapitalize="words"
            onChangeText={(name) => setDraft((prev) => (prev ? { ...prev, name } : prev))}
          />
          <AppTextInput
            placeholder="Description"
            value={draft.description}
            autoCapitalize="sentences"
            multiline
            onChangeText={(description) =>
              setDraft((prev) => (prev ? { ...prev, description } : prev))
            }
          />
          <AppTextInput
            placeholder="Price (GHS)"
            value={draft.price}
            keyboardType="decimal-pad"
            onChangeText={(price) => setDraft((prev) => (prev ? { ...prev, price } : prev))}
          />
          <AppTextInput
            placeholder="Image URL (https://…)"
            value={draft.imageUrl}
            autoCapitalize="none"
            onChangeText={(imageUrl) =>
              setDraft((prev) => (prev ? { ...prev, imageUrl } : prev))
            }
          />
          <AppTextInput
            placeholder="Sort order"
            value={draft.sortOrder}
            keyboardType="number-pad"
            onChangeText={(sortOrder) =>
              setDraft((prev) => (prev ? { ...prev, sortOrder } : prev))
            }
          />

          <View style={styles.chipRow}>
            {(['bin', 'liner'] as StoreProductCategory[]).map((category) => {
              const active = draft.category === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setDraft((prev) => (prev ? { ...prev, category } : prev))
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                    {category === 'bin' ? 'Bin' : 'Liner'}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <AppText style={styles.switchLabel}>Visible in store</AppText>
            <Switch
              value={draft.enabled}
              onValueChange={(enabled) =>
                setDraft((prev) => (prev ? { ...prev, enabled } : prev))
              }
              trackColor={{ false: '#d1d5db', true: COLORS.secondary }}
              thumbColor={COLORS.white}
            />
          </View>
          <View style={styles.switchRow}>
            <AppText style={styles.switchLabel}>Price TBD (hide GHS amount)</AppText>
            <Switch
              value={draft.pricePlaceholder}
              onValueChange={(pricePlaceholder) =>
                setDraft((prev) => (prev ? { ...prev, pricePlaceholder } : prev))
              }
              trackColor={{ false: '#d1d5db', true: COLORS.secondary }}
              thumbColor={COLORS.white}
            />
          </View>

          <AppButton
            title={saving ? 'Saving…' : 'Save to Firestore'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            buttonStyle={styles.saveButton}
          />
          <AppButton title="Cancel" variant="text" onPress={cancelEdit} />
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  bannerBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  seedButton: {
    marginTop: 4,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  thumbEmpty: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowCopy: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  idLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    marginRight: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 32,
  },
});
