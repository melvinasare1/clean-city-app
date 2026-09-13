import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: VARS.small,
    paddingBottom: VARS.xlarge,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VARS.small,
    minHeight: 44,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  identityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: VARS.small,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VARS.small,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: VARS.xsmall,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  identityCopy: {
    flex: 1,
    marginRight: VARS.xsmall,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  editLink: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: VARS.small,
    paddingTop: VARS.small,
    paddingBottom: VARS.xxsmall,
    marginBottom: VARS.small,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: VARS.xxsmall,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VARS.xsmall,
    gap: VARS.xsmall,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.background,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  destructiveLabel: {
    color: COLORS.error,
  },
  menuValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  legalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEA',
    borderRadius: 999,
    paddingVertical: 14,
    gap: VARS.xxsmall,
    marginTop: VARS.xsmall,
  },
  logoutLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
});
