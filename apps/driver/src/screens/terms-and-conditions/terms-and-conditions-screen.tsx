import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, ScreenContainer } from '@/components';
import { COLORS, VARS } from '@/lib/constants';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: `By downloading, installing, or using the Clean City application ("App"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use the App. Clean City reserves the right to update or modify these Terms at any time without prior notice. Your continued use of the App following any changes constitutes your acceptance of the new Terms.`,
  },
  {
    title: '2. Description of Service',
    content: `Clean City is a waste management platform designed to help users schedule waste pickups, report illegal dumping, track recycling activity, and access information about waste disposal services in their municipality. The App may integrate with local government waste management authorities and third-party service providers to deliver its features.`,
  },
  {
    title: '3. User Registration & Accounts',
    content: `To access certain features of the App, you may be required to register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify Clean City immediately of any unauthorized use of your account.`,
  },
  {
    title: '4. User Responsibilities',
    content: `You agree to use the App only for lawful purposes and in a manner consistent with all applicable local, national, and international laws and regulations. You must not misuse the waste reporting feature by submitting false or misleading reports. You are responsible for ensuring that waste placed for collection complies with applicable waste disposal regulations in your area. Clean City is not liable for penalties or fines arising from improper waste disposal by users.`,
  },
  {
    title: '5. Data Collection & Privacy',
    content: `Clean City collects personal information including your name, address, location data, and usage activity to provide and improve our services. Location data is used solely to match you with the correct waste collection schedule and local authority services. We do not sell your personal data to third parties. For full details on how we handle your data, please refer to our Privacy Policy, which forms part of these Terms.`,
  },
  {
    title: '6. Notifications & Communications',
    content: `By creating an account, you consent to receiving service-related notifications such as pickup reminders, schedule changes, and alerts about waste collection disruptions in your area. You may opt out of promotional communications at any time through the App's notification settings. Service-critical notifications cannot be disabled while your account remains active.`,
  },
  {
    title: '7. Intellectual Property',
    content: `All content, features, and functionality of the App — including but not limited to text, graphics, logos, icons, and software — are the exclusive property of Clean City and are protected by applicable copyright, trademark, and intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any part of the App without express written permission from Clean City.`,
  },
  {
    title: '8. Third-Party Services',
    content: `The App may contain links to or integrate with third-party services, including municipal waste management portals and mapping services. Clean City is not responsible for the content, privacy practices, or terms of any third-party services. Your use of such services is governed by the respective third party's terms and conditions.`,
  },
  {
    title: '9. Limitation of Liability',
    content: `To the fullest extent permitted by law, Clean City shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the App. Clean City does not guarantee that waste collection services will be uninterrupted or error-free, as service delivery may depend on local municipal operations outside of our control.`,
  },
  {
    title: '10. Termination',
    content: `Clean City reserves the right to suspend or terminate your account and access to the App at any time, with or without cause, and with or without notice. Upon termination, your right to use the App will immediately cease. You may also delete your account at any time through the App settings. Certain provisions of these Terms will survive termination.`,
  },
  {
    title: '11. Governing Law',
    content: `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Clean City operates, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.`,
  },
  {
    title: '12. Contact Us',
    content: `If you have any questions, concerns, or feedback regarding these Terms and Conditions, please contact us at:

Clean City Support
Email: support@cleancityapp.com
Website: www.cleancityapp.com`,
  },
] as const;

export const TermsAndConditionsScreen: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <ScreenContainer scrollable>
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <AppText style={styles.heroTitle}>Terms & Conditions</AppText>
          <AppText style={styles.heroSubtitle}>
            Please read these terms carefully before using the Clean City app.
          </AppText>
          <AppText style={styles.effectiveDate}>Effective Date: May 13, 2026</AppText>
        </View>

        <AppText style={styles.intro}>
          Welcome to <AppText style={styles.introStrong}>Clean City</AppText> — your smart waste
          management companion. These Terms and Conditions govern your use of our mobile application
          and related services. By using Clean City, you agree to comply with and be bound by the
          following terms.
        </AppText>

        {SECTIONS.map((section, i) => {
          const expanded = expandedIndex === i;
          return (
            <View key={section.title} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <AppText style={styles.sectionTitle}>{section.title}</AppText>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
              {expanded ? (
                <AppText style={styles.sectionBody}>{section.content}</AppText>
              ) : null}
            </View>
          );
        })}

        <View style={styles.footer}>
          <AppText style={styles.footerText}>
            By using Clean City, you acknowledge that you have read, understood, and agree to be bound
            by these Terms and Conditions.
          </AppText>
          <AppText style={styles.footerVersion}>Version 1.0 · Clean City App</AppText>
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  wrap: {
    padding: VARS.medium,
    paddingBottom: VARS.xlarge,
  },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: VARS.medium,
    marginBottom: VARS.medium,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: VARS.xxsmall,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: VARS.xsmall,
  },
  effectiveDate: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.75,
    fontWeight: '500',
  },
  intro: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textSecondary,
    marginBottom: VARS.medium,
    padding: VARS.small,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  introStrong: {
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: VARS.xxsmall,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 24,
    color: COLORS.textSecondary,
    paddingHorizontal: VARS.small,
    paddingBottom: VARS.small,
  },
  footer: {
    marginTop: VARS.medium,
    padding: VARS.small,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: VARS.xxsmall,
  },
  footerVersion: {
    fontSize: 12,
    color: '#9E9E9E',
  },
});
